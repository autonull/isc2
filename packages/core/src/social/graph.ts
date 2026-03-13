/**
 * Social Graph - Follow system and reputation
 *
 * Environment-agnostic follow management and reputation calculation.
 */

import { sign, encode, Config, type Signature } from '../index.js';
import type { FollowSubscription, ProfileSummary, FollowSuggestion } from './types.js';

/**
 * Storage adapter for social graph data
 */
export interface GraphStorage {
  getFollows(): Promise<FollowSubscription[]>;
  saveFollow(follow: FollowSubscription): Promise<void>;
  deleteFollow(followee: string): Promise<void>;
  getInteractions(): Promise<Interaction[]>;
  saveInteraction(interaction: Interaction): Promise<void>;
  getProfiles(): Promise<ProfileSummary[]>;
  saveProfile(profile: ProfileSummary): Promise<void>;
}

/**
 * Identity provider interface
 */
export interface GraphIdentity {
  getPeerID(): Promise<string>;
  getKeypair(): { publicKey: CryptoKey; privateKey: CryptoKey } | null;
}

/**
 * Network adapter for DHT announcements
 */
export interface GraphNetwork {
  announce(key: string, value: Uint8Array, ttl: number): Promise<void>;
  getInstance(): GraphNetwork | null;
}

/**
 * Interaction with weight and decay
 */
export interface Interaction {
  type: string;
  peerID: string;
  timestamp: number;
  weight: number;
  id?: string;
}

/**
 * Reputation calculation result
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
 * Trust score for Web of Trust
 */
export interface TrustScore {
  directTrust: number;
  indirectTrust: number;
  mutualFollowBonus: number;
  sybilCap: number;
  total: number;
}

export type { FollowSuggestion } from './types.js';

/**
 * Follow a user
 */
export async function followUser(
  followee: string,
  storage: GraphStorage,
  identity: GraphIdentity,
  network?: GraphNetwork | null
): Promise<void> {
  const follower = await identity.getPeerID();
  const keypair = identity.getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const { follow } = Config.social.reputation.interactionWeights;
  const timestamp = Date.now();
  const signature = await sign(encode({ follower, followee, timestamp }), keypair.privateKey);

  const followSub: FollowSubscription = { followee, since: timestamp };

  await Promise.all([
    storage.saveFollow(followSub),
    recordInteraction(followee, 'follow', follow, storage),
    announceFollowEvent(follower, followee, { follower, followee, timestamp }, signature, network),
  ]);
}

/**
 * Unfollow a user
 */
export async function unfollowUser(
  followee: string,
  storage: GraphStorage,
  identity?: GraphIdentity,
  network?: GraphNetwork | null
): Promise<void> {
  await storage.deleteFollow(followee);

  if (identity && network) {
    const follower = await identity.getPeerID();
    await network.announce(`/isc/follow/${follower}/${followee}`, new Uint8Array(), 0);
  }
}

/**
 * Get list of followees
 */
export async function getFollowees(storage: GraphStorage): Promise<string[]> {
  const subscriptions = await storage.getFollows();
  return subscriptions.map((s) => s.followee);
}

/**
 * Check if following a user
 */
export async function isFollowing(
  followee: string,
  storage: GraphStorage
): Promise<boolean> {
  const subscriptions = await storage.getFollows();
  return subscriptions.some((s) => s.followee === followee);
}

/**
 * Get follower count
 */
export async function getFollowerCount(
  peerID: string,
  storage: GraphStorage
): Promise<number> {
  const subscriptions = await storage.getFollows();
  return subscriptions.filter((s) => s.followee === peerID).length;
}

/**
 * Get following count
 */
export async function getFollowingCount(
  peerID: string,
  storage: GraphStorage
): Promise<number> {
  const subscriptions = await storage.getFollows();
  return subscriptions.filter((s) => s.followee === peerID).length;
}

/**
 * Record an interaction
 */
export async function recordInteraction(
  peerID: string,
  type: string,
  weight: number,
  storage: GraphStorage
): Promise<void> {
  await storage.saveInteraction({
    type,
    peerID,
    timestamp: Date.now(),
    weight,
    id: `interaction_${crypto.randomUUID()}`,
  });
}

/**
 * Get interaction history for a peer
 */
export async function getInteractionHistory(
  peerID: string,
  storage: GraphStorage
): Promise<Interaction[]> {
  const interactions = await storage.getInteractions();
  return interactions.filter((i) => i.peerID === peerID);
}

/**
 * Apply time decay to interaction weight
 */
export function applyDecay(interaction: Interaction, halfLifeDays: number): number {
  const ageDays = (Date.now() - interaction.timestamp) / (1000 * 60 * 60 * 24);
  return interaction.weight * 0.5 ** (ageDays / halfLifeDays);
}

/**
 * Compute reputation score with decay
 */
