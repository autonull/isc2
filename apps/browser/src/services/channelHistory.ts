/* eslint-disable */
import { getDB, dbPut, dbGetAll, dbDelete } from '../db/factory.ts';

const DB_NAME = 'isc-channel-history';
const DB_VERSION = 1;
const STORE_NAME = 'channel_history';
const MAX_RECORDS = 365;

interface ChannelHistoryRecord {
  id: string;
  channelId: string;
  timestamp: number;
  description: string;
  vector?: number[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let db: IDBDatabase | null = null;

async function getHistoryDB(): Promise<IDBDatabase> {
  if (db) return db;
  db = await getDB({ name: DB_NAME, version: DB_VERSION, stores: [STORE_NAME] });
  return db;
}

export async function saveChannelSnapshot(
  channelId: string,
  description: string,
  vector?: number[]
): Promise<void> {
  const database = await getHistoryDB();
  const timestamp = Date.now();
  const record: ChannelHistoryRecord = {
    id: `${channelId}_${timestamp}`,
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

  if (records.length > MAX_RECORDS) {
    const toDelete = records
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, records.length - MAX_RECORDS);

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

export async function getDriftInfo(channelId: string) {
  const history = await getChannelHistory(channelId);
  if (history.length < 2) return null;

  const [latest, earliest] = [history[0], history[history.length - 1]];

  if (!latest.vector?.length || !earliest.vector?.length) return null;

  const similarity = cosineSimilarity(latest.vector, earliest.vector);
  const driftAngle = Math.acos(Math.max(-1, Math.min(1, similarity))) * (180 / Math.PI);
  const direction = findDriftDirection(latest.vector, earliest.vector);
  const daysElapsed = Math.round((latest.timestamp - earliest.timestamp) / MS_PER_DAY);

  return {
    driftAngle: Math.round(driftAngle),
    direction,
    earliestDescription: earliest.description,
    latestDescription: latest.description,
    daysElapsed,
  };
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const { dot, normA, normB } = vecA.reduce(
    (acc, a, i) => ({
      dot: acc.dot + a * vecB[i],
      normA: acc.normA + a * a,
      normB: acc.normB + vecB[i] * vecB[i],
    }),
    { dot: 0, normA: 0, normB: 0 }
  );

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function findDriftDirection(vecA: number[], vecB: number[]): string {
  const drift = vecA.map((a, i) => a - vecB[i]);
  const maxIdx = drift.reduce((maxI, val, i, arr) => (val > arr[maxI] ? i : maxI), 0);
  const directions = [
    'expanding horizons',
    'deepening focus',
    'broadening scope',
    'intensifying interest',
  ];
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
  return [...new Set(allRecords.map((r) => r.channelId))];
}

export const channelHistoryService = {
  saveChannelSnapshot,
  getChannelHistory,
  getDriftInfo,
  clearChannelHistory,
  getAllChannelsWithHistory,
};
export default channelHistoryService;
