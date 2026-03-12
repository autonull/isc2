/**
 * Reputation Scorer
 * 
 * Computes comprehensive reputation scores based on:
 * - Direct interaction history
 * - Time-decay weighting
 * - Mutual follows
 * - Web of Trust propagation
 * - Sybil resistance factors
 */

import type { Interaction, ReputationResult, TrustScore } from './types.js';
import {
  computeDecayedScore,
  computeBootstrapBonus,
  computeSybilResistance,
  computeWeightedInteractionCount,
  getInteractionsInWindow,
  computeReputationTrend,
  BOOTSTRAP_PERIOD_DAYS,
} from './decay.js';

/**
 * Interaction type weights
 */
const INTERACTION_WEIGHTS: Record<string, number> = {
  chat: 1.0,        // Direct conversation
  post: 0.5,        // Content creation
  follow: 0.3,      // Social connection
  tip: 2.0,         // Economic signal (high weight)
  court: 1.5,       // Civic participation
  delegation: 0.8,  // Technical contribution
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  halfLifeDays: 30,
  bootstrapPeriodDays: BOOTSTRAP_PERIOD_DAYS,
  maxReputationScore: 100,
  minInteractionsForTrust: 3,
  mutualFollowBonus: 10,
};

export interface ReputationScorerConfig {
  halfLifeDays?: number;
  bootstrapPeriodDays?: number;
  maxReputationScore?: number;
  minInteractionsForTrust?: number;
  mutualFollowBonus?: number;
}

/**
 * Reputation Scorer class
 */
export class ReputationScorer {
  private config: typeof DEFAULT_CONFIG;
  private interactions: Map<string, Interaction[]> = new Map();
  private firstSeen: Map<string, number> = new Map();
  private follows: Map<string, Set<string>> = new Map();
  private hasStake: Set<string> = new Set();

