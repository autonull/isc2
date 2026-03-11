/**
 * Communities Service
 * 
 * Handles shared channels, co-editing, and semantic neighborhoods.
 * References: SOCIAL.md#communities
 */

import { sign, encode } from '@isc/core/crypto';
import { cosineSimilarity } from '@isc/core/math';
import type { Channel } from '@isc/core/types';
import type { Signature } from '@isc/core/crypto';
import { getPeerID, getKeypair } from '../identity';
import { getChannel, updateChannel } from '../channels/manager';

/** Default TTL for community channels */
const DEFAULT_COMMUNITY_TTL = 86400 * 7; // 7 days

/**
 * Community channel with shared editing permissions
 */
export interface CommunityChannel {
  channelID: string;
  name: string;
  description: string;
  members: string[]; // peerIDs
  coEditors: string[]; // peerIDs with edit permissions
  embedding: number[]; // Aggregated mean vector
  createdAt: number;
  updatedAt: number;
  signature: Signature;
}

/**
 * Payload for community channel creation
 */
export interface CommunityChannelPayload {
  channelID: string;
  name: string;
  description: string;
  members: string[];
  coEditors: string[];
  embedding: number[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Create a new community channel
 */
export async function createCommunityChannel(
  name: string,
  description: string,
  initialMembers: string[],
  coEditors: string[]
): Promise<CommunityChannel> {
  const peerID = await getPeerID();
  
  // Add creator to members and coEditors
  const members = [...new Set([...initialMembers, peerID])];
  const editors = [...new Set([...coEditors, peerID])];

  // Compute initial embedding from description
  const { loadEmbeddingModel } = await import('../identity/embedding');
  const model = await loadEmbeddingModel();
  const embedding = await model.embed(`${name} ${description}`);

  const payload: CommunityChannelPayload = {
    channelID: `community-${Date.now()}-${peerID.slice(0, 8)}`,
    name,
    description,
    members,
    coEditors: editors,
    embedding,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const keypair = await getKeypair();
  const signature = await sign(encode(payload), keypair.privateKey);

  const community: CommunityChannel = { ...payload, signature };

  // Store in IndexedDB
  await storeCommunity(community);
  
  // Announce to DHT
  await announceCommunity(community);

  return community;
}

/**
 * Join a community channel
 */
export async function joinCommunity(channelID: string): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) {
    throw new Error(`Community ${channelID} not found`);
  }

  const peerID = await getPeerID();
  
  // Add to members if not already present
  if (!community.members.includes(peerID)) {
    community.members.push(peerID);
    community.updatedAt = Date.now();
    
    // Re-sign
    const keypair = await getKeypair();
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
    community.signature = await sign(encode(payload), keypair.privateKey);
    
    await storeCommunity(community);
    await announceCommunity(community);
  }
}

/**
 * Leave a community channel
 */
export async function leaveCommunity(channelID: string): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) return;

  const peerID = await getPeerID();
  
  // Remove from members
  community.members = community.members.filter(m => m !== peerID);
  community.updatedAt = Date.now();
  
  // Re-sign
  const keypair = await getKeypair();
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
  community.signature = await sign(encode(payload), keypair.privateKey);
  
  await storeCommunity(community);
  await announceCommunity(community);
}

/**
 * Add co-editor to community (requires existing co-editor permission)
 */
export async function addCoEditor(
  channelID: string,
  newEditor: string
): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) {
    throw new Error(`Community ${channelID} not found`);
  }

  const peerID = await getPeerID();
  if (!community.coEditors.includes(peerID)) {
    throw new Error('Only co-editors can add new co-editors');
  }

  if (!community.coEditors.includes(newEditor)) {
    community.coEditors.push(newEditor);
    community.updatedAt = Date.now();
    
    // Re-sign
    const keypair = await getKeypair();
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
    community.signature = await sign(encode(payload), keypair.privateKey);
    
    await storeCommunity(community);
    await announceCommunity(community);
  }
}

/**
 * Update community channel description/embedding (requires co-editor permission)
 */
