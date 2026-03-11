/**
 * Social Graph Service
 *
 * Handles follows, suggested follows, reputation, and Web of Trust.
 */

import { sign, encode, cosineSimilarity } from '@isc/core';
import type { FollowSubscription, ProfileSummary } from './types.js';
import { getPeerID, getKeypair, getPeerPublicKey } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbDelete, dbFilter } from '../db/helpers.js';

const FOLLOWS_STORE = 'follows';
const INTERACTIONS_STORE = 'interactions';
const PROFILES_STORE = 'profiles';
const DEFAULT_TTL = 86400 * 30; // 30 days

/** Default reputation half-life in days */
const DEFAULT_HALF_LIFE_DAYS = 30;

/** Interaction types with weights */
const INTERACTION_WEIGHTS: Record<string, number> = {
  follow: 5,
  like: 1,
  repost: 3,
  reply: 2,
  quote: 2,
  mutual_follow: 10,
};

/**
 * Interaction record for reputation tracking
 */
export interface Interaction {
  type: string;
  peerID: string;
  timestamp: number;
  weight: number;
}

/**
 * Reputation result with decay information
 */
export interface ReputationResult {
  peerID: string;
  score: number;
  halfLifeDays: number;
  mutualFollows: number;
  interactionHistory: Interaction[];
  decayedScore: number;
}

/**
 * Trust score components
 */
export interface TrustScore {
  directTrust: number;
  indirectTrust: number;
  mutualFollowBonus: number;
  sybilCap: number;
  total: number;
}

/**
 * Trust path for Web of Trust
 */
export interface TrustPath {
  source: string;
  target: string;
  hops: string[];
  depth: number;
  confidence: number;
}

/**
 * Follow suggestion with reasoning
 */
export interface FollowSuggestion {
  peerID: string;
  score: number;
  mutualFollows: number;
  reason: string;
}

/**
 * Bridge profile for cross-community connections
 */
export interface BridgeProfile {
  peerID: string;
  bridgeScore: number;
  communities: string[];
}

// ============================================================================
// Follow Management
// ============================================================================

/**
 * Follow a user
 */
export async function followUser(followee: string): Promise<void> {
  const follower = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const followEvent = {
    follower,
    followee,
    timestamp: Date.now(),
  };

  const payload = encode(followEvent);
  const signature = await sign(payload, keypair.privateKey);

  // Store locally
  const subscription: FollowSubscription = {
    followee,
    since: Date.now(),
  };
  await dbPut(FOLLOWS_STORE, subscription);

  // Record interaction for reputation
  await recordInteraction(followee, 'follow', INTERACTION_WEIGHTS.follow);

  // Announce to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/follow/${follower}/${followee}`;
    await client.announce(key, encode({ ...followEvent, signature }), DEFAULT_TTL);
  }
}

/**
 * Unfollow a user
 */
export async function unfollowUser(followee: string): Promise<void> {
  await dbDelete(FOLLOWS_STORE, followee);

  const client = DelegationClient.getInstance();
  if (client) {
    const follower = await getPeerID();
    const key = `/isc/follow/${follower}/${followee}`;
    await client.announce(key, new Uint8Array(), 0);
  }
}

/**
 * Get list of users being followed
 */
export async function getFollowees(): Promise<string[]> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.map((s) => s.followee);
}

/**
 * Check if following a user
 */
export async function isFollowing(followee: string): Promise<boolean> {
  const subscription = await dbGet<FollowSubscription>(FOLLOWS_STORE, followee);
  return subscription !== null;
}

/**
 * Get follower count for a user
 */
export async function getFollowerCount(peerID: string): Promise<number> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => s.followee === peerID).length;
}

/**
 * Get following count for a user
 */
export async function getFollowingCount(peerID: string): Promise<number> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => s.followee === peerID).length;
}

// ============================================================================
// Interaction Recording
// ============================================================================

/**
 * Record an interaction for reputation tracking
 */
export async function recordInteraction(
  peerID: string,
  type: string,
  weight: number = 1
): Promise<void> {
  const interaction: Interaction = {
    type,
    peerID,
    timestamp: Date.now(),
    weight: weight || INTERACTION_WEIGHTS[type] || 1,
  };

  const id = `interaction_${crypto.randomUUID()}`;
  await dbPut(INTERACTIONS_STORE, { ...interaction, id });
}

/**
 * Get interaction history for a peer
 */
export async function getInteractionHistory(peerID: string): Promise<Interaction[]> {
  return dbFilter<Interaction>(INTERACTIONS_STORE, (i) => i.peerID === peerID);
}

/**
 * Apply exponential decay to an interaction based on age
 */
export function applyDecay(interaction: Interaction, halfLifeDays: number): number {
  const now = Date.now();
  const ageMs = now - interaction.timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Exponential decay: weight * (0.5 ^ (ageDays / halfLifeDays))
  const decay = Math.pow(0.5, ageDays / halfLifeDays);
  return interaction.weight * decay;
}

// ============================================================================
// Reputation System
// ============================================================================

/**
 * Compute reputation score with time-decay
 *
 * Formula:
 * - Base score from decayed interactions
 * - Bonus for mutual follows (capped at 0.4)
 * - Normalized to [0, 1]
 */
