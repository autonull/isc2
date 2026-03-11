/**
 * Offline Action Queue
 * 
 * Queues actions when offline and syncs when connection is restored.
 */

const OFFLINE_QUEUE_STORE = 'offline_queue';
const SYNC_EVENT_TAG = 'sync-actions';

export interface OfflineAction {
  id: string;
  type: 'post' | 'like' | 'repost' | 'reply' | 'follow' | 'dm' | 'mute' | 'block' | 'report';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * Add an action to the offline queue
 */
export async function queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): Promise<OfflineAction> {
  const offlineAction: OfflineAction = {
    ...action,
    id: `action_${crypto.randomUUID()}`,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 5,
  };

  const db = await getQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).add(offlineAction);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Request background sync if available
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    try {
      await (registration as any).sync.register(SYNC_EVENT_TAG);
    } catch (err) {
      console.warn('[OfflineQueue] Background sync not available:', err);
    }
  }

  return offlineAction;
}

/**
 * Get all queued actions
 */
export async function getQueuedActions(): Promise<OfflineAction[]> {
  const db = await getQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get queued actions by type
 */
export async function getQueuedActionsByType(type: OfflineAction['type']): Promise<OfflineAction[]> {
  const actions = await getQueuedActions();
  return actions.filter((a) => a.type === type);
}

/**
 * Remove an action from the queue
 */
export async function removeAction(id: string): Promise<void> {
  const db = await getQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Clear all queued actions
 */
export async function clearQueue(): Promise<void> {
  const db = await getQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Increment retry count for an action
 */
export async function incrementRetry(id: string): Promise<OfflineAction | null> {
  const db = await getQueueDB();
  const action = await new Promise<OfflineAction | null>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readonly');
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });

  if (!action) return null;

  action.retryCount++;
  
  if (action.retryCount >= action.maxRetries) {
    await removeAction(id);
    return null;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, 'readwrite');
    const req = tx.objectStore(OFFLINE_QUEUE_STORE).put(action);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return action;
}

/**
 * Get queue count
 */
export async function getQueueCount(): Promise<number> {
  const actions = await getQueuedActions();
  return actions.length;
}

/**
 * Check if there are pending actions
 */
export async function hasPendingActions(): Promise<boolean> {
  const count = await getQueueCount();
  return count > 0;
}

/**
 * Process queued actions (called when coming back online)
 */
export async function processQueue(processAction: (action: OfflineAction) => Promise<boolean>): Promise<{
  success: number;
  failed: number;
  remaining: number;
}> {
  const actions = await getQueuedActions();
  let success = 0;
  let failed = 0;

  for (const action of actions) {
    try {
      const result = await processAction(action);
      if (result) {
        await removeAction(action.id);
        success++;
      } else {
        const updated = await incrementRetry(action.id);
        if (updated) {
          failed++;
        }
      }
    } catch (err) {
      console.error('[OfflineQueue] Failed to process action:', action.id, err);
      const updated = await incrementRetry(action.id);
      if (updated) {
        failed++;
      }
    }
  }

  const remaining = await getQueueCount();

  return { success, failed, remaining };
}

/**
 * Database helper
 */
async function getQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-offline-queue', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' });
      }
    };
  });
}
