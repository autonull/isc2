/* eslint-disable */
/**
 * Bootstrap Service for Reputation System
 *
 * Manages bootstrap bonus for new users to help them establish presence.
 */

export const BOOTSTRAP_CONSTANTS = {
  MAX_BOOTSTRAP_BONUS: 0.2,
} as const;

export interface BootstrapConfig {
  maxBootstrapBonus: number;
}

export class BootstrapService {
  /**
   * Check if a peer is within the bootstrap period (new user)
   */
  static isWithinBootstrapPeriod(
    firstInteractionTimestamp: number,
    bootstrapPeriodDays: number
  ): boolean {
    const now = Date.now();
    const bootstrapPeriodMs = bootstrapPeriodDays * 24 * 60 * 60 * 1000;
    return now - firstInteractionTimestamp < bootstrapPeriodMs;
  }

  /**
   * Calculate bootstrap bonus for new users
   *
   * New users get a temporary reputation boost that decays linearly
   * over the bootstrap period.
   */
  static calculateBootstrapBonus(
    firstInteractionTimestamp: number,
    bootstrapPeriodDays: number,
    maxBonus: number = BOOTSTRAP_CONSTANTS.MAX_BOOTSTRAP_BONUS
  ): number {
    const now = Date.now();
    const bootstrapPeriodMs = bootstrapPeriodDays * 24 * 60 * 60 * 1000;
    const age = now - firstInteractionTimestamp;

    if (age >= bootstrapPeriodMs) {
      return 0;
    }

    // Linear decay from maxBonus to 0 over bootstrap period
    const remainingRatio = 1 - age / bootstrapPeriodMs;
    return maxBonus * remainingRatio;
  }
}
