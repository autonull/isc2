/**
 * Offline Module
 * 
 * Provides offline-first capabilities:
 * - Action queueing
 * - Connection monitoring
 * - Background sync
 */

export {
  queueAction,
  getQueuedActions,
  getQueuedActionsByType,
  removeAction,
  clearQueue,
  incrementRetry,
  getQueueCount,
  hasPendingActions,
  processQueue,
  type OfflineAction,
} from './queue.js';

export {
  initConnectionMonitor,
  getConnectionInfo,
  isOnline,
  isSlowConnection,
  subscribeToConnectionChanges,
  cleanupConnectionMonitor,
  type ConnectionStatus,
  type ConnectionInfo,
} from './connection.js';

export {
  initSyncManager,
  registerProcessor,
  syncPendingActions,
  getSyncStatus,
  getPendingCount,
  cleanupSyncManager,
  type SyncResult,
  type ActionProcessor,
} from './sync.js';
