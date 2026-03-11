/**
 * Social Graph Service
 *
 * Handles follows, suggested follows, reputation, and Web of Trust.
 * References: SOCIAL.md#profiles--follows, Phase 6 Reputation & Moderation
 */

import { sign, encode } from '@isc/core/crypto';
import type {
  FollowEvent,
  FollowSubscription,
  Profile,
  ReputationScore,
  TrustPath,
  TrustEdge,
  TrustScore,
  Interaction,
} from './types';
import { getPeerID, getKeypair } from '../identity';
import { getChannel } from '../channels/manager';

/** Default reputation half-life in days */
const DEFAULT_HALF_LIFE_DAYS = 30;

/** Maximum indirect trust contribution (Sybil resistance cap) */
const INDIRECT_TRUST_CAP = 0.3;

/** Interaction weights for reputation calculation */
const INTERACTION_WEIGHTS: Record<Interaction['type'], number> = {
  like: 1,
  repost: 3,
  reply: 2,
  quote: 4,
  follow: 5,
};

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
 * Compute reputation score for a peer with exponential decay
 * Uses interaction-weighted scoring with Sybil resistance
 */
export async function computeReputation(
  peerID: string,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS
): Promise<ReputationScore> {
  const mutualFollows = await countMutualFollows(peerID);
  const interactions = await getInteractionHistory(peerID);

  // Calculate time-weighted interaction score
  const now = Date.now();
  const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;

  const interactionScore = interactions.reduce((sum, interaction) => {
    const ageMs = now - interaction.timestamp;
    const decayFactor = Math.exp(-ageMs / halfLifeMs);
    const weightedContribution = interaction.weight * decayFactor;
    return sum + weightedContribution;
  }, 0);

  // Base score from mutual follows (capped to prevent Sybil attacks)
  const mutualFollowScore = Math.min(mutualFollows * 0.05, 0.4);

  // Interaction contribution (also capped)
  const interactionContribution = Math.min(interactionScore * 0.02, 0.3);

  // Combined score
  const score = Math.min(mutualFollowScore + interactionContribution, 1.0);

  return {
    peerID,
    score,
    mutualFollows,
    interactionHistory: interactions,
    halfLifeDays,
  };
}

/**
 * Compute comprehensive trust score with Web of Trust
 * Combines direct trust, indirect trust paths, and mutual follow bonus
 */
