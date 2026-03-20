/**
 * Peer Proximity Tracking Service
 *
 * Tracks proximity history with peers over time to enable Bridge Moment UI.
 * Stores in IndexedDB: peerId, firstSeen, lastSeen, avgCosine, sessionCount, contacted
 */

import { getDB, dbGet, dbPut, dbGetAll } from '../db/factory.js';

const DB_NAME = 'isc-proximity';
const DB_VERSION = 1;
const STORE_NAME = 'peer_proximity';

interface PeerProximityRecord {
  id: string; // peerId
  peerId: string;
  firstSeen: number; // timestamp
  lastSeen: number; // timestamp
  avgCosine: number;
  sessionCount: number;
  contacted: boolean;
  similarityHistory: number[]; // rolling history for avg calculation
}

interface BridgeMomentCandidate {
  peerId: string;
  daysSinceFirstSeen: number;
  avgCosine: number;
  sessionCount: number;
}

let db: IDBDatabase | null = null;

async function getProximityDB(): Promise<IDBDatabase> {
  if (db) return db;

  db = await getDB({
    name: DB_NAME,
    version: DB_VERSION,
    stores: [STORE_NAME],
  });

  return db;
}

export async function updatePeerProximity(peerId: string, cosine: number): Promise<void> {
  const database = await getProximityDB();

  let record = await dbGet<PeerProximityRecord>(database, STORE_NAME, peerId);
  const now = Date.now();

  if (record) {
    const newHistory = [...record.similarityHistory, cosine].slice(-10); // Keep last 10
    const newAvg = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;

    record = {
      ...record,
      lastSeen: now,
      avgCosine: newAvg,
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

  if (record) {
    record.contacted = true;
    await dbPut(database, STORE_NAME, record);
  }
}

export async function getBridgeMomentCandidates(): Promise<BridgeMomentCandidate[]> {
  const database = await getProximityDB();
  const allRecords = await dbGetAll<PeerProximityRecord>(database, STORE_NAME);
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  return allRecords
    .filter((record) => {
      const daysSinceFirstSeen = (now - record.firstSeen) / msPerDay;
      const inRange = record.avgCosine >= 0.55 && record.avgCosine <= 0.7;
      const hasSessions = record.sessionCount >= 3;
      const oldEnough = daysSinceFirstSeen >= 7;
      const notContacted = !record.contacted;

      return inRange && hasSessions && oldEnough && notContacted;
    })
    .map((record) => ({
      peerId: record.peerId,
      daysSinceFirstSeen: Math.floor((now - record.firstSeen) / msPerDay),
      avgCosine: record.avgCosine,
      sessionCount: record.sessionCount,
    }))
    .sort((a, b) => b.avgCosine - a.avgCosine);
}

export async function getAllProximityRecords(): Promise<PeerProximityRecord[]> {
  const database = await getProximityDB();
  return dbGetAll<PeerProximityRecord>(database, STORE_NAME);
}

export async function getTopSimilarPeers(
  limit = 10
): Promise<Array<{ peerId: string; score: number; days: number }>> {
  const database = await getProximityDB();
  const allRecords = await dbGetAll<PeerProximityRecord>(database, STORE_NAME);
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  return allRecords
    .filter((r) => !r.contacted)
    .map((record) => ({
      peerId: record.peerId,
      score: record.avgCosine * Math.max(1, (now - record.firstSeen) / msPerDay),
      days: Math.floor((now - record.firstSeen) / msPerDay),
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