export async function updateCommunityChannel(
  channelID: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  const community = await getCommunity(channelID);
  if (!community) {
    throw new Error(`Community ${channelID} not found`);
  }

  const peerID = await getPeerID();
  if (!community.coEditors.includes(peerID)) {
    throw new Error('Only co-editors can update community');
  }

  if (updates.name) community.name = updates.name;
  if (updates.description) community.description = updates.description;
  
  // Re-compute embedding
  const { loadEmbeddingModel } = await import('../identity/embedding');
  const model = await loadEmbeddingModel();
  const embedding = await model.embed(`${community.name} ${community.description}`);
  community.embedding = embedding;
  community.updatedAt = Date.now();
  
  // Re-sign
  const keypair = await getKeypair();
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
  community.signature = await sign(encode(payload), keypair.privateKey);
  
  await storeCommunity(community);
  await announceCommunity(community);
}

/**
 * Get community by ID
 */
export async function getCommunity(channelID: string): Promise<CommunityChannel | null> {
  try {
    const db = await getIndexedDB();
    const stored = await db.transaction('communities', 'readonly')
      .objectStore('communities')
      .get(channelID);
    return stored || null;
  } catch {
    return null;
  }
}

/**
 * Get all communities for current user
 */
export async function getUserCommunities(): Promise<CommunityChannel[]> {
  const peerID = await getPeerID();
  try {
    const db = await getIndexedDB();
    const all = await db.transaction('communities', 'readonly')
      .objectStore('communities')
      .getAll();
    return all.filter(c => c.members.includes(peerID));
  } catch {
    return [];
  }
}

/**
 * Query communities by embedding proximity
 */
export async function queryCommunitiesByEmbedding(
  embedding: number[],
  limit: number = 20
): Promise<CommunityChannel[]> {
  try {
    const db = await getIndexedDB();
    const all = await db.transaction('communities', 'readonly')
      .objectStore('communities')
      .getAll();
    
    const scored = all
      .map(c => ({
        community: c,
        score: cosineSimilarity(embedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.community);
    
    return scored;
  } catch {
    return [];
  }
}

/**
 * Verify community signature
 */
export async function verifyCommunity(community: CommunityChannel): Promise<boolean> {
  try {
    const { verify } = await import('@isc/core/crypto');
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
    return verify(encode(payload), community.signature, community.channelID);
  } catch {
    return false;
  }
}

/**
 * Compute semantic neighborhood for a community
 */
export async function computeSemanticNeighborhood(
  channelID: string,
  radius: number = 0.7
): Promise<CommunityChannel[]> {
  const community = await getCommunity(channelID);
  if (!community) return [];

  const allCommunities = await getAllCommunities();
  
  return allCommunities
    .filter(c => c.channelID !== channelID)
    .filter(c => cosineSimilarity(community.embedding, c.embedding) >= radius);
}

// Local storage helpers
async function storeCommunity(community: CommunityChannel): Promise<void> {
  const db = await getIndexedDB();
  await db.transaction('communities', 'readwrite')
    .objectStore('communities')
    .put(community);
}

async function getAllCommunities(): Promise<CommunityChannel[]> {
  try {
    const db = await getIndexedDB();
    return await db.transaction('communities', 'readonly')
      .objectStore('communities')
      .getAll();
  } catch {
    return [];
  }
}

async function announceCommunity(community: CommunityChannel): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  
  // Announce under community ID
  await client.announce(
    `/isc/community/${community.channelID}`,
    encode(community),
    DEFAULT_COMMUNITY_TTL
  );
  
  // Announce under embedding buckets for discovery
  const { lshHash } = await import('@isc/core/math/lsh');
  const hashes = lshHash(community.embedding, 'community-384', 3);
  for (const hash of hashes) {
    await client.announce(
      `/isc/community/bucket/${hash}`,
      encode(community),
      DEFAULT_COMMUNITY_TTL
    );
  }
}

async function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-communities', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('communities')) {
        db.createObjectStore('communities', { keyPath: 'channelID' });
      }
    };
  });
}

function encode(data: unknown): string {
  return JSON.stringify(data);
}
