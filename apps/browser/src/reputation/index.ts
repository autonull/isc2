/**
 * Reputation Module
 *
 * Time-weighted reputation decay with Sybil resistance.
 * References: NEXT_STEPS.md#61-time-weighted-reputation-decay
 */

export {
  calculateDecayFactor,
  applyDecayToInteraction,
  isWithinBootstrapPeriod,
  calculateBootstrapBonus,
  applySybilResistance,
  computeDecayedReputation,
  getReputationDecayCurve,
  getInteractionWeight,
  recordWeightedInteraction,
  getEffectiveReputation,
  meetsReputationThreshold,
  timeToReachScore,
  getHalfLifeDays,
  computeReputationCached,
  cacheReputationScore,
  getCachedReputationScore,
} from './decay.js';

export type {
  DecayInteraction,
  DecayReputation,
  DecayConfig,
} from './decay.js';