export async function computeTrustScore(
  targetPeer: string,
  maxDepth: number = 3
): Promise<TrustScore> {
  const myPeer = await getPeerID();

  // Direct trust from interactions
  const directReputation = await computeReputation(targetPeer);
  const directTrust = directReputation.score;

  // Mutual follow bonus
  const mutualFollows = await countMutualFollows(targetPeer);
  const mutualFollowBonus = mutualFollows > 0 ? Math.min(mutualFollows * 0.1, 0.2) : 0;

  // Indirect trust via trust paths
  const trustPaths = await findTrustPaths(myPeer, targetPeer, maxDepth);
  let indirectTrust = 0;

  for (const path of trustPaths) {
    // Path trust = product of edge trusts (diminishing with depth)
    const pathTrust = path.trustScore * Math.pow(0.7, path.depth - 1);
    indirectTrust = Math.max(indirectTrust, pathTrust);
  }

  // Cap indirect trust to prevent Sybil attacks
  const cappedIndirectTrust = Math.min(indirectTrust, INDIRECT_TRUST_CAP);

  // Combined total
  const total = Math.min(directTrust + cappedIndirectTrust + mutualFollowBonus, 1.0);

  return {
    directTrust,
    indirectTrust: cappedIndirectTrust,
    mutualFollowBonus,
    sybilCap: INDIRECT_TRUST_CAP,
    total,
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

/**
 * Find trust paths from source to target using BFS
 * Returns paths sorted by trust score
 */
export async function findTrustPaths(
  source: string,
  target: string,
  maxDepth: number = 3
): Promise<TrustPath[]> {
  if (source === target) {
    return [{ source, target, hops: [], trustScore: 1, depth: 0 }];
  }

  const paths: TrustPath[] = [];
  const visited = new Set<string>();
  const queue: { current: string; hops: string[]; score: number; depth: number }[] = [
    { current: source, hops: [], score: 1, depth: 0 },
  ];

  while (queue.length > 0) {
    const { current, hops, score, depth } = queue.shift()!;

    if (depth >= maxDepth || visited.has(current)) continue;
    visited.add(current);

    // Get trusted connections (people this peer follows with high trust)
    const connections = await getTrustedConnections(current);

    for (const edge of connections) {
      const newScore = score * edge.score;

      if (edge.to === target) {
        // Found path to target
        paths.push({
          source,
          target,
          hops: [...hops, current],
          trustScore: newScore,
          depth: depth + 1,
        });
      } else {
        // Continue searching
        queue.push({
          current: edge.to,
          hops: [...hops, current],
          score: newScore,
          depth: depth + 1,
        });
      }
    }
  }

  // Sort by trust score (highest first)
  return paths.sort((a, b) => b.trustScore - a.trustScore);
}

/**
 * Get suggested follows based on Web of Trust
 * Suggests peers with high trust paths but not yet followed
 */
export async function getWoTSuggestedFollows(
  limit: number = 10,
  minTrustScore: number = 0.3
): Promise<{ peerID: string; trustScore: number; path: TrustPath }[]> {
  const myPeer = await getPeerID();
  const following = await getFollowingList();

  // Get all peers we have trust paths to
  const candidates = await getAllKnownPeers();
  const suggestions: { peerID: string; trustScore: number; path: TrustPath }[] = [];

  for (const peer of candidates) {
    if (peer === myPeer || following.includes(peer)) continue;

    const paths = await findTrustPaths(myPeer, peer, 3);
    if (paths.length > 0 && paths[0].trustScore >= minTrustScore) {
      suggestions.push({
        peerID: peer,
        trustScore: paths[0].trustScore,
        path: paths[0],
      });
    }
  }

  // Sort by trust score and return top N
  return suggestions
    .sort((a, b) => b.trustScore - a.trustScore)
    .slice(0, limit);
}

/**
 * Get bridge suggestions - peers who can connect isolated clusters
 * Useful for expanding network reach
 */
export async function getBridgeSuggestions(limit: number = 5): Promise<Profile[]> {
  const myPeer = await getPeerID();
  const following = await getFollowingList();

  // Find peers who are followed by multiple people we trust
  const bridgeScores = new Map<string, number>();

  for (const followee of following) {
    const connections = await getTrustedConnections(followee);
    for (const edge of connections) {
      if (edge.to !== myPeer && !following.includes(edge.to)) {
        const current = bridgeScores.get(edge.to) || 0;
        bridgeScores.set(edge.to, current + edge.score);
      }
    }
  }

  // Convert to array and sort
  const bridges = Array.from(bridgeScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([peerID]) => peerID);

  // Get profiles for bridge peers
  const profiles: Profile[] = [];
  for (const peerID of bridges) {
    const profile = await getProfile(peerID);
    if (profile) profiles.push(profile);
  }

  return profiles;
}

/**
 * Record an interaction for reputation tracking
 */
export async function recordInteraction(
  peerID: string,
  type: Interaction['type'],
  weight?: number
): Promise<void> {
  const db = await getIndexedDB();
  const interactionWeight = weight ?? INTERACTION_WEIGHTS[type];

  await db
    .transaction('interactions', 'readwrite')
    .objectStore('interactions')
    .put({
      peerID,
      type,
      timestamp: Date.now(),
      weight: interactionWeight,
    });
}

// Trust-related helper functions
async function getTrustedConnections(peerID: string): Promise<TrustEdge[]> {
  // Get follows from this peer with trust scores
  const following = await getFollowingList();
  const edges: TrustEdge[] = [];

  for (const followee of following) {
    const rep = await computeReputation(followee);
    const isMutual = await isFollowing(peerID); // Simplified - check if followee follows back

    edges.push({
      from: peerID,
      to: followee,
      score: rep.score,
      mutualFollows: isMutual,
      timestamp: Date.now(),
    });
  }

  return edges;
}

export async function getAllKnownPeers(): Promise<string[]> {
  // Get peers from DHT queries, interactions, etc.
  // Placeholder - would aggregate from various sources
  return [];
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