export async function computeReputation(
  peerID: string,
  storage: GraphStorage,
  halfLifeDays: number = Config.social.reputation.halfLifeDays
): Promise<ReputationResult> {
  const interactions = await getInteractionHistory(peerID, storage);
  const decayedInteractions = interactions.map((i) => ({
    ...i,
    decayedWeight: applyDecay(i, halfLifeDays),
  }));

  const baseScore = decayedInteractions.reduce((sum, i) => sum + i.decayedWeight, 0);
  const followees = await getFollowees(storage);
  const mutualFollows = (await Promise.all(
    followees.map(f => isFollowing(f, storage))
  )).filter(Boolean).length;
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

/**
 * Compute trust score for Web of Trust
 */
export async function computeTrustScore(
  targetPeer: string,
  storage: GraphStorage
): Promise<TrustScore> {
  const following = await isFollowing(targetPeer, storage);
  const directTrust = following ? 0.5 : 0;

  const followees = await getFollowees(storage);
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

/**
 * Get suggested follows based on mutual connections
 */
export async function getSuggestedFollows(
  storage: GraphStorage,
  limit: number = 10
): Promise<FollowSuggestion[]> {
  const myFollowees = await getFollowees(storage);
  const suggestions = new Map<string, { count: number; peerID: string }>();

  for (const followee of myFollowees) {
    const theirFollowees = await getFollowees(storage);
    for (const theirFollowee of theirFollowees) {
      if (theirFollowee === followee || await isFollowing(theirFollowee, storage)) {
        continue;
      }

      const existing = suggestions.get(theirFollowee) || { count: 0, peerID: theirFollowee };
      suggestions.set(theirFollowee, {
        count: existing.count + 1,
        peerID: theirFollowee,
      });
    }
  }

  return Array.from(suggestions.values())
    .map(({ count, peerID }) => ({
      peerID,
      score: count * 0.3,
      mutualFollows: count,
      reason: count === 1
        ? 'Followed by someone you follow'
        : `Followed by ${count} people you follow`,
    }))
    .sort((a, b) => b.mutualFollows - a.mutualFollows)
    .slice(0, limit);
}

/**
 * Get follow suggestions based on interaction history
 */
export async function getInteractionBasedSuggestions(
  storage: GraphStorage,
  limit: number = 5
): Promise<FollowSuggestion[]> {
  const allInteractions = await storage.getInteractions();

  const peerCounts = new Map<string, number>();
  for (const interaction of allInteractions) {
    const count = peerCounts.get(interaction.peerID) || 0;
    peerCounts.set(interaction.peerID, count + 1);
  }

  const myFollowees = await getFollowees(storage);
  const suggestions = Array.from(peerCounts.entries())
    .filter(([peerID]) => !myFollowees.includes(peerID))
    .map(([peerID, count]) => ({
      peerID,
      score: Math.log(count + 1) * 0.2,
      mutualFollows: 0,
      reason: `You've interacted ${count} times`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return suggestions;
}

/**
 * Get combined follow suggestions
 */
export async function getAllFollowSuggestions(
  storage: GraphStorage,
  limit: number = 20
): Promise<FollowSuggestion[]> {
  const [mutualSuggestions, interactionSuggestions] = await Promise.all([
    getSuggestedFollows(storage, Math.floor(limit * 0.6)),
    getInteractionBasedSuggestions(storage, Math.floor(limit * 0.4)),
  ]);

  const combined = new Map<string, FollowSuggestion>();

  for (const suggestion of [...mutualSuggestions, ...interactionSuggestions]) {
    const existing = combined.get(suggestion.peerID);
    if (existing) {
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

/**
 * Announce follow event to DHT
 */
async function announceFollowEvent(
  follower: string,
  followee: string,
  event: object,
  signature: Signature,
  network?: GraphNetwork | null
): Promise<void> {
  if (network) {
    await network.announce(
      `/isc/follow/${follower}/${followee}`,
      encode({ ...event, signature }),
      86400 * 30
    );
  }
}

/**
 * Graph service class for convenience
 */
export class GraphService {
  constructor(
    private storage: GraphStorage,
    private identity: GraphIdentity,
    private network?: GraphNetwork | null
  ) {}

  async follow(followee: string): Promise<void> {
    return followUser(followee, this.storage, this.identity, this.network);
  }

  async unfollow(followee: string): Promise<void> {
    return unfollowUser(followee, this.storage, this.identity, this.network);
  }

  async getFollowees(): Promise<string[]> {
    return getFollowees(this.storage);
  }

  async isFollowing(followee: string): Promise<boolean> {
    return isFollowing(followee, this.storage);
  }

  async getFollowerCount(peerID: string): Promise<number> {
    return getFollowerCount(peerID, this.storage);
  }

  async getFollowingCount(peerID: string): Promise<number> {
    return getFollowingCount(peerID, this.storage);
  }

  async computeReputation(peerID: string): Promise<ReputationResult> {
    return computeReputation(peerID, this.storage);
  }

  async computeTrustScore(targetPeer: string): Promise<TrustScore> {
    return computeTrustScore(targetPeer, this.storage);
  }

  async getSuggestions(limit?: number): Promise<FollowSuggestion[]> {
    return getAllFollowSuggestions(this.storage, limit);
  }
}
