/* eslint-disable */
/**
 * Graph Service for Social Relationships
 *
 * Manages follow relationships, trust scoring, reputation, and peer suggestions.
 */

import { computeDecayedScore, DECAY_HALF_LIFE_DAYS, SybilResistanceService } from '@isc/core/reputation';
import type { SocialStorage, SocialIdentity, SocialNetwork } from './adapters/interfaces';
import type { Interaction, ProfileSummary } from './types';

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

const INTERACTION_WEIGHTS = {
  follow: 1,
  like: 0.5,
  reply: 1.5,
  repost: 1,
} as const;

const TRUST_CONSTANTS = {
  directTrust: 0.5,
  mutualFollowBonus: 0.2,
  indirectMultiplier: 0.03,
  indirectCap: 0.3,
  suggestionScoreMultiplier: 0.3,
  mutualFollowWeight: 0.05,
  mutualFollowCap: 0.4,
} as const;

/**
 * Compute confidence score for a trust path.
 * Shorter paths with more mutual connections score higher.
 */
function computePathConfidence(hops: string[], _target: string): number {
  const pathLength = hops.length;
  // Base confidence decays exponentially with path length
  const lengthScore = Math.pow(0.7, pathLength - 1);
  // Cap at 1.0
  return Math.min(lengthScore, 1.0);
}

export interface GraphService {
  followUser(followee: string): Promise<void>;
  unfollowUser(followee: string): Promise<void>;
  getFollowees(): Promise<string[]>;
  isFollowing(followee: string): Promise<boolean>;
  getFollowerCount(peerID: string): Promise<number>;
  getFollowingCount(peerID: string): Promise<number>;
  recordInteraction(peerID: string, type: string, weight?: number): Promise<void>;
  getInteractionHistory(peerID: string): Promise<Interaction[]>;
  computeReputation(peerID: string, halfLifeDays?: number): Promise<ReputationResult>;
  computeTrustScore(targetPeer: string): Promise<TrustScore>;
  findTrustPaths(source: string, target: string, maxDepth?: number): Promise<Array<{ source: string; target: string; hops: string[]; depth: number; confidence: number }>>;
  getWoTSuggestedFollows(limit?: number, minTrustScore?: number): Promise<FollowSuggestion[]>;
  getSuggestedFollows(limit?: number): Promise<FollowSuggestion[]>;
  getFolloweesOf(peerID: string): Promise<string[]>;
  getInteractionBasedSuggestions(limit?: number): Promise<FollowSuggestion[]>;
  getAllFollowSuggestions(limit?: number): Promise<FollowSuggestion[]>;
  getBridgeSuggestions(limit?: number): Promise<BridgeProfile[]>;
  getProfile(peerID: string): Promise<ProfileSummary | null>;
  updateProfile(profile: ProfileSummary): Promise<void>;
}

