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

const INTERACTION_WEIGHTS: Record<string, number> = {
  chat: 1.0,
  post: 0.5,
  follow: 0.3,
  tip: 2.0,
  court: 1.5,
  delegation: 0.8,
};

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

interface TrustPath {
  source: string;
  target: string;
  hops: string[];
  depth: number;
  confidence: number;
}

export class ReputationScorer {
  private config: typeof DEFAULT_CONFIG;
  private interactions: Map<string, Interaction[]> = new Map();
  private firstSeen: Map<string, number> = new Map();
  private follows: Map<string, Set<string>> = new Map();
  private hasStake: Set<string> = new Set();

  constructor(config: ReputationScorerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  recordInteraction(interaction: Interaction): void {
    const { peerID } = interaction;

    if (!this.interactions.has(peerID)) {
      this.interactions.set(peerID, []);
    }
    if (!this.firstSeen.has(peerID)) {
      this.firstSeen.set(peerID, Date.now());
    }

    const peerInteractions = this.interactions.get(peerID)!;
    peerInteractions.push(interaction);

    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    this.interactions.set(
      peerID,
      peerInteractions.filter((i) => i.timestamp > oneYearAgo)
    );
  }

  recordFollow(follower: string, followee: string): void {
    if (!this.follows.has(follower)) {
      this.follows.set(follower, new Set());
    }
    this.follows.get(follower)!.add(followee);
  }

  setStakeStatus(peerID: string, hasStake: boolean): void {
    hasStake ? this.hasStake.add(peerID) : this.hasStake.delete(peerID);
  }

  computeReputation(peerID: string): ReputationResult {
    const peerInteractions = this.interactions.get(peerID) || [];
    const firstSeen = this.firstSeen.get(peerID) || Date.now();

    const scoredInteractions = peerInteractions.map((interaction) => ({
      score: (INTERACTION_WEIGHTS[interaction.type] || 0.5) * interaction.weight,
      timestamp: interaction.timestamp,
    }));

    const rawScore = computeDecayedScore(scoredInteractions, this.config.halfLifeDays);
    const bootstrapBonus = computeBootstrapBonus(firstSeen);
    const boostedScore = rawScore * bootstrapBonus;

    const following = this.follows.get(peerID) || new Set();
    let mutualFollows = 0;
    for (const followee of following) {
      const followeeFollows = this.follows.get(followee) || new Set();
      if (followeeFollows.has(peerID)) {
        mutualFollows++;
      }
    }

    const finalScore = Math.min(
      this.config.maxReputationScore,
      boostedScore + mutualFollows * this.config.mutualFollowBonus
    );

    const interactionTypes = new Set(peerInteractions.map((i) => i.type));
    const uniquePeers = new Set(peerInteractions.map((i) => i.peerID)).size;
    const sybilResistance = computeSybilResistance(
      peerID,
      firstSeen,
      interactionTypes,
      uniquePeers,
      this.hasStake.has(peerID)
    );

    return {
      peerID,
      rawScore,
      decayedScore: finalScore,
      halfLifeDays: this.config.halfLifeDays,
      mutualFollows,
      interactionCount: peerInteractions.length,
      recentInteractions: getInteractionsInWindow(peerInteractions, 30).length,
      bootstrapBonus,
      sybilResistance,
    };
  }

  computeTrustScore(peerID: string, fromPeer: string, wotWeight: number = 0.3): TrustScore {
    const reputation = this.computeReputation(peerID);
    const directTrust = reputation.decayedScore / 100;

    const following = this.follows.get(fromPeer) || new Set();
    const peerFollows = this.follows.get(peerID) || new Set();
    const mutualFollowBonus = following.has(peerID) && peerFollows.has(fromPeer) ? 0.1 : 0;

    const stakeBonus = this.hasStake.has(peerID) ? 0.1 : 0;
    const indirectTrust = this.computeIndirectTrust(fromPeer, peerID);

    const firstSeen = this.firstSeen.get(peerID) || Date.now();
    const ageDays = (Date.now() - firstSeen) / (1000 * 60 * 60 * 24);
    const sybilCap = Math.min(1, ageDays / 30);

    const total = directTrust * (1 - wotWeight) + indirectTrust * wotWeight + mutualFollowBonus + stakeBonus;

    return {
      directTrust,
      indirectTrust,
      mutualFollowBonus,
      stakeBonus,
      sybilCap,
      total: Math.min(1, total),
    };
  }

  private computeIndirectTrust(fromPeer: string, targetPeer: string): number {
    const paths = this.findTrustPaths(fromPeer, targetPeer, 3);
    if (paths.length === 0) return 0;

    const weightedTrust = paths.reduce(
      (sum, path) => sum + path.confidence * (1 / path.depth),
      0
    );

    return Math.min(1, weightedTrust / paths.length);
  }

  findTrustPaths(source: string, target: string, maxDepth: number = 3): TrustPath[] {
    if (source === target) {
      return [{ source, target, hops: [], depth: 0, confidence: 1.0 }];
    }

    const paths: TrustPath[] = [];
    const queue: Array<{ peer: string; path: string[]; depth: number }> = [
      { peer: source, path: [], depth: 0 },
    ];
    const visited = new Set<string>([source]);

    while (queue.length > 0 && paths.length < 10) {
      const { peer, path, depth } = queue.shift()!;
      if (depth >= maxDepth) continue;

      const following = this.follows.get(peer) || new Set();

      for (const nextPeer of following) {
        if (visited.has(nextPeer)) continue;

        const newPath = [...path, peer];
        const newDepth = depth + 1;

        if (nextPeer === target) {
          const sourceRep = this.computeReputation(source).decayedScore / 100;
          paths.push({
            source,
            target,
            hops: newPath,
            depth: newDepth,
            confidence: sourceRep * 0.8 ** newDepth,
          });
        } else {
          visited.add(nextPeer);
          queue.push({ peer: nextPeer, path: newPath, depth: newDepth });
        }
      }
    }

    return paths;
  }

  getReputationTrend(peerID: string): 'increasing' | 'stable' | 'decreasing' {
    const peerInteractions = this.interactions.get(peerID) || [];
    return computeReputationTrend(peerInteractions, 30);
  }

  getWeightedInteractionCount(peerID: string, windowDays: number = 30): number {
    const peerInteractions = this.interactions.get(peerID) || [];
    return computeWeightedInteractionCount(peerInteractions, windowDays);
  }

  clear(): void {
    this.interactions.clear();
    this.firstSeen.clear();
    this.follows.clear();
    this.hasStake.clear();
  }

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

    this.firstSeen.clear();
    for (const [peerID, interactions] of this.interactions.entries()) {
      if (interactions.length > 0) {
        this.firstSeen.set(peerID, Math.min(...interactions.map((i) => i.timestamp)));
      }
    }
  }
}
