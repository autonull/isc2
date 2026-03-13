/**
 * Reputation Service
 *
 * Main service for computing and managing reputation scores with decay.
 */

import { getInteractionHistory } from '../../social/graph.js';
import type { DecayReputation, DecayConfig, DecayCurvePoint } from '../types/reputation.js';
import { REPUTATION_CONFIG } from '../config/reputationConfig.js';
import { DecayCalculator } from './DecayCalculator.js';
import { BootstrapService } from './BootstrapService.js';
import { SybilResistanceService } from './SybilResistanceService.js';
import { ReputationCache } from './ReputationCache.js';

export class ReputationService {
  /**
   * Compute time-weighted reputation with decay
   */
  static async computeReputation(
    peerID: string,
    config: DecayConfig = REPUTATION_CONFIG
  ): Promise<DecayReputation> {
    const interactions = await getInteractionHistory(peerID);

    if (interactions.length === 0) {
      return {
        peerID,
        rawScore: 0,
        decayedScore: 0,
        bootstrapBonus: 0,
        sybilAdjustedScore: 0,
        halfLifeDays: config.halfLifeDays,
        lastUpdated: Date.now(),
        interactionCount: 0,
        decayCurve: [],
      };
    }

    // Find first interaction for bootstrap calculation
    const firstInteraction = interactions.reduce(
      (min, i) => (i.timestamp < min.timestamp ? i : min),
      interactions[0]
    );

    // Apply decay to all interactions
    const decayCurve = DecayCalculator.applyDecayToCurve(
      interactions,
      config.halfLifeDays
    );

    // Calculate raw and decayed scores
    const rawScore = interactions.reduce((sum, i) => sum + i.weight, 0);
    const decayedScore = decayCurve.reduce((sum, i) => sum + i.decayedWeight, 0);

    // Calculate bootstrap bonus for new users
    const bootstrapBonus = BootstrapService.calculateBootstrapBonus(
      firstInteraction.timestamp,
      config.bootstrapPeriodDays
    );

    // Apply Sybil resistance
    const mutualFollowCount = 0; // Would be computed from social graph
    const sybilAdjustedScore = SybilResistanceService.applySybilResistance(
      decayedScore,
      mutualFollowCount,
      config
    );

    // Add bootstrap bonus (capped at MAX_FINAL_SCORE total)
    const finalScore = Math.min(
      sybilAdjustedScore + bootstrapBonus,
      0.5
    );

    return {
      peerID,
      rawScore,
      decayedScore,
      bootstrapBonus,
      sybilAdjustedScore: finalScore,
      halfLifeDays: config.halfLifeDays,
      lastUpdated: Date.now(),
      interactionCount: interactions.length,
      decayCurve,
    };
  }

  /**
   * Compute reputation with caching
   */
  static async computeReputationCached(
    peerID: string,
    config: DecayConfig = REPUTATION_CONFIG,
    forceRefresh: boolean = false
  ): Promise<DecayReputation> {
    if (!forceRefresh) {
      const cached = await ReputationCache.get(peerID);
      if (cached) return cached;
    }

    const reputation = await this.computeReputation(peerID, config);
    await ReputationCache.cache(peerID, reputation);

    return reputation;
  }

  /**
   * Get effective reputation for access control
   */
  static async getEffectiveReputation(
    peerID: string,
    config: DecayConfig = REPUTATION_CONFIG
  ): Promise<number> {
    const reputation = await this.computeReputationCached(peerID, config);
    return reputation.sybilAdjustedScore;
  }

  /**
   * Check if peer meets minimum reputation threshold
   */
  static async meetsThreshold(
    peerID: string,
    threshold: number,
    config: DecayConfig = REPUTATION_CONFIG
  ): Promise<boolean> {
    const reputation = await this.getEffectiveReputation(peerID, config);
    return reputation >= threshold;
  }

  /**
   * Get reputation decay curve for visualization
   */
  static async getDecayCurve(
    peerID: string,
    daysToProject: number = 30,
    config: DecayConfig = REPUTATION_CONFIG
  ): Promise<DecayCurvePoint[]> {
    const reputation = await this.computeReputationCached(peerID, config);

    return DecayCalculator.projectDecayCurve(
      reputation.decayedScore,
      config.halfLifeDays,
      daysToProject
    );
  }

  /**
   * Calculate time until reputation reaches target score
   */
  static timeToReachScore(
    currentScore: number,
    targetScore: number,
    halfLifeDays: number = 30
  ): number {
    return DecayCalculator.timeToReachScore(currentScore, targetScore, halfLifeDays);
  }
}
