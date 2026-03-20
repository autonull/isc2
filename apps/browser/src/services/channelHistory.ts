/**
 * Channel History Service
 *
 * Tracks channel embedding history over time to visualize thought drift.
 * Stores in IndexedDB: channelId, timestamp, vec, description.
 */

import { getDB, dbGet, dbPut, dbGetAll, dbDelete } from '../db/factory.js';

const DB_NAME = 'isc-channel-history';
const DB_VERSION = 1;
const STORE_NAME = 'channel_history';
const MAX_RECORDS_PER_CHANNEL = 365;

interface ChannelHistoryRecord {
  id: string; // channelId_timestamp
  channelId: string;
  timestamp: number;
  description: string;
  vector?: number[]; // Stored as JSON array for simplicity
}

let db: IDBDatabase | null = null;

async function getHistoryDB(): Promise<IDBDatabase> {
  if (db) return db;

  db = await getDB({
    name: DB_NAME,
    version: DB_VERSION,
    stores: [STORE_NAME],
  });

  return db;
}

export async function saveChannelSnapshot(
  channelId: string,
  description: string,
  vector?: number[]
): Promise<void> {
  const database = await getHistoryDB();
  const timestamp = Date.now();
  const id = `${channelId}_${timestamp}`;

  const record: ChannelHistoryRecord = {
    id,
    channelId,
    timestamp,
    description,
    vector,
  };

  await dbPut(database, STORE_NAME, record);

  await pruneOldRecords(channelId);
}

async function pruneOldRecords(channelId: string): Promise<void> {
  const database = await getHistoryDB();
  const records = await getChannelHistory(channelId);

  if (records.length > MAX_RECORDS_PER_CHANNEL) {
    const toDelete = records
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, records.length - MAX_RECORDS_PER_CHANNEL);

    for (const record of toDelete) {
      await dbDelete(database, STORE_NAME, record.id);
    }
  }
}

export async function getChannelHistory(channelId: string): Promise<ChannelHistoryRecord[]> {
  const database = await getHistoryDB();
  const allRecords = await dbGetAll<ChannelHistoryRecord>(database, STORE_NAME);

  return allRecords
    .filter((r) => r.channelId === channelId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

export async function getDriftInfo(channelId: string): Promise<{
  driftAngle: number;
  direction: string;
  earliestDescription: string;
  latestDescription: string;
  daysElapsed: number;
} | null> {
  const history = await getChannelHistory(channelId);

  if (history.length < 2) {
    return null;
  }

  const latest = history[0];
  const earliest = history[history.length - 1];

  if (
    !latest.vector ||
    !earliest.vector ||
    latest.vector.length === 0 ||
    earliest.vector.length === 0
  ) {
    return null;
  }

  const similarity = cosineSimilarity(latest.vector, earliest.vector);
  const driftAngle = Math.acos(Math.max(-1, Math.min(1, similarity))) * (180 / Math.PI);

  const direction = findDriftDirection(latest.vector, earliest.vector);

  const daysElapsed = Math.round((latest.timestamp - earliest.timestamp) / (24 * 60 * 60 * 1000));

  return {
    driftAngle: Math.round(driftAngle),
    direction,
    earliestDescription: earliest.description,
    latestDescription: latest.description,
    daysElapsed,
  };
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function findDriftDirection(vecA: number[], vecB: number[]): string {
  const drift: number[] = [];
  for (let i = 0; i < vecA.length; i++) {
    drift.push(vecA[i] - vecB[i]);
  }

  const maxIdx = drift.reduce((maxI, val, i, arr) => (val > arr[maxI] ? i : maxI), 0);

  const directions: Record<number, string> = {
    0: 'expanding horizons',
    1: 'deepening focus',
    2: 'broadening scope',
    3: 'intensifying interest',
  };

  return directions[maxIdx % 4] || 'evolving thoughts';
}

export async function clearChannelHistory(channelId: string): Promise<void> {
  const database = await getHistoryDB();
  const records = await getChannelHistory(channelId);

  for (const record of records) {
    await dbDelete(database, STORE_NAME, record.id);
  }
}

export async function getAllChannelsWithHistory(): Promise<string[]> {
  const database = await getHistoryDB();
  const allRecords = await dbGetAll<ChannelHistoryRecord>(database, STORE_NAME);

  const channelIds = new Set<string>();
  for (const record of allRecords) {
    channelIds.add(record.channelId);
  }

  return Array.from(channelIds);
}

export const channelHistoryService = {
  saveChannelSnapshot,
  getChannelHistory,
  getDriftInfo,
  clearChannelHistory,
  getAllChannelsWithHistory,
};

export default channelHistoryService;
