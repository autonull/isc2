/* eslint-disable */
/**
 * Reputation Module
 *
 * Time-weighted reputation decay with Sybil resistance.
 * References: NEXT_STEPS.md#61-time-weighted-reputation-decay
 */

export {
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
} from './decay.ts';

export type {
  DecayInteraction,
  DecayReputation,
  DecayConfig,
} from './decay.ts';