export async function computeReputation(
  peerID: string,
  halfLifeDays: number = DEFAULT_HALF_LIFE_DAYS
): Promise<ReputationResult> {
  const interactions = await getInteractionHistory(peerID);

  // Apply decay to all interactions
  const decayedInteractions = interactions.map((i) => ({
    ...i,
    decayedWeight: applyDecay(i, halfLifeDays),
  }));

  // Sum decayed weights
  const baseScore = decayedInteractions.reduce((sum, i) => sum + i.decayedWeight, 0);

  // Count mutual follows
  const followees = await getFollowees();
  const mutualFollows = followees.filter((f) => isFollowing(f)).length;

  // Mutual follow bonus (capped at 0.4 to prevent Sybil attacks)
  const mutualFollowBonus = Math.min(mutualFollows * 0.05, 0.4);

  // Normalize score (log scale to prevent runaway reputation)
  const normalizedScore = Math.log2(baseScore + 1) / 10;
  const cappedScore = Math.min(normalizedScore + mutualFollowBonus, 1.0);

  return {
    peerID,
    score: cappedScore,
    halfLifeDays,
    mutualFollows,
    interactionHistory: interactions,
    decayedScore: baseScore,
  };
}

/**
 * Compute trust score with Web of Trust components
 */
export async function computeTrustScore(targetPeer: string): Promise<TrustScore> {
  const myID = await getPeerID();

  // Direct trust: do I follow them?
  const following = await isFollowing(targetPeer);
  const directTrust = following ? 0.5 : 0;

  // Indirect trust: do my followees follow them? (capped at 0.3)
  const followees = await getFollowees();
  let indirectCount = 0;
  for (const followee of followees) {
    // In real implementation, would check if followee follows targetPeer
    // For now, simplified heuristic
    if (followee !== targetPeer) {
      indirectCount++;
    }
  }
  const indirectTrust = Math.min(indirectCount * 0.03, 0.3);

  // Mutual follow bonus
  const mutualFollowBonus = following ? 0.2 : 0;

  // Sybil cap
  const sybilCap = 0.3;

  // Total (capped at 1.0)
  const total = Math.min(directTrust + indirectTrust + mutualFollowBonus, 1.0);

  return {
    directTrust,
    indirectTrust,
    mutualFollowBonus,
    sybilCap,
    total,
  };
}

/**
 * Find trust paths between two peers
 */
export async function findTrustPaths(
  source: string,
  target: string,
  maxDepth: number = 3
): Promise<TrustPath[]> {
  if (source === target) {
    return [
      {
        source,
        target,
        hops: [],
        depth: 0,
        confidence: 1.0,
      },
    ];
  }

  // In real implementation, would traverse the social graph
  // For now, return empty (no paths found without DHT queries)
  return [];
}

/**
 * Get Web of Trust suggested follows
 */
export async function getWoTSuggestedFollows(
  limit: number = 10,
  minTrustScore: number = 0.3
): Promise<FollowSuggestion[]> {
  const followees = await getFollowees();
  const suggestions: FollowSuggestion[] = [];

  // In real implementation, would:
  // 1. Get followers of my followees
  // 2. Compute trust scores
  // 3. Filter by minTrustScore
  // 4. Rank and return top N

  // Placeholder - return empty for now
  return suggestions.slice(0, limit);
}

/**
 * Get bridge suggestions (users who connect different communities)
 */
export async function getBridgeSuggestions(limit: number = 5): Promise<BridgeProfile[]> {
  // In real implementation, would analyze community membership patterns
  // For now, return empty
  return [];
}

// ============================================================================
// Profile Management
// ============================================================================

/**
 * Get profile summary for a peer
 */
export async function getProfile(peerID: string): Promise<ProfileSummary | null> {
  const profile = await dbGet<ProfileSummary>(PROFILES_STORE, peerID);
  if (profile) return profile;

  // Compute from available data
  const followerCount = await getFollowerCount(peerID);
  const followingCount = await getFollowingCount(peerID);

  return {
    peerID,
    channelCount: 0,
    followerCount,
    followingCount,
    updatedAt: Date.now(),
  };
}

/**
 * Update profile cache
 */
export async function updateProfile(profile: ProfileSummary): Promise<void> {
  await dbPut(PROFILES_STORE, profile);
}

// ============================================================================
// Chaos Mode (Serendipity)
// ============================================================================

/**
 * Apply chaos mode perturbation to embedding for serendipity
 */
export function applyChaosMode(embedding: number[], chaosLevel: number): number[] {
  if (chaosLevel <= 0) return embedding;

  // Add random perturbation
  const perturbed = embedding.map((v) => {
    const noise = (Math.random() - 0.5) * 2 * chaosLevel;
    return v + noise;
  });

  // Re-normalize to unit vector
  const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return embedding;

  return perturbed.map((v) => v / norm);
}

/**
 * Get suggested follows based on mutual connections
 */
export async function getSuggestedFollows(limit: number = 10): Promise<string[]> {
  const followees = await getFollowees();

  // In real implementation, would:
  // 1. Get followers of people you follow
  // 2. Count mutual connections
  // 3. Rank by mutual count
  // 4. Exclude people you already follow

  return [];
}
