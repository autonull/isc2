/* eslint-disable */
/**
 * Time-Weighted Reputation Decay
 *
 * Implements exponential decay for reputation scores with configurable half-life.
 * Recent interactions contribute more to reputation than older ones.
 *
 * References: NEXT_STEPS.md#61-time-weighted-reputation-decay
 *
 * Facade module re-exporting reputation functionality.
 */

export type {
  DecayInteraction,
  DecayReputation,
  DecayConfig,
  DecayCurvePoint,
} from './types/reputation.ts';

export {
  REPUTATION_CONFIG,
  INTERACTION_WEIGHTS,
  REPUTATION_CONSTANTS,
  REPUTATION_STORES,
} from './config/reputationConfig.ts';

export { ReputationService } from './services/ReputationService.ts';
export { InteractionService } from './services/InteractionService.ts';
export { ReputationCache } from './services/ReputationCache.ts';

// Core math re-exports for testing compatibility
import { DecayCalculator, BootstrapService, SybilResistanceService } from '@isc/core';

export const calculateDecayFactor = DecayCalculator.calculateDecayFactor.bind(DecayCalculator);

// Create an adapter wrapper for applyDecayToInteraction to match the test signature
export const applyDecayToInteraction = (timestamp: number, baseWeight: number, halfLifeDays: number) => {
  return DecayCalculator.applyDecay(timestamp, baseWeight, halfLifeDays);
};

export const isWithinBootstrapPeriod = BootstrapService.isWithinBootstrapPeriod.bind(BootstrapService);
// Adapt arguments for tests which pass config object instead of just bootstrapPeriodDays
export const calculateBootstrapBonus = (firstInteractionTimestamp: number, configOrPeriod: any) => {
  const period = typeof configOrPeriod === 'object' ? configOrPeriod.bootstrapPeriodDays : configOrPeriod;
  // If period is not provided, use default from REPUTATION_CONFIG (7 days)
  return BootstrapService.calculateBootstrapBonus(firstInteractionTimestamp, period || REPUTATION_CONFIG.bootstrapPeriodDays);
};

export const applySybilResistance = (baseScore: number, mutualFollows: number, config?: any) => {
  const c = {
    sybilCap: config?.sybilCap ?? REPUTATION_CONFIG.sybilCap,
    mutualFollowCap: config?.mutualFollowCap ?? 0.4,
    mutualFollowBonusPerFollow: config?.mutualFollowBonusPerFollow ?? 0.05
  };
  return SybilResistanceService.applySybilResistance(baseScore, mutualFollows, c);
};

// Re-export main functions for backward compatibility
import type { DecayReputation, DecayConfig, DecayCurvePoint } from './types/reputation.ts';
import { REPUTATION_CONFIG } from './config/reputationConfig.ts';
import { ReputationService } from './services/ReputationService.ts';
import { InteractionService } from './services/InteractionService.ts';
import { ReputationCache } from './services/ReputationCache.ts';

/**
 * Compute time-weighted reputation with decay
 */
export async function computeDecayedReputation(
  peerID: string,
  config: DecayConfig = REPUTATION_CONFIG
): Promise<DecayReputation> {
  return ReputationService.computeReputation(peerID, config);
}

/**
 * Get reputation decay curve
 */
export async function getReputationDecayCurve(
  peerID: string,
  daysToProject: number = 30,
  config: DecayConfig = REPUTATION_CONFIG
): Promise<DecayCurvePoint[]> {
  return ReputationService.getDecayCurve(peerID, daysToProject, config);
}

/**
 * Get interaction weight by type
 */
export function getInteractionWeight(type: string): number {
  return InteractionService.getWeight(type);
}

/**
 * Record weighted interaction
 */
export async function recordWeightedInteraction(
  peerID: string,
  type: string,
  customWeight?: number
): Promise<void> {
  return InteractionService.record(peerID, type, customWeight);
}

/**
 * Get effective reputation
 */
export async function getEffectiveReputation(
  peerID: string,
  config: DecayConfig = REPUTATION_CONFIG
): Promise<number> {
  return ReputationService.getEffectiveReputation(peerID, config);
}

/**
 * Check if meets reputation threshold
 */
export async function meetsReputationThreshold(
  peerID: string,
  threshold: number,
  config: DecayConfig = REPUTATION_CONFIG
): Promise<boolean> {
  return ReputationService.meetsThreshold(peerID, threshold, config);
}

/**
 * Compute reputation with caching
 */
export async function computeReputationCached(
  peerID: string,
  config: DecayConfig = REPUTATION_CONFIG,
  forceRefresh: boolean = false
): Promise<DecayReputation> {
  return ReputationService.computeReputationCached(peerID, config, forceRefresh);
}

/**
 * Get half-life in days
 */
export function getHalfLifeDays(config: DecayConfig = REPUTATION_CONFIG): number {
  return config.halfLifeDays;
}

/**
 * Calculate time to reach score
 */
export function timeToReachScore(
  currentScore: number,
  targetScore: number,
  halfLifeDays: number = 30
): number {
  if (currentScore <= targetScore || currentScore <= 0 || targetScore <= 0) return 0;
  return halfLifeDays * Math.log2(currentScore / targetScore);
}

/**
 * Cache reputation score
 */
export async function cacheReputationScore(
  peerID: string,
  reputation: DecayReputation
): Promise<void> {
  return ReputationCache.cache(peerID, reputation);
}

/**
 * Get cached reputation score
 */
export async function getCachedReputationScore(
  peerID: string
): Promise<DecayReputation | null> {
  return ReputationCache.get(peerID);
}
