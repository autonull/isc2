/* eslint-disable */
/**
 * Reputation Configuration
 */

import type { DecayConfig, InteractionWeightConfig } from '../types/reputation.ts';

export const REPUTATION_CONFIG: DecayConfig = {
  halfLifeDays: 30,
  bootstrapPeriodDays: 7,
  sybilCap: 0.3,
  minInteractions: 3,
} as const;

export const INTERACTION_WEIGHTS: InteractionWeightConfig = {
  follow: 5,
  repost: 3,
  reply: 2,
  quote: 2,
  like: 1,
} as const;

export const REPUTATION_CONSTANTS = {
  BOOTSTRAP_PERIOD_MS: 7 * 24 * 60 * 60 * 1000,
  DEFAULT_HALF_LIFE_MS: 30 * 24 * 60 * 60 * 1000,
  SYBIL_CAP: 0.3,
  MUTUAL_FOLLOW_CAP: 0.4,
  MUTUAL_FOLLOW_BONUS_PER: 0.05,
  MAX_BOOTSTRAP_BONUS: 0.2,
  MAX_FINAL_SCORE: 0.5,
  CACHE_EXPIRY_MS: 60 * 60 * 1000,
} as const;

export const REPUTATION_STORES = {
  SCORES: 'reputation_scores',
} as const;
