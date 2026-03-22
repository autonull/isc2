import { sign, encode, Config, Validators, type Signature, applyDecay, type Interaction } from '@isc/core';
import type { FollowSubscription, ProfileSummary } from './types.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbDelete, dbFilter } from '../db/helpers.js';

export type { Interaction };

const FOLLOWS_STORE = 'follows';
const INTERACTIONS_STORE = 'interactions';
const PROFILES_STORE = 'profiles';
const DEFAULT_TTL = 86400 * 30;

export interface ReputationResult {
  peerID: string;
  score: number;
  halfLifeDays: number;
  mutualFollows: number;
  interactionHistory: Interaction[];
  decayedScore: number;
}

export interface TrustScore {
  directTrust: number;
  indirectTrust: number;
  mutualFollowBonus: number;
  sybilCap: number;
  total: number;
}

export interface FollowSuggestion {
  peerID: string;
  score: number;
  mutualFollows: number;
  reason: string;
}

export interface BridgeProfile {
  peerID: string;
  bridgeScore: number;
  communities: string[];
}

async function announceFollowEvent(
  follower: string,
  followee: string,
  event: object,
  signature: Signature
): Promise<void> {
  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(`/isc/follow/${follower}/${followee}`, encode({ ...event, signature }), DEFAULT_TTL);
  }
}

export async function followUser(followee: string): Promise<void> {
  const follower = await getPeerID();
  const keypair = getKeypair();
  Validators.keypair(keypair);

  const { follow } = Config.social.reputation.interactionWeights;
  const timestamp = Date.now();
  const signature = await sign(encode({ follower, followee, timestamp }), keypair.privateKey);

  await Promise.all([
    dbPut(FOLLOWS_STORE, { followee, since: timestamp } as FollowSubscription),
    recordInteraction(followee, 'follow', follow),
    announceFollowEvent(follower, followee, { follower, followee, timestamp }, signature),
  ]);
}

export async function unfollowUser(followee: string): Promise<void> {
  await dbDelete(FOLLOWS_STORE, followee);

  const client = DelegationClient.getInstance();
  if (client) {
    const follower = await getPeerID();
    await client.announce(`/isc/follow/${follower}/${followee}`, new Uint8Array(), 0);
  }
}

export async function getFollowees(): Promise<string[]> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.map((s) => s.followee);
}

export async function isFollowing(followee: string): Promise<boolean> {
  return (await dbGet<FollowSubscription>(FOLLOWS_STORE, followee)) !== null;
}

export async function getFollowerCount(peerID: string): Promise<number> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => s.followee === peerID).length;
}

export async function getFollowingCount(peerID: string): Promise<number> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => s.followee === peerID).length;
}

export async function recordInteraction(
  peerID: string,
  type: string,
  weight?: number
): Promise<void> {
  const { interactionWeights } = Config.social.reputation;
  await dbPut(INTERACTIONS_STORE, {
    type,
    peerID,
    timestamp: Date.now(),
    weight: weight ?? interactionWeights[type as keyof typeof interactionWeights] ?? 1,
    id: `interaction_${crypto.randomUUID()}`,
  });
}

export async function getInteractionHistory(peerID: string): Promise<Interaction[]> {
  return dbFilter<Interaction>(INTERACTIONS_STORE, (i) => i.peerID === peerID);
}

export async function computeReputation(
  peerID: string,
  halfLifeDays: number = Config.social.reputation.halfLifeDays
): Promise<ReputationResult> {
  const interactions = await getInteractionHistory(peerID);
  const decayedInteractions = interactions.map((i) => ({
    ...i,
    decayedWeight: applyDecay(i, halfLifeDays),
  }));

  const baseScore = decayedInteractions.reduce((sum, i) => sum + i.decayedWeight, 0);
  const followees = await getFollowees();
  const mutualFollows = (await Promise.all(followees.map(isFollowing))).filter(Boolean).length;
  const mutualFollowBonus = Math.min(mutualFollows * 0.05, 0.4);

  return {
    peerID,
    score: Math.min(Math.log2(baseScore + 1) / 10 + mutualFollowBonus, 1.0),
    halfLifeDays,
    mutualFollows,
    interactionHistory: interactions,
    decayedScore: baseScore,
  };
}

export async function computeTrustScore(targetPeer: string): Promise<TrustScore> {
  const following = await isFollowing(targetPeer);
  const directTrust = following ? 0.5 : 0;

  const followees = await getFollowees();
  const indirectCount = followees.filter((f) => f !== targetPeer).length;
  const indirectTrust = Math.min(indirectCount * 0.03, 0.3);
  const mutualFollowBonus = following ? 0.2 : 0;

  return {
    directTrust,
    indirectTrust,
    mutualFollowBonus,
    sybilCap: 0.3,
    total: Math.min(directTrust + indirectTrust + mutualFollowBonus, 1.0),
  };
}

