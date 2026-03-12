import { openDB, dbAdd, dbGet, dbGetAll, dbDelete, dbClear, dbPut, dbTransaction } from '@isc/adapters';
import { Config } from '@isc/core';

const OFFLINE_QUEUE_STORE = 'offline_queue';

export interface OfflineAction {
  id: string;
  type: 'post' | 'like' | 'repost' | 'reply' | 'follow' | 'dm' | 'mute' | 'block' | 'report';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

let queueDb: IDBDatabase | null = null;

async function getQueueDB(): Promise<IDBDatabase> {
  if (queueDb) return queueDb;

  queueDb = await openDB('isc-offline-queue', 1, (db, _event) => {
    if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
      db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id' });
    }
  });

  return queueDb;
}

export async function queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): Promise<OfflineAction> {
  const offlineAction: OfflineAction = {
    ...action,
    id: `action_${crypto.randomUUID()}`,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: Config.offline.maxRetries,
  };

  const db = await getQueueDB();
  await dbAdd(db, OFFLINE_QUEUE_STORE, offlineAction);

  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    try {
      await (registration as any).sync.register(Config.offline.syncEventTag);
    } catch (err) {
      console.warn('[OfflineQueue] Background sync not available:', err);
    }
  }

  return offlineAction;
}

export async function getQueuedActions(): Promise<OfflineAction[]> {
  const db = await getQueueDB();
  return dbGetAll(db, OFFLINE_QUEUE_STORE);
}

export async function getQueuedActionsByType(type: OfflineAction['type']): Promise<OfflineAction[]> {
  const actions = await getQueuedActions();
  return actions.filter((a) => a.type === type);
}

export async function removeAction(id: string): Promise<void> {
  const db = await getQueueDB();
  await dbDelete(db, OFFLINE_QUEUE_STORE, id);
}

export async function clearQueue(): Promise<void> {
  const db = await getQueueDB();
  await dbClear(db, OFFLINE_QUEUE_STORE);
}

export async function incrementRetry(id: string): Promise<OfflineAction | null> {
  const db = await getQueueDB();
  const action = await dbGet<OfflineAction>(db, OFFLINE_QUEUE_STORE, id);

  if (!action) return null;
  action.retryCount++;

  if (action.retryCount >= action.maxRetries) {
    await removeAction(id);
    return null;
  }

  await dbPut(db, OFFLINE_QUEUE_STORE, action);
  return action;
}

export async function getQueueCount(): Promise<number> {
  const actions = await getQueuedActions();
  return actions.length;
}

export async function hasPendingActions(): Promise<boolean> {
  return (await getQueueCount()) > 0;
}

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
        if (updated) failed++;
      }
    } catch (err) {
      console.error('[OfflineQueue] Failed to process action:', action.id, err);
      const updated = await incrementRetry(action.id);
      if (updated) failed++;
    }
  }

  return { success, failed, remaining: await getQueueCount() };
}
