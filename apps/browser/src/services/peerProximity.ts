import { getDB, dbGet, dbPut, dbGetAll } from '../db/factory.js';

const DB_NAME = 'isc-proximity';
const DB_VERSION = 1;
const STORE_NAME = 'peer_proximity';

interface PeerProximityRecord {
  id: string;
  peerId: string;
  firstSeen: number;
  lastSeen: number;
  avgCosine: number;
  sessionCount: number;
  contacted: boolean;
  similarityHistory: number[];
}

interface BridgeMomentCandidate {
  peerId: string;
  daysSinceFirstSeen: number;
  avgCosine: number;
  sessionCount: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SIMILARITY_RANGE = { min: 0.55, max: 0.7 };
const HISTORY_LIMIT = 10;

let db: IDBDatabase | null = null;

async function getProximityDB(): Promise<IDBDatabase> {
  if (db) return db;
  db = await getDB({ name: DB_NAME, version: DB_VERSION, stores: [STORE_NAME] });
  return db;
}

export async function updatePeerProximity(peerId: string, cosine: number): Promise<void> {
  const database = await getProximityDB();
  const now = Date.now();

  let record = await dbGet<PeerProximityRecord>(database, STORE_NAME, peerId);

  if (record) {
    const newHistory = [...record.similarityHistory, cosine].slice(-HISTORY_LIMIT);
    record = {
      ...record,
      lastSeen: now,
      avgCosine: newHistory.reduce((a, b) => a + b, 0) / newHistory.length,
      sessionCount: record.sessionCount + 1,
      similarityHistory: newHistory,
    };
  } else {
    record = {
      id: peerId,
      peerId,
      firstSeen: now,
      lastSeen: now,
      avgCosine: cosine,
      sessionCount: 1,
      contacted: false,
      similarityHistory: [cosine],
    };
  }

  await dbPut(database, STORE_NAME, record);
}

export async function markPeerContacted(peerId: string): Promise<void> {
  const database = await getProximityDB();
  const record = await dbGet<PeerProximityRecord>(database, STORE_NAME, peerId);
  if (!record) return;

  record.contacted = true;
  await dbPut(database, STORE_NAME, record);
}

export async function getBridgeMomentCandidates(): Promise<BridgeMomentCandidate[]> {
  const database = await getProximityDB();
  const allRecords = await dbGetAll<PeerProximityRecord>(database, STORE_NAME);
  const now = Date.now();

  return allRecords
    .filter((record) => {
      const daysSinceFirstSeen = (now - record.firstSeen) / MS_PER_DAY;
      return (
        record.avgCosine >= SIMILARITY_RANGE.min &&
        record.avgCosine <= SIMILARITY_RANGE.max &&
        record.sessionCount >= 3 &&
        daysSinceFirstSeen >= 7 &&
        !record.contacted
      );
    })
    .map((record) => ({
      peerId: record.peerId,
      daysSinceFirstSeen: Math.floor((now - record.firstSeen) / MS_PER_DAY),
      avgCosine: record.avgCosine,
      sessionCount: record.sessionCount,
    }))
    .sort((a, b) => b.avgCosine - a.avgCosine);
}

export async function getAllProximityRecords(): Promise<PeerProximityRecord[]> {
  const database = await getProximityDB();
  return dbGetAll<PeerProximityRecord>(database, STORE_NAME);
}

export async function getTopSimilarPeers(limit = 10) {
  const database = await getProximityDB();
  const allRecords = await dbGetAll<PeerProximityRecord>(database, STORE_NAME);
  const now = Date.now();

  return allRecords
    .filter((r) => !r.contacted)
    .map((record) => ({
      peerId: record.peerId,
      score: record.avgCosine * Math.max(1, (now - record.firstSeen) / MS_PER_DAY),
      days: Math.floor((now - record.firstSeen) / MS_PER_DAY),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function clearProximityHistory(): Promise<void> {
  const database = await getProximityDB();
  const tx = database.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
}

export const peerProximityService = {
  updatePeerProximity,
  markPeerContacted,
  getBridgeMomentCandidates,
  getAllProximityRecords,
  getTopSimilarPeers,
  clearProximityHistory,
};

export default peerProximityService;