export async function findTrustPaths(
  source: string,
  target: string,
  maxDepth: number = 3
): Promise<Array<{ source: string; target: string; hops: string[]; depth: number; confidence: number }>> {
  if (source === target) {
    return [{ source, target, hops: [], depth: 0, confidence: 1.0 }];
  }
  return [];
}

export async function getWoTSuggestedFollows(
  _limit: number = 10,
  _minTrustScore: number = 0.3
): Promise<FollowSuggestion[]> {
  return [];
}

/**
 * Get suggested follows based on mutual connections
 */
export async function getSuggestedFollows(limit: number = 10): Promise<FollowSuggestion[]> {
  const myFollowees = await getFollowees();
  const suggestions = new Map<string, { count: number; peerID: string }>();

  // Find people followed by people I follow
  for (const followee of myFollowees) {
    const theirFollowees = await getFolloweesOf(followee);
    for (const theirFollowee of theirFollowees) {
      // Skip if already following or self
      if (theirFollowee === followee || await isFollowing(theirFollowee)) {
        continue;
      }

      const existing = suggestions.get(theirFollowee) || { count: 0, peerID: theirFollowee };
      suggestions.set(theirFollowee, {
        count: existing.count + 1,
        peerID: theirFollowee,
      });
    }
  }

  // Convert to suggestions and sort by mutual count
  return Array.from(suggestions.values())
    .map(({ count, peerID }) => ({
      peerID,
      score: count * 0.3, // Each mutual connection adds 0.3 to score
      mutualFollows: count,
      reason: count === 1 
        ? 'Followed by someone you follow' 
        : `Followed by ${count} people you follow`,
    }))
    .sort((a, b) => b.mutualFollows - a.mutualFollows)
    .slice(0, limit);
}

/**
 * Get all followees of a peer
 */
async function getFolloweesOf(peerID: string): Promise<string[]> {
  // Query DHT for this peer's follow announcements
  // In production, would use: `/isc/follow/${peerID}/*`
  // For now, return from local storage (limited to local view)
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.map(s => s.followee);
}

/**
 * Get follow suggestions based on interaction history
 */
export async function getInteractionBasedSuggestions(limit: number = 5): Promise<FollowSuggestion[]> {
  const allInteractions = await dbGetAll<Interaction>(INTERACTIONS_STORE);
  
  // Group by peer and count interactions
  const peerCounts = new Map<string, number>();
  for (const interaction of allInteractions) {
    const count = peerCounts.get(interaction.peerID) || 0;
    peerCounts.set(interaction.peerID, count + 1);
  }

  // Filter out already following and self
  const myFollowees = await getFollowees();
  const suggestions = Array.from(peerCounts.entries())
    .filter(([peerID]) => !myFollowees.includes(peerID))
    .map(([peerID, count]) => ({
      peerID,
      score: Math.log(count + 1) * 0.2, // Log scale to prevent spam
      mutualFollows: 0,
      reason: `You've interacted ${count} times`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return suggestions;
}

/**
 * Get combined follow suggestions from all sources
 */
export async function getAllFollowSuggestions(limit: number = 20): Promise<FollowSuggestion[]> {
  const [mutualSuggestions, interactionSuggestions] = await Promise.all([
    getSuggestedFollows(Math.floor(limit * 0.6)),
    getInteractionBasedSuggestions(Math.floor(limit * 0.4)),
  ]);

  // Combine and deduplicate
  const combined = new Map<string, FollowSuggestion>();
  
  for (const suggestion of [...mutualSuggestions, ...interactionSuggestions]) {
    const existing = combined.get(suggestion.peerID);
    if (existing) {
      // Merge scores
      existing.score += suggestion.score;
      existing.reason = `${existing.reason}; ${suggestion.reason}`;
    } else {
      combined.set(suggestion.peerID, suggestion);
    }
  }

  return Array.from(combined.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function getBridgeSuggestions(_limit: number = 5): Promise<BridgeProfile[]> {
  return [];
}

export async function getProfile(peerID: string): Promise<ProfileSummary | null> {
  const profile = await dbGet<ProfileSummary>(PROFILES_STORE, peerID);
  if (profile) return profile;

  const [followerCount, followingCount] = await Promise.all([
    getFollowerCount(peerID),
    getFollowingCount(peerID),
  ]);

  return {
    peerID,
    channelCount: 0,
    followerCount,
    followingCount,
    updatedAt: Date.now(),
  };
}

export async function updateProfile(profile: ProfileSummary): Promise<void> {
  await dbPut(PROFILES_STORE, profile);
}

export function applyChaosMode(embedding: number[], chaosLevel: number): number[] {
  if (chaosLevel <= 0) return embedding;

  const perturbed = embedding.map((v) => v + (Math.random() - 0.5) * 2 * chaosLevel);
  const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? embedding : perturbed.map((v) => v / norm);
}