export function createGraphService(
  storage: SocialStorage,
  identity: SocialIdentity,
  network?: SocialNetwork
): GraphService {
  return {
    async followUser(followee: string): Promise<void> {
      const follower = await identity.getPeerId();
      const timestamp = Date.now();

      await storage.saveFollowing(new Set([followee]));
      await storage.saveInteraction({
        id: `interaction_${crypto.randomUUID()}`,
        peerID: followee,
        type: 'follow',
        timestamp,
        weight: INTERACTION_WEIGHTS.follow,
      });

      if (network) {
        await network.announceFollow(follower, followee, timestamp);
      }
    },

    async unfollowUser(followee: string): Promise<void> {
      const following = await storage.getFollowing();
      following.delete(followee);
      await storage.saveFollowing(following);

      if (network) {
        const follower = await identity.getPeerId();
        await network.announceFollow(follower, followee, 0); // TTL 0 = delete
      }
    },

    async getFollowees(): Promise<string[]> {
      const following = await storage.getFollowing();
      return Array.from(following);
    },

    async isFollowing(followee: string): Promise<boolean> {
      const following = await storage.getFollowing();
      return following.has(followee);
    },

    async getFollowerCount(peerID: string): Promise<number> {
      const myPeerId = await identity.getPeerId();
      if (peerID === myPeerId) {
        // For ourselves, query DHT for follow announcements
        if (network) {
          try {
            const follows = await network.queryFollows(peerID);
            return follows.length;
          } catch {
            // Fall through to local count
          }
        }
        // Local count from interactions
        const allInteractions = await storage.getAllInteractions();
        return allInteractions.filter(
          (i) => i.type === 'follow' && i.peerID === peerID
        ).length;
      }
      // For other peers, would need network query
      return 0;
    },

    async getFollowingCount(peerID: string): Promise<number> {
      if (peerID === await identity.getPeerId()) {
        const following = await storage.getFollowing();
        return following.size;
      }
      // For other peers, would need network query
      return 0;
    },

    async recordInteraction(peerID: string, type: string, weight?: number): Promise<void> {
      await storage.saveInteraction({
        id: `interaction_${crypto.randomUUID()}`,
        peerID,
        type,
        timestamp: Date.now(),
        weight: weight ?? INTERACTION_WEIGHTS[type as keyof typeof INTERACTION_WEIGHTS] ?? 1,
      });
    },

    async getInteractionHistory(peerID: string): Promise<Interaction[]> {
      return storage.getInteractions(peerID);
    },

    async computeReputation(peerID: string, halfLifeDays: number = DECAY_HALF_LIFE_DAYS): Promise<ReputationResult> {
      const interactions = await storage.getInteractions(peerID);
      const decayedScore = interactions.reduce(
        (sum, i) => sum + computeDecayedScore([{ score: i.weight, timestamp: i.timestamp }], halfLifeDays),
        0
      );

      const followees = await this.getFollowees();
      const mutualFollows = (await Promise.all(followees.map((f) => this.isFollowing(f)))).filter(Boolean).length;
      const mutualFollowBonus = Math.min(
        mutualFollows * TRUST_CONSTANTS.mutualFollowWeight,
        TRUST_CONSTANTS.mutualFollowCap
      );

      return {
        peerID,
        score: Math.min(Math.log2(decayedScore + 1) / 10 + mutualFollowBonus, 1.0),
        halfLifeDays,
        mutualFollows,
        interactionHistory: interactions,
        decayedScore,
      };
    },

    async computeTrustScore(targetPeer: string): Promise<TrustScore> {
      const following = await this.isFollowing(targetPeer);
      const directTrust = following ? TRUST_CONSTANTS.directTrust : 0;
      const mutualFollowBonus = following ? TRUST_CONSTANTS.mutualFollowBonus : 0;

      const followees = await this.getFollowees();
      const indirectCount = followees.filter((f) => f !== targetPeer).length;
      const indirectTrust = Math.min(
        indirectCount * TRUST_CONSTANTS.indirectMultiplier,
        TRUST_CONSTANTS.indirectCap
      );

      const sybilCapped = SybilResistanceService.applySybilResistance(
        directTrust + indirectTrust,
        followees.length
      );

      return {
        directTrust,
        indirectTrust,
        mutualFollowBonus,
        sybilCap: 0.3,
        total: Math.min(sybilCapped + mutualFollowBonus, 1.0),
      };
    },

    async findTrustPaths(
      source: string,
      target: string,
      maxDepth: number = 3
    ): Promise<Array<{ source: string; target: string; hops: string[]; depth: number; confidence: number }>> {
      if (source === target) {
        return [{ source, target, hops: [], depth: 0, confidence: 1.0 }];
      }

      // BFS to find trust paths through follow relationships
      const results: Array<{ source: string; target: string; hops: string[]; depth: number; confidence: number }> = [];
      const visited = new Set<string>();
      const queue: Array<{ peer: string; path: string[] }> = [{ peer: source, path: [] }];

      while (queue.length > 0) {
        const { peer, path } = queue.shift()!;
        if (visited.has(peer)) {continue;}
        visited.add(peer);

        const followees = await this.getFolloweesOf(peer);
        const depth = path.length;

        for (const followee of followees) {
          if (followee === target) {
            // Found a path
            const confidence = computePathConfidence([...path, followee], target);
            results.push({
              source,
              target,
              hops: [...path, followee],
              depth: depth + 1,
              confidence,
            });
          } else if (depth < maxDepth - 1 && !visited.has(followee)) {
            queue.push({ peer: followee, path: [...path, followee] });
          }
        }
      }

      return results.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
    },

    getWoTSuggestedFollows(
      _limit: number = 10,
      _minTrustScore: number = 0.3
    ): Promise<FollowSuggestion[]> {
      // Would require full WoT calculation
      return Promise.resolve([]);
    },

    async getSuggestedFollows(limit: number = 10): Promise<FollowSuggestion[]> {
      const myFollowees = await this.getFollowees();
      const suggestions = new Map<string, number>();

      for (const followee of myFollowees) {
        const theirFollowees = await this.getFolloweesOf(followee);
        for (const candidate of theirFollowees) {
          if (candidate === followee || await this.isFollowing(candidate)) {continue;}
          suggestions.set(candidate, (suggestions.get(candidate) ?? 0) + 1);
        }
      }

      return Array.from(suggestions.entries())
        .map(([peerID, count]) => ({
          peerID,
          score: count * TRUST_CONSTANTS.suggestionScoreMultiplier,
          mutualFollows: count,
          reason: count === 1
            ? 'Followed by someone you follow'
            : `Followed by ${count} people you follow`,
        }))
        .sort((a, b) => b.mutualFollows - a.mutualFollows)
        .slice(0, limit);
    },

    async getFolloweesOf(peerID: string): Promise<string[]> {
      if (!network) {return [];}
      const subscriptions = await network.queryFollows(peerID);
      return subscriptions.map((s) => s.followee);
    },

    async getInteractionBasedSuggestions(limit: number = 5): Promise<FollowSuggestion[]> {
      const allInteractions = await storage.getAllInteractions();
      const peerCounts = new Map<string, number>();

      for (const { peerID } of allInteractions) {
        peerCounts.set(peerID, (peerCounts.get(peerID) ?? 0) + 1);
      }

      const myFollowees = await this.getFollowees();
      const mySelf = await identity.getPeerId();
      const followSet = new Set([...myFollowees, mySelf]);

      return Array.from(peerCounts.entries())
        .filter(([peerID]) => !followSet.has(peerID))
        .map(([peerID, count]) => ({
          peerID,
          score: Math.log(count + 1) * 0.2,
          mutualFollows: 0,
          reason: `You've interacted ${count} times`,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },

    async getAllFollowSuggestions(limit: number = 20): Promise<FollowSuggestion[]> {
      const [mutual, interaction] = await Promise.all([
        this.getSuggestedFollows(Math.floor(limit * 0.6)),
        this.getInteractionBasedSuggestions(Math.floor(limit * 0.4)),
      ]);

      const combined = new Map<string, FollowSuggestion>();

      for (const suggestion of [...mutual, ...interaction]) {
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
    },

    getBridgeSuggestions(_limit: number = 5): Promise<BridgeProfile[]> {
      // Would require community detection and bridge centrality analysis
      return Promise.resolve([]);
    },

    async getProfile(peerID: string): Promise<ProfileSummary | null> {
      const profile = await storage.getProfile(peerID);
      if (profile) {return profile;}

      const [followerCount, followingCount] = await Promise.all([
        this.getFollowerCount(peerID),
        this.getFollowingCount(peerID),
      ]);

      return {
        peerID,
        channelCount: 0,
        followerCount,
        followingCount,
        updatedAt: Date.now(),
      };
    },

    async updateProfile(profile: ProfileSummary): Promise<void> {
      await storage.saveProfile(profile);
    },
  };
}
