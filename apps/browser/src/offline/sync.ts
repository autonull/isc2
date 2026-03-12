import { getQueuedActions, processQueue, hasPendingActions, type OfflineAction } from './queue.js';
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

export function initSyncManager(): void {
  unsubscribeConnection = subscribeToConnectionChanges(handleConnectionChange);
  if (isOnline()) syncPendingActions();
}

export function registerProcessor(type: OfflineAction['type'], processor: ActionProcessor): void {
  PROCESSORS.set(type, processor);
}

async function handleConnectionChange(): Promise<void> {
  if (isOnline() && !isSyncing) await syncPendingActions();
}

export async function syncPendingActions(): Promise<SyncResult> {
  if (isSyncing) {
    console.log('[SyncManager] Sync already in progress');
    return { success: 0, failed: 0, remaining: await getQueuedActions().then((a) => a.length), lastSync: lastSyncTime ?? 0 };
  }

  if (!isOnline()) {
    console.log('[SyncManager] Cannot sync - offline');
    return { success: 0, failed: 0, remaining: await getQueuedActions().then((a) => a.length), lastSync: lastSyncTime ?? 0 };
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
    return { ...result, lastSync: lastSyncTime };
  } catch {
    console.error('[SyncManager] Sync failed');
    return { success: 0, failed: 0, remaining: await getQueuedActions().then((a) => a.length), lastSync: lastSyncTime ?? 0 };
  } finally {
    isSyncing = false;
  }
}

async function processAction(action: OfflineAction): Promise<boolean> {
  const processor = PROCESSORS.get(action.type);
  if (!processor) {
    console.warn('[SyncManager] No processor registered for action type:', action.type);
    return false;
  }

  try {
    return await processor(action);
  } catch {
    console.error('[SyncManager] Action processor failed:', action.id);
    return false;
  }
}

export function getSyncStatus(): {
  isSyncing: boolean;
  hasPending: boolean;
  lastSync: number | null;
  connectionStatus: string;
} {
  const info = getConnectionInfo();
  return { isSyncing, hasPending: false, lastSync: lastSyncTime, connectionStatus: info.status };
}

export async function getPendingCount(): Promise<number> {
  const actions = await getQueuedActions();
  return actions.length;
}

export function cleanupSyncManager(): void {
  unsubscribeConnection?.();
  PROCESSORS.clear();
}
