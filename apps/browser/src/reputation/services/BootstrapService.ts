/**
 * Bootstrap Service
 *
 * Manages bootstrap bonus for new users to help them establish presence.
 */

import { REPUTATION_CONSTANTS } from '../config/reputationConfig.js';

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
    bootstrapPeriodDays: number
  ): number {
    const now = Date.now();
    const bootstrapPeriodMs = bootstrapPeriodDays * 24 * 60 * 60 * 1000;
    const age = now - firstInteractionTimestamp;

    if (age >= bootstrapPeriodMs) {
      return 0;
    }

    // Linear decay from MAX_BOOTSTRAP_BONUS to 0 over bootstrap period
    const remainingRatio = 1 - age / bootstrapPeriodMs;
    return REPUTATION_CONSTANTS.MAX_BOOTSTRAP_BONUS * remainingRatio;
  }
}