  constructor(config: ReputationScorerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Record an interaction
   */
  recordInteraction(interaction: Interaction): void {
    const { peerID } = interaction;

    // Initialize if needed
    if (!this.interactions.has(peerID)) {
      this.interactions.set(peerID, []);
    }
    if (!this.firstSeen.has(peerID)) {
      this.firstSeen.set(peerID, Date.now());
    }

    // Add interaction
    const peerInteractions = this.interactions.get(peerID)!;
    peerInteractions.push(interaction);

    // Keep only last 365 days of interactions
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = peerInteractions.filter((i) => i.timestamp > oneYearAgo);
    this.interactions.set(peerID, filtered);
  }

  /**
   * Record a follow relationship
   */
  recordFollow(follower: string, followee: string): void {
    if (!this.follows.has(follower)) {
      this.follows.set(follower, new Set());
    }
    this.follows.get(follower)!.add(followee);
  }

  /**
   * Set stake status for a peer
   */
  setStakeStatus(peerID: string, hasStake: boolean): void {
    if (hasStake) {
      this.hasStake.add(peerID);
    } else {
      this.hasStake.delete(peerID);
    }
  }

  /**
   * Compute reputation for a peer
   */
  computeReputation(peerID: string): ReputationResult {
    const peerInteractions = this.interactions.get(peerID) || [];
    const firstSeen = this.firstSeen.get(peerID) || Date.now();

    // Compute raw score from interactions
    const scoredInteractions = peerInteractions.map((interaction) => ({
      score: (INTERACTION_WEIGHTS[interaction.type] || 0.5) * interaction.weight,
      timestamp: interaction.timestamp,
    }));

    const rawScore = computeDecayedScore(
      scoredInteractions,
      this.config.halfLifeDays
    );

    // Apply bootstrap bonus for new peers
    const bootstrapBonus = computeBootstrapBonus(firstSeen);
    const boostedScore = rawScore * bootstrapBonus;

    // Count mutual follows
    const following = this.follows.get(peerID) || new Set();
    let mutualFollows = 0;
    for (const followee of following) {
      const followeeFollows = this.follows.get(followee) || new Set();
      if (followeeFollows.has(peerID)) {
        mutualFollows++;
      }
    }

    // Apply mutual follow bonus
    const finalScore = Math.min(
      this.config.maxReputationScore,
      boostedScore + mutualFollows * this.config.mutualFollowBonus
    );

    // Compute Sybil resistance
    const interactionTypes = new Set(peerInteractions.map((i) => i.type));
    const uniquePeers = new Set(peerInteractions.map((i) => i.peerID)).size;
    const sybilResistance = computeSybilResistance(
      peerID,
      firstSeen,
      interactionTypes,
      uniquePeers,
      this.hasStake.has(peerID)
    );

    // Get recent interactions count
    const recentInteractions = getInteractionsInWindow(peerInteractions, 30).length;

    return {
      peerID,
      rawScore,
      decayedScore: finalScore,
      halfLifeDays: this.config.halfLifeDays,
      mutualFollows,
      interactionCount: peerInteractions.length,
      recentInteractions,
      bootstrapBonus,
      sybilResistance,
    };
  }

  /**
   * Compute trust score including Web of Trust
   */
  computeTrustScore(
    peerID: string,
    fromPeer: string,
    wotWeight: number = 0.3
  ): TrustScore {
    // Direct trust from reputation
    const reputation = this.computeReputation(peerID);
    const directTrust = reputation.decayedScore / 100;

    // Mutual follow bonus
    const following = this.follows.get(fromPeer) || new Set();
    const peerFollows = this.follows.get(peerID) || new Set();
    let mutualFollowBonus = 0;
    if (following.has(peerID) && peerFollows.has(fromPeer)) {
      mutualFollowBonus = 0.1;
    }

    // Stake bonus
    const stakeBonus = this.hasStake.has(peerID) ? 0.1 : 0;

    // Web of Trust (indirect trust)
    const indirectTrust = this.computeIndirectTrust(fromPeer, peerID);

    // Sybil cap for new peers
    const firstSeen = this.firstSeen.get(peerID) || Date.now();
    const ageDays = (Date.now() - firstSeen) / (1000 * 60 * 60 * 24);
    const sybilCap = Math.min(1, ageDays / 30);

    // Weighted combination
    const total =
      directTrust * (1 - wotWeight) +
      indirectTrust * wotWeight +
      mutualFollowBonus +
      stakeBonus;

    return {
      directTrust,
      indirectTrust,
      mutualFollowBonus,
      stakeBonus,
      sybilCap,
      total: Math.min(1, total),
    };
  }

  /**
   * Compute indirect trust via Web of Trust
   */
  private computeIndirectTrust(fromPeer: string, targetPeer: string): number {
    // Find trust paths
    const paths = this.findTrustPaths(fromPeer, targetPeer, 3);

    if (paths.length === 0) {
      return 0;
    }

    // Weight paths by confidence and length
    const weightedTrust = paths.reduce((sum, path) => {
      // Shorter paths are more trusted
      const lengthWeight = 1 / path.depth;
      return sum + path.confidence * lengthWeight;
    }, 0);

    // Normalize
    return Math.min(1, weightedTrust / paths.length);
  }

  /**
   * Find trust paths between peers (simplified BFS)
   */
  findTrustPaths(
    source: string,
    target: string,
    maxDepth: number = 3
  ): Array<{
    source: string;
    target: string;
    hops: string[];
    depth: number;
    confidence: number;
  }> {
    // Edge case: same peer
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

    const paths: Array<{
      source: string;
      target: string;
      hops: string[];
      depth: number;
      confidence: number;
    }> = [];

    // BFS to find paths
    const queue: Array<{ peer: string; path: string[]; depth: number }> = [
      { peer: source, path: [], depth: 0 },
    ];
    const visited = new Set<string>([source]);

    while (queue.length > 0 && paths.length < 10) {
      const { peer, path, depth } = queue.shift()!;

      if (depth >= maxDepth) {
        continue;
      }

      // Get peers that this peer follows
      const following = this.follows.get(peer) || new Set();

      for (const nextPeer of following) {
        if (visited.has(nextPeer)) {
          continue;
        }

        const newPath = [...path, peer];
        const newDepth = depth + 1;

        if (nextPeer === target) {
          // Found a path
          const sourceRep = this.computeReputation(source).decayedScore / 100;
          paths.push({
            source,
            target,
            hops: newPath,
            depth: newDepth,
            confidence: sourceRep * (0.8 ** newDepth),
          });
        } else {
          visited.add(nextPeer);
          queue.push({ peer: nextPeer, path: newPath, depth: newDepth });
        }
      }
    }

    return paths;
  }

  /**
   * Get reputation trend for a peer
   */
  getReputationTrend(peerID: string): 'increasing' | 'stable' | 'decreasing' {
    const peerInteractions = this.interactions.get(peerID) || [];
    return computeReputationTrend(peerInteractions, 30);
  }

  /**
   * Get weighted interaction count
   */
  getWeightedInteractionCount(peerID: string, windowDays: number = 30): number {
    const peerInteractions = this.interactions.get(peerID) || [];
    return computeWeightedInteractionCount(peerInteractions, windowDays);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.interactions.clear();
    this.firstSeen.clear();
    this.follows.clear();
    this.hasStake.clear();
  }

  /**
   * Export state for persistence
   */
  export(): {
    interactions: Map<string, Interaction[]>;
    follows: Map<string, string[]>;
    hasStake: string[];
  } {
    const followsExport = new Map<string, string[]>();
    for (const [peer, followSet] of this.follows.entries()) {
      followsExport.set(peer, Array.from(followSet));
    }

    return {
      interactions: this.interactions,
      follows: followsExport,
      hasStake: Array.from(this.hasStake),
    };
  }

  /**
   * Import state from persistence
   */
  import(state: {
    interactions: Map<string, Interaction[]>;
    follows: Map<string, string[]>;
    hasStake: string[];
  }): void {
    this.interactions = state.interactions;
    
    this.follows = new Map();
    for (const [peer, followList] of state.follows.entries()) {
      this.follows.set(peer, new Set(followList));
    }
    
    this.hasStake = new Set(state.hasStake);
    
    // Rebuild firstSeen from interactions
    this.firstSeen.clear();
    for (const [peerID, interactions] of this.interactions.entries()) {
      if (interactions.length > 0) {
        const earliest = Math.min(...interactions.map((i) => i.timestamp));
        this.firstSeen.set(peerID, earliest);
      }
    }
  }
}
