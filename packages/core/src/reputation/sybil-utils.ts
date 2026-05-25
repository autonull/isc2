/* eslint-disable */
/**
 * Sybil Resistance Service for Reputation System
 *
 * Applies Sybil resistance caps to prevent reputation manipulation.
 */

export const SYBIL_CONSTANTS: SybilConfig = {
  sybilCap: 0.3,
  mutualFollowCap: 0.4,
  mutualFollowBonusPerFollow: 0.05,
} as const;

export interface SybilConfig {
  sybilCap: number;
  mutualFollowCap: number;
  mutualFollowBonusPerFollow: number;
}

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
    config: SybilConfig = SYBIL_CONSTANTS
  ): number {
    // Cap mutual follow contribution
    const mutualFollowBonus = Math.min(
      mutualFollowCount * config.mutualFollowBonusPerFollow,
      config.mutualFollowCap
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
  static calculateMutualFollowBonus(
    mutualFollowCount: number,
    config: SybilConfig = SYBIL_CONSTANTS
  ): number {
    return Math.min(
      mutualFollowCount * config.mutualFollowBonusPerFollow,
      config.mutualFollowCap
    );
  }
}
