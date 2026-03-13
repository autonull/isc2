/**
 * Sybil Resistance Service
 *
 * Applies Sybil resistance caps to prevent reputation manipulation.
 */

import type { DecayConfig } from '../types/reputation.js';
import { REPUTATION_CONFIG, REPUTATION_CONSTANTS } from '../config/reputationConfig.js';

export class SybilResistanceService {
  /**
   * Apply Sybil resistance cap to reputation score
   *
   * Limits the impact of potential Sybil attacks by capping
   * certain reputation components.
   */
  static applySybilResistance(
    rawScore: number,
    mutualFollowCount: number,
    config: DecayConfig = REPUTATION_CONFIG
  ): number {
    // Cap mutual follow contribution
    const mutualFollowBonus = Math.min(
      mutualFollowCount * REPUTATION_CONSTANTS.MUTUAL_FOLLOW_BONUS_PER,
      REPUTATION_CONSTANTS.MUTUAL_FOLLOW_CAP
    );

    // Apply Sybil cap to prevent runaway reputation
    const sybilLimitedScore = Math.min(
      rawScore,
      config.sybilCap + mutualFollowBonus
    );

    return sybilLimitedScore;
  }

  /**
   * Calculate mutual follow bonus
   */
  static calculateMutualFollowBonus(mutualFollowCount: number): number {
    return Math.min(
      mutualFollowCount * REPUTATION_CONSTANTS.MUTUAL_FOLLOW_BONUS_PER,
      REPUTATION_CONSTANTS.MUTUAL_FOLLOW_CAP
    );
  }
}
