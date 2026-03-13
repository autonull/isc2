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
} from './types/reputation.js';

export {
  REPUTATION_CONFIG,
  INTERACTION_WEIGHTS,
  REPUTATION_CONSTANTS,
  REPUTATION_STORES,
} from './config/reputationConfig.js';

export { DecayCalculator } from './services/DecayCalculator.js';
export { BootstrapService } from './services/BootstrapService.js';
export { SybilResistanceService } from './services/SybilResistanceService.js';
export { ReputationCache } from './services/ReputationCache.js';
export { InteractionService } from './services/InteractionService.js';
export { ReputationService } from './services/ReputationService.js';

// Re-export main functions for backward compatibility
import type { DecayReputation, DecayConfig, DecayCurvePoint } from './types/reputation.js';
import { REPUTATION_CONFIG } from './config/reputationConfig.js';
import { ReputationService } from './services/ReputationService.js';
import { InteractionService } from './services/InteractionService.js';
import { DecayCalculator } from './services/DecayCalculator.js';
import { BootstrapService } from './services/BootstrapService.js';
import { SybilResistanceService } from './services/SybilResistanceService.js';
import { ReputationCache } from './services/ReputationCache.js';

/**
 * Calculate exponential decay factor
 */
export function calculateDecayFactor(ageInDays: number, halfLifeDays: number): number {
  return DecayCalculator.calculateDecayFactor(ageInDays, halfLifeDays);
}

/**
 * Apply decay to an interaction
 */
export function applyDecayToInteraction(
  timestamp: number,
  baseWeight: number,
  halfLifeDays: number = 30
): { decayedWeight: number; ageInDays: number; decayFactor: number } {
  return DecayCalculator.applyDecay(timestamp, baseWeight, halfLifeDays);
}

/**
 * Check if within bootstrap period
 */
export function isWithinBootstrapPeriod(
  firstInteractionTimestamp: number,
  bootstrapPeriodDays: number = 7
): boolean {
  return BootstrapService.isWithinBootstrapPeriod(
    firstInteractionTimestamp,
    bootstrapPeriodDays
  );
}

/**
 * Calculate bootstrap bonus
 */
export function calculateBootstrapBonus(
  firstInteractionTimestamp: number,
  config: DecayConfig = REPUTATION_CONFIG
): number {
  return BootstrapService.calculateBootstrapBonus(
    firstInteractionTimestamp,
    config.bootstrapPeriodDays
  );
}

/**
 * Apply Sybil resistance
 */
export function applySybilResistance(
  rawScore: number,
  mutualFollowCount: number,
  config: DecayConfig = REPUTATION_CONFIG
): number {
  return SybilResistanceService.applySybilResistance(
    rawScore,
    mutualFollowCount,
    config
  );
}

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
  return DecayCalculator.timeToReachScore(currentScore, targetScore, halfLifeDays);
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
