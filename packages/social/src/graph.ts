/**
 * Graph Service for Social Relationships
 *
 * Manages follow relationships, trust scoring, reputation, and peer suggestions.
 * Storage and network are injected via adapters.
 */

import type { SocialStorage, SocialIdentity, SocialNetwork } from './adapters/interfaces';
import type { Interaction, FollowSubscription, ProfileSummary } from './types';
import { computeDecayedScore, DECAY_HALF_LIFE_DAYS } from '@isc/core/reputation';
import { SybilResistanceService } from '@isc/core/reputation';

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

      const subscription: FollowSubscription = { followee, since: timestamp };
      await storage.saveFollowing(new Set([followee]));

      // Record as interaction
      const interactionWeights: Record<string, number> = { follow: 1 };
      const weight = interactionWeights.follow ?? 1;
      await storage.saveInteraction({
        id: `interaction_${crypto.randomUUID()}`,
        peerID: followee,
        type: 'follow',
        timestamp,
        weight,
      });

      // Announce to network
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
      // This requires querying the DHT or maintaining a follower index
      // For now, return a stub that would need network adapter extension
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
      const interactionWeights: Record<string, number> = {
        follow: 1,
        like: 0.5,
        reply: 1.5,
        repost: 1,
      };

      await storage.saveInteraction({
        id: `interaction_${crypto.randomUUID()}`,
        peerID,
        type,
        timestamp: Date.now(),
        weight: weight ?? interactionWeights[type] ?? 1,
      });
    },

    async getInteractionHistory(peerID: string): Promise<Interaction[]> {
      return storage.getInteractions(peerID);
    },

    async computeReputation(peerID: string, halfLifeDays: number = DECAY_HALF_LIFE_DAYS): Promise<ReputationResult> {
      const interactions = await storage.getInteractions(peerID);
      const decayedInteractions = interactions.map((i) => ({
        ...i,
        decayedWeight: computeDecayedScore(i, halfLifeDays),
      }));

      const baseScore = decayedInteractions.reduce((sum, i) => sum + i.decayedWeight, 0);
      const followees = await this.getFollowees();
      const mutualFollows = (await Promise.all(followees.map((f) => this.isFollowing(f)))).filter(Boolean).length;

      const mutualFollowBonus = Math.min(mutualFollows * 0.05, 0.4);

      return {
        peerID,
        score: Math.min(Math.log2(baseScore + 1) / 10 + mutualFollowBonus, 1.0),
        halfLifeDays,
        mutualFollows,
        interactionHistory: interactions,
        decayedScore: baseScore,
      };
    },

    async computeTrustScore(targetPeer: string): Promise<TrustScore> {
      const following = await this.isFollowing(targetPeer);
      const directTrust = following ? 0.5 : 0;

      const followees = await this.getFollowees();
      const indirectCount = followees.filter((f) => f !== targetPeer).length;
      const indirectTrust = Math.min(indirectCount * 0.03, 0.3);
      const mutualFollowBonus = following ? 0.2 : 0;

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
      // Full WoT path finding would require graph traversal
      // For now, stub implementation
      return [];
    },

    async getWoTSuggestedFollows(
      _limit: number = 10,
      _minTrustScore: number = 0.3
    ): Promise<FollowSuggestion[]> {
      // Would require full WoT calculation
      return [];
    },

    async getSuggestedFollows(limit: number = 10): Promise<FollowSuggestion[]> {
      const myFollowees = await this.getFollowees();
      const suggestions = new Map<string, { count: number; peerID: string }>();

      // Find people followed by people I follow
      for (const followee of myFollowees) {
        const theirFollowees = await this.getFolloweesOf(followee);
        for (const theirFollowee of theirFollowees) {
          // Skip if already following or self
          if (theirFollowee === followee || (await this.isFollowing(theirFollowee))) {
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
          reason:
            count === 1
              ? 'Followed by someone you follow'
              : `Followed by ${count} people you follow`,
        }))
        .sort((a, b) => b.mutualFollows - a.mutualFollows)
        .slice(0, limit);
    },

    async getFolloweesOf(peerID: string): Promise<string[]> {
      // Query DHT or network for this peer's follow announcements
      if (network) {
        const subscriptions = await network.queryFollows(peerID);
        return subscriptions.map((s) => s.followee);
      }
      // Fallback to local storage if network available
      return [];
    },

    async getInteractionBasedSuggestions(limit: number = 5): Promise<FollowSuggestion[]> {
      const allInteractions = await storage.getAllInteractions();

      // Group by peer and count interactions
      const peerCounts = new Map<string, number>();
      for (const interaction of allInteractions) {
        const count = peerCounts.get(interaction.peerID) || 0;
        peerCounts.set(interaction.peerID, count + 1);
      }

      // Filter out already following and self
      const myFollowees = await this.getFollowees();
      const mySelf = await identity.getPeerId();
      const suggestions = Array.from(peerCounts.entries())
        .filter(([peerID]) => !myFollowees.includes(peerID) && peerID !== mySelf)
        .map(([peerID, count]) => ({
          peerID,
          score: Math.log(count + 1) * 0.2, // Log scale to prevent spam
          mutualFollows: 0,
          reason: `You've interacted ${count} times`,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return suggestions;
    },

    async getAllFollowSuggestions(limit: number = 20): Promise<FollowSuggestion[]> {
      const [mutualSuggestions, interactionSuggestions] = await Promise.all([
        this.getSuggestedFollows(Math.floor(limit * 0.6)),
        this.getInteractionBasedSuggestions(Math.floor(limit * 0.4)),
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
    },

    async getBridgeSuggestions(_limit: number = 5): Promise<BridgeProfile[]> {
      // Would require community detection and bridge centrality analysis
      return [];
    },

    async getProfile(peerID: string): Promise<ProfileSummary | null> {
      const profile = await storage.getProfile(peerID);
      if (profile) return profile;

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
