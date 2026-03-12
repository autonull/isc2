import { sign, encode, cosineSimilarity, lshHash } from '@isc/core';
import type { Signature } from '@isc/core';
import { getPeerID, getKeypair } from '../identity';
import { getChannel, updateChannel } from '../channels/manager';
import { openDB, dbGet, dbGetAll, dbPut } from '@isc/adapters';

const DEFAULT_COMMUNITY_TTL = 86400 * 7;
const DB_NAME = 'isc-communities';
const DB_VERSION = 1;

let communitiesDb: IDBDatabase | null = null;

async function getIndexedDB(): Promise<IDBDatabase> {
  if (communitiesDb) return communitiesDb;

  communitiesDb = await openDB(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains('communities')) {
      db.createObjectStore('communities', { keyPath: 'channelID' });
    }
  });

  return communitiesDb;
}

export interface CommunityChannel {
  channelID: string;
  name: string;
  description: string;
  members: string[];
  coEditors: string[];
  embedding: number[];
  createdAt: number;
  updatedAt: number;
  signature: Signature;
}

interface CommunityChannelPayload {
  channelID: string;
  name: string;
  description: string;
  members: string[];
  coEditors: string[];
  embedding: number[];
  createdAt: number;
  updatedAt: number;
}

async function signCommunity(
  payload: CommunityChannelPayload
): Promise<Signature> {
  const keypair = await getKeypair();
  if (!keypair) throw new Error('Identity not initialized');
  return sign(encode(payload), keypair.privateKey);
}

async function storeCommunity(community: CommunityChannel): Promise<void> {
  const db = await getIndexedDB();
  await dbPut(db, 'communities', community);
}

async function getAllCommunities(): Promise<CommunityChannel[]> {
  try {
    const db = await getIndexedDB();
    return dbGetAll<CommunityChannel>(db, 'communities');
  } catch {
    return [];
  }
}

async function announceCommunity(community: CommunityChannel): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  if (!client) return;

  await client.announce(
    `/isc/community/${community.channelID}`,
    encode(community),
    DEFAULT_COMMUNITY_TTL
  );

  const hashes = lshHash(community.embedding, 'community-384', 3);
  for (const hash of hashes) {
    await client.announce(
      `/isc/community/bucket/${hash}`,
      encode(community),
      DEFAULT_COMMUNITY_TTL
    );
  }
}

async function computeEmbedding(name: string, description: string): Promise<number[]> {
  const { loadEmbeddingModel } = await import('../identity/embedding');
  const model = await loadEmbeddingModel();
  return model.embed(`${name} ${description}`);
}

function createCommunityPayload(
  channelID: string,
  name: string,
  description: string,
  members: string[],
  coEditors: string[],
  embedding: number[]
): CommunityChannelPayload {
  return {
    channelID,
    name,
    description,
    members,
    coEditors,
    embedding,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function createCommunityChannel(
  name: string,
  description: string,
  initialMembers: string[],
  coEditors: string[]
): Promise<CommunityChannel> {
  const peerID = await getPeerID();
  const members = [...new Set([...initialMembers, peerID])];
  const editors = [...new Set([...coEditors, peerID])];
  const embedding = await computeEmbedding(name, description);

  const payload = createCommunityPayload(
    `community-${Date.now()}-${peerID.slice(0, 8)}`,
    name,
    description,
    members,
    editors,
    embedding
  );

  const signature = await signCommunity(payload);
  const community: CommunityChannel = { ...payload, signature };

  await storeCommunity(community);
  await announceCommunity(community);
  return community;
}

async function updateAndSignCommunity(community: CommunityChannel): Promise<void> {
  community.updatedAt = Date.now();

  const payload: CommunityChannelPayload = {
    channelID: community.channelID,
    name: community.name,
    description: community.description,
    members: community.members,
    coEditors: community.coEditors,
    embedding: community.embedding,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
  };

  community.signature = await signCommunity(payload);
  await storeCommunity(community);
  await announceCommunity(community);
}

export async function joinCommunity(channelID: string): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) throw new Error(`Community ${channelID} not found`);

  const peerID = await getPeerID();
  if (!community.members.includes(peerID)) {
    community.members.push(peerID);
    await updateAndSignCommunity(community);
  }
}

export async function leaveCommunity(channelID: string): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) return;

  const peerID = await getPeerID();
  community.members = community.members.filter((m) => m !== peerID);
  await updateAndSignCommunity(community);
}

export async function addCoEditor(channelID: string, newEditor: string): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) throw new Error(`Community ${channelID} not found`);

  const peerID = await getPeerID();
  if (!community.coEditors.includes(peerID)) {
    throw new Error('Only co-editors can add new co-editors');
  }

  if (!community.coEditors.includes(newEditor)) {
    community.coEditors.push(newEditor);
    await updateAndSignCommunity(community);
  }
}

export async function updateCommunityChannel(
  channelID: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) throw new Error(`Community ${channelID} not found`);

  const peerID = await getPeerID();
  if (!community.coEditors.includes(peerID)) {
    throw new Error('Only co-editors can update community');
  }

  if (updates.name) community.name = updates.name;
  if (updates.description) community.description = updates.description;

  community.embedding = await computeEmbedding(community.name, community.description);
  await updateAndSignCommunity(community);
}

export async function getCommunity(channelID: string): Promise<CommunityChannel | null> {
  try {
    const db = await getIndexedDB();
    return dbGet<CommunityChannel>(db, 'communities', channelID);
  } catch {
    return null;
  }
}

export async function getUserCommunities(): Promise<CommunityChannel[]> {
  const peerID = await getPeerID();
  try {
    const db = await getIndexedDB();
    const all = await dbGetAll<CommunityChannel>(db, 'communities');
    return all.filter((c) => c.members.includes(peerID));
  } catch {
    return [];
  }
}

export async function queryCommunitiesByEmbedding(
  embedding: number[],
  limit: number = 20
): Promise<CommunityChannel[]> {
  try {
    const db = await getIndexedDB();
    const all = await dbGetAll<CommunityChannel>(db, 'communities');
    return all
      .map((c) => ({ community: c, score: cosineSimilarity(embedding, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.community);
  } catch {
    return [];
  }
}

export async function verifyCommunity(community: CommunityChannel): Promise<boolean> {
  try {
    if (!community.signature) return false;
    return true;
  } catch {
    return false;
  }
}

export async function computeSemanticNeighborhood(
  channelID: string,
  radius: number = 0.7
): Promise<CommunityChannel[]> {
  const community = await getCommunity(channelID);
  if (!community) return [];

  const allCommunities = await getAllCommunities();
  return allCommunities
    .filter((c) => c.channelID !== channelID)
    .filter((c) => cosineSimilarity(community.embedding, c.embedding) >= radius);
}
