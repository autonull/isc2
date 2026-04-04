/* eslint-disable */
import { Config } from '@isc/core';
import { getDB, dbGet, dbGetAll, dbPut, dbDelete, dbAdd, dbClear } from '../db/factory.ts';

const OFFLINE_QUEUE_STORE = 'offline_queue';
const DB_NAME = 'isc-offline-queue';
const DB_VERSION = 1;

export interface OfflineAction {
  id: string;
  type: 'post' | 'like' | 'repost' | 'reply' | 'follow' | 'dm' | 'mute' | 'block' | 'report' | 'message' | 'channel' | 'announce';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

export async function queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>): Promise<OfflineAction> {
  const offlineAction: OfflineAction = {
    ...action,
    id: `action_${crypto.randomUUID()}`,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: Config.offline.maxRetries,
  };

  const db = await getDB(DB_NAME, DB_VERSION, [OFFLINE_QUEUE_STORE]);
  await dbAdd(db, OFFLINE_QUEUE_STORE, offlineAction);

  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    try {
      await (registration as any).sync.register(Config.offline.syncEventTag);
    } catch {
      console.warn('[OfflineQueue] Background sync not available');
    }
  }

  return offlineAction;
}

export async function getQueuedActions(): Promise<OfflineAction[]> {
  const db = await getDB(DB_NAME, DB_VERSION, [OFFLINE_QUEUE_STORE]);
  return dbGetAll(db, OFFLINE_QUEUE_STORE);
}

export async function getQueuedActionsByType(type: OfflineAction['type']): Promise<OfflineAction[]> {
  const actions = await getQueuedActions();
  return actions.filter((a) => a.type === type);
}

export async function removeAction(id: string): Promise<void> {
  const db = await getDB(DB_NAME, DB_VERSION, [OFFLINE_QUEUE_STORE]);
  await dbDelete(db, OFFLINE_QUEUE_STORE, id);
}

export async function clearQueue(): Promise<void> {
  const db = await getDB(DB_NAME, DB_VERSION, [OFFLINE_QUEUE_STORE]);
  await dbClear(db, OFFLINE_QUEUE_STORE);
}

export async function incrementRetry(id: string): Promise<OfflineAction | null> {
  const db = await getDB(DB_NAME, DB_VERSION, [OFFLINE_QUEUE_STORE]);
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

/**
 * Queue a chat message for offline delivery
 */
export async function queueMessage(payload: {
  peerId: string;
  channelID: string;
  msg: string;
  timestamp: number;
}): Promise<OfflineAction> {
  return queueAction({
    type: 'message',
    payload,
    priority: 'high',
    metadata: { peerId: payload.peerId },
  });
}

/**
 * Queue a channel announcement for offline sync
 */
export async function queueChannelAnnouncement(payload: {
  channelID: string;
  distributions: Array<{ mu: number[]; sigma: number }>;
}): Promise<OfflineAction> {
  return queueAction({
    type: 'announce',
    payload,
    priority: 'normal',
    metadata: { channelID: payload.channelID },
  });
}

/**
 * Get queued messages for a specific peer
 */
export async function getQueuedMessagesForPeer(peerId: string): Promise<OfflineAction[]> {
  const actions = await getQueuedActions();
  return actions.filter(
    (a) => a.type === 'message' && (a.metadata?.peerId === peerId)
  );
}

/**
 * Clear queued messages for a specific peer
 */
export async function clearQueuedMessagesForPeer(peerId: string): Promise<void> {
  const actions = await getQueuedMessagesForPeer(peerId);
  const db = await getDB(DB_NAME, DB_VERSION, [OFFLINE_QUEUE_STORE]);
  for (const action of actions) {
    await dbDelete(db, OFFLINE_QUEUE_STORE, action.id);
  }
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
    } catch {
      console.error('[OfflineQueue] Failed to process action:', action.id);
      const updated = await incrementRetry(action.id);
      if (updated) failed++;
    }
  }

  return { success, failed, remaining: await getQueueCount() };
}
