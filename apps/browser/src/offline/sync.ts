/**
 * Offline Sync Manager
 * 
 * Coordinates syncing of queued actions when connection is restored.
 */

import {
  getQueuedActions,
  processQueue,
  hasPendingActions,
  type OfflineAction,
} from './queue.js';
import { isOnline, subscribeToConnectionChanges, getConnectionInfo } from './connection.js';

export interface SyncResult {
  success: number;
  failed: number;
  remaining: number;
  lastSync: number;
}

export type ActionProcessor = (action: OfflineAction) => Promise<boolean>;

const PROCESSORS = new Map<OfflineAction['type'], ActionProcessor>();
let isSyncing = false;
let lastSyncTime: number | null = null;
let unsubscribeConnection: (() => void) | null = null;

/**
 * Initialize the sync manager
 */
export function initSyncManager(): void {
  // Subscribe to connection changes
  unsubscribeConnection = subscribeToConnectionChanges(handleConnectionChange);
  
  // Check for pending actions on init
  if (isOnline()) {
    syncPendingActions();
  }
}

/**
 * Register a processor for a specific action type
 */
export function registerProcessor(
  type: OfflineAction['type'],
  processor: ActionProcessor
): void {
  PROCESSORS.set(type, processor);
}

/**
 * Handle connection status changes
 */
async function handleConnectionChange(): Promise<void> {
  if (isOnline() && !isSyncing) {
    await syncPendingActions();
  }
}

/**
 * Sync all pending actions
 */
export async function syncPendingActions(): Promise<SyncResult> {
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress');
    return { success: 0, failed: 0, remaining: await getQueuedActions().then(a => a.length), lastSync: lastSyncTime ?? 0 };
  }

  if (!isOnline()) {
    console.log('[SyncManager] Cannot sync - offline');
    return { success: 0, failed: 0, remaining: await getQueuedActions().then(a => a.length), lastSync: lastSyncTime ?? 0 };
  }

  const hasPending = await hasPendingActions();
  if (!hasPending) {
    console.log('[SyncManager] No pending actions to sync');
    return { success: 0, failed: 0, remaining: 0, lastSync: lastSyncTime ?? 0 };
  }

  isSyncing = true;
  console.log('[SyncManager] Starting sync...');

  try {
    const result = await processQueue(processAction);
    lastSyncTime = Date.now();
    
    console.log(`[SyncManager] Sync complete: ${result.success} success, ${result.failed} failed, ${result.remaining} remaining`);
    
    return {
      ...result,
      lastSync: lastSyncTime,
    };
  } catch (err) {
    console.error('[SyncManager] Sync failed:', err);
    return {
      success: 0,
      failed: 0,
      remaining: await getQueuedActions().then(a => a.length),
      lastSync: lastSyncTime ?? 0,
    };
  } finally {
    isSyncing = false;
  }
}

/**
 * Process a single action using the registered processor
 */
async function processAction(action: OfflineAction): Promise<boolean> {
  const processor = PROCESSORS.get(action.type);
  
  if (!processor) {
    console.warn('[SyncManager] No processor registered for action type:', action.type);
    return false;
  }

  try {
    return await processor(action);
  } catch (err) {
    console.error('[SyncManager] Action processor failed:', action.id, err);
    return false;
  }
}

/**
 * Get sync status
 */
export function getSyncStatus(): {
  isSyncing: boolean;
  hasPending: boolean;
  lastSync: number | null;
  connectionStatus: string;
} {
  const info = getConnectionInfo();
  return {
    isSyncing,
    hasPending: false, // Will be updated async
    lastSync: lastSyncTime,
    connectionStatus: info.status,
  };
}

/**
 * Get pending action count
 */
export async function getPendingCount(): Promise<number> {
  const actions = await getQueuedActions();
  return actions.length;
}

/**
 * Cleanup sync manager
 */
export function cleanupSyncManager(): void {
  if (unsubscribeConnection) {
    unsubscribeConnection();
  }
  PROCESSORS.clear();
}
