/**
 * Social Graph Service
 * 
 * Handles follows, suggested follows, and reputation.
 * References: SOCIAL.md#profiles--follows
 */

import { sign, encode } from '@isc/core/crypto';
import type { FollowEvent, FollowSubscription, Profile, ReputationScore } from './types';
import { getPeerID, getKeypair } from '../identity';
import { getChannel } from '../channels/manager';

/** Default TTL for follow events */
const DEFAULT_TTL = 86400 * 30; // 30 days

/**
 * Follow a peer
 */
export async function followPeer(followee: string): Promise<FollowEvent> {
  const event: FollowEvent = {
    type: 'follow',
    follower: await getPeerID(),
    followee,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'follow', followee, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  // Store locally in IndexedDB
  await storeFollowSubscription(event);
  
  // Announce via pubsub to followee
  await announceFollow(event);
  
  return event;
}

/**
 * Unfollow a peer
 */
export async function unfollowPeer(followee: string): Promise<FollowEvent> {
  const event: FollowEvent = {
    type: 'unfollow',
    follower: await getPeerID(),
    followee,
    timestamp: Date.now(),
    signature: await sign(
      encode({ type: 'unfollow', followee, timestamp: Date.now() }),
      (await getKeypair()).privateKey
    ),
  };

  // Remove from local storage
  await removeFollowSubscription(followee);
  
  // Announce unfollow
  await announceFollow(event);
  
  return event;
}

/**
 * Get following list from local storage
 */
export async function getFollowingList(): Promise<string[]> {
  const db = await getIndexedDB();
  const cursor = await db.transaction('follows', 'readonly')
    .objectStore('follows')
    .openCursor();
  
  const following: string[] = [];
  for (const c = cursor; c; c = await c.continue()) {
    following.push(c.value.followee);
  }
  return following;
}

/**
 * Get follow subscriptions with optional channel filter
 */
export async function getFollowSubscriptions(): Promise<FollowSubscription[]> {
  const db = await getIndexedDB();
  const subscriptions = await db.transaction('follows', 'readonly')
    .objectStore('follows')
    .getAll();
  return subscriptions;
}

/**
 * Check if following a peer
 */
export async function isFollowing(followee: string): Promise<boolean> {
  const db = await getIndexedDB();
  const subscription = await db.transaction('follows', 'readonly')
    .objectStore('follows')
    .get(followee);
  return subscription !== undefined;
}

/**
 * Get suggested follows based on channel similarity
 */
export async function getSuggestedFollows(
  channelID: string,
  limit: number = 10
): Promise<Profile[]> {
  const channel = await getChannel(channelID);
  if (!channel) return [];

  const sample = channel.distributions[0]?.mu ?? [];
  if (sample.length === 0) return [];

  // Query for similar peers (would use DHT ANN query)
  const candidates = await querySimilarPeers(sample, limit * 3);
  const following = await getFollowingList();

  // Filter out already following
  const suggestions = candidates.filter(p => !following.includes(p.peerID));
  
  return suggestions.slice(0, limit);
}

/**
 * Compute profile for a peer
 */
export async function getProfile(peerID: string): Promise<Profile | null> {
  // Get channel summaries from DHT
  const channels = await getPeerChannels(peerID);
  
  if (channels.length === 0) {
    return null;
  }

  // Compute bio embedding as mean of channel embeddings
  const bioEmbedding = computeMeanVector(channels.map(c => c.embedding));

  return {
    peerID,
    channels,
    bioEmbedding: bioEmbedding.length > 0 ? bioEmbedding : undefined,
    followerCount: 0, // Would compute from follow events
    followingCount: 0,
    joinedAt: await getFirstSeen(peerID),
  };
}

/**
 * Compute reputation score for a peer
 */
export async function computeReputation(
  peerID: string,
  halfLifeDays: number = 30
): Promise<ReputationScore> {
  const mutualFollows = await countMutualFollows(peerID);
  const interactions = await getInteractionHistory(peerID);
  
  // Base score from mutual follows
  const baseScore = Math.min(mutualFollows * 0.1, 0.5);
  
  // Add interaction weight
  const interactionScore = interactions.reduce((sum, i) => sum + i.weight, 0) * 0.01;
  
  // Apply time decay
  const decayFactor = Math.exp(-halfLifeDays / 30);
  
  const score = Math.min((baseScore + interactionScore) * decayFactor, 1.0);

  return {
    peerID,
    score,
    mutualFollows,
    interactionHistory: interactions,
    halfLifeDays,
  };
}

/**
 * Apply chaos mode perturbation for serendipity
 */
export function applyChaosMode(embedding: number[], chaosLevel: number): number[] {
  if (chaosLevel <= 0) return embedding;
  
  const noise = embedding.map(() => (Math.random() * 2 - 1) * chaosLevel);
  const perturbed = embedding.map((v, i) => v + noise[i]);
  
  // Normalize
  const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? perturbed.map(v => v / norm) : embedding;
}

// Local storage helpers
async function storeFollowSubscription(event: FollowEvent): Promise<void> {
  const db = await getIndexedDB();
  await db.transaction('follows', 'readwrite')
    .objectStore('follows')
    .put({
      followee: event.followee,
      since: event.timestamp,
    });
}

async function removeFollowSubscription(followee: string): Promise<void> {
  const db = await getIndexedDB();
  await db.transaction('follows', 'readwrite')
    .objectStore('follows')
    .delete(followee);
}

async function announceFollow(event: FollowEvent): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  const key = `/isc/follow/${event.followee}`;
  await client.announce(key, encode(event), DEFAULT_TTL);
}

// Utility functions
async function querySimilarPeers(embedding: number[], limit: number): Promise<Profile[]> {
  // Placeholder - would query DHT for peers with similar channel embeddings
  return [];
}

async function getPeerChannels(peerID: string): Promise<any[]> {
  // Placeholder - would query DHT for peer's channel announcements
  return [];
}

async function getInteractionHistory(peerID: string): Promise<any[]> {
  // Placeholder - would query DHT for interaction events
  return [];
}

async function countMutualFollows(peerID: string): Promise<number> {
  // Placeholder - would compute mutual follows
  return 0;
}

async function getFirstSeen(peerID: string): Promise<number> {
  // Placeholder - would get from DHT peer metadata
  return Date.now();
}

function computeMeanVector(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  
  const dim = embeddings[0].length;
  const sum = new Array(dim).fill(0);
  
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      sum[i] += emb[i];
    }
  }
  
  return sum.map(v => v / embeddings.length);
}

async function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('isc-social', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('follows')) {
        db.createObjectStore('follows', { keyPath: 'followee' });
      }
    };
  });
}

function encode(data: unknown): string {
  return JSON.stringify(data);
}
