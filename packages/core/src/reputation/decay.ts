/**
 * Time-Decay Functions for Reputation
 * 
 * Implements exponential decay with configurable half-life.
 * Reputation scores decay over time to reflect recent behavior.
 */

import type { Interaction } from './types.js';

/**
 * Default half-life: 30 days
 * After 30 days, reputation contribution is halved
 */
export const DECAY_HALF_LIFE_DAYS = 30;

/**
 * Minimum reputation score (prevents negative scores)
 */
export const MIN_REPUTATION_SCORE = 0;

/**
 * Maximum reputation score
 */
export const MAX_REPUTATION_SCORE = 100;

/**
 * Bootstrap period: new peers get bonus for first 7 days
 */
export const BOOTSTRAP_PERIOD_DAYS = 7;

/**
 * Bootstrap bonus multiplier (1.5x for first 7 days)
 */
export const BOOTSTRAP_BONUS = 1.5;

/**
 * Compute decay factor for a given timestamp
 * 
 * @param timestamp - Unix timestamp of the event
 * @param halfLifeDays - Half-life in days (default: 30)
 * @returns Decay factor (0-1)
 */
export function computeDecayFactor(
  timestamp: number,
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number {
  const now = Date.now();
  const ageMs = now - timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Exponential decay: factor = 0.5^(age/halfLife)
  const factor = Math.pow(0.5, ageDays / halfLifeDays);
  
  return factor;
}

/**
 * Compute decayed score for a single interaction
 * 
 * @param baseScore - Base score of the interaction
 * @param timestamp - When the interaction occurred
 * @param halfLifeDays - Half-life in days
 * @returns Decayed score
 */
export function computeDecayedInteractionScore(
  baseScore: number,
  timestamp: number,
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number {
  const factor = computeDecayFactor(timestamp, halfLifeDays);
  return baseScore * factor;
}

/**
 * Compute total decayed score from multiple interactions
 * 
 * @param interactions - Array of interactions with scores
 * @param halfLifeDays - Half-life in days
 * @returns Total decayed score (0-100)
 */
export function computeDecayedScore(
  interactions: Array<{ score: number; timestamp: number }>,
  halfLifeDays: number = DECAY_HALF_LIFE_DAYS
): number {
  if (interactions.length === 0) {
    return 0;
  }
  
  const totalScore = interactions.reduce((sum, interaction) => {
    const decayed = computeDecayedInteractionScore(
      interaction.score,
      interaction.timestamp,
      halfLifeDays
    );
    return sum + decayed;
  }, 0);
  
  // Normalize to 0-100 scale
  // Cap at MAX_REPUTATION_SCORE
  return Math.min(MAX_REPUTATION_SCORE, Math.max(MIN_REPUTATION_SCORE, totalScore));
}

/**
 * Compute bootstrap bonus for new peers
 * 
 * @param firstInteractionAt - When peer first joined
 * @returns Bonus multiplier (1.0-1.5)
 */
export function computeBootstrapBonus(firstInteractionAt: number): number {
  const now = Date.now();
  const ageDays = (now - firstInteractionAt) / (1000 * 60 * 60 * 24);
  
  if (ageDays > BOOTSTRAP_PERIOD_DAYS) {
    return 1.0;
  }
  
  // Linear interpolation from 1.5 to 1.0 over bootstrap period
  const remainingRatio = 1 - (ageDays / BOOTSTRAP_PERIOD_DAYS);
  return 1.0 + (BOOTSTRAP_BONUS - 1.0) * remainingRatio;
}

/**
 * Compute Sybil resistance score
 * 
 * Higher score = more resistant to Sybil attacks
 * Based on account age, interaction diversity, and stake
 * 
 * @param peerID - Peer identifier
 * @param firstInteractionAt - When peer first joined
 * @param interactionTypes - Set of unique interaction types
 * @param uniquePeers - Number of unique peers interacted with
 * @param hasStake - Whether peer has bonded stake
 * @returns Sybil resistance score (0-1)
 */
export function computeSybilResistance(
  _peerID: string,
  firstInteractionAt: number,
  interactionTypes: Set<string>,
  uniquePeers: number,
  hasStake: boolean
): number {
  const now = Date.now();
  const ageDays = (now - firstInteractionAt) / (1000 * 60 * 60 * 24);
  
  // Age component (0-0.4): Older accounts are more trusted
  const ageScore = Math.min(1, ageDays / 30) * 0.4;
  
  // Diversity component (0-0.3): More interaction types = more legitimate
  const diversityScore = Math.min(1, interactionTypes.size / 5) * 0.3;
  
  // Network component (0-0.3): More unique peers = more legitimate
  const networkScore = Math.min(1, uniquePeers / 20) * 0.3;
  
  // Stake bonus (0-0.2): Having stake significantly increases trust
  const stakeBonus = hasStake ? 0.2 : 0;
  
  return Math.min(1, ageScore + diversityScore + networkScore + stakeBonus);
}

/**
 * Compute time-weighted interaction count
 * 
 * Recent interactions count more than old ones
 * 
 * @param interactions - Array of interactions
 * @param windowDays - Time window to consider (default: 30)
 * @returns Weighted interaction count
 */
export function computeWeightedInteractionCount(
  interactions: Interaction[],
  windowDays: number = 30
): number {
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  
  return interactions.reduce((count, interaction) => {
    const age = now - interaction.timestamp;
    
    // Only count interactions within window
    if (age > windowMs) {
      return count;
    }
    
    // Weight by recency (linear decay within window)
    const weight = 1 - (age / windowMs);
    return count + weight;
  }, 0);
}

/**
 * Get interactions within a time window
 * 
 * @param interactions - All interactions
 * @param windowDays - Time window in days
 * @returns Filtered interactions
 */
export function getInteractionsInWindow(
  interactions: Interaction[],
  windowDays: number = 30
): Interaction[] {
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  
  return interactions.filter(
    (interaction) => now - interaction.timestamp <= windowMs
  );
}

/**
 * Compute reputation trend
 * 
 * @param interactions - Recent interactions
 * @param windowDays - Window to compare (default: 30)
 * @returns Trend: 'increasing' | 'stable' | 'decreasing'
 */
export function computeReputationTrend(
  interactions: Interaction[],
  windowDays: number = 30
): 'increasing' | 'stable' | 'decreasing' {
  const now = Date.now();
  const halfWindowMs = (windowDays / 2) * 24 * 60 * 60 * 1000;
  const fullWindowMs = windowDays * 24 * 60 * 60 * 1000;
  
  // Count weighted interactions in each half
  const recentCount = interactions.reduce((count, interaction) => {
    const age = now - interaction.timestamp;
    if (age <= halfWindowMs) {
      return count + 1;
    }
    return count;
  }, 0);
  
  const olderCount = interactions.reduce((count, interaction) => {
    const age = now - interaction.timestamp;
    if (age > halfWindowMs && age <= fullWindowMs) {
      return count + 1;
    }
    return count;
  }, 0);
  
  // Determine trend
  const changeRatio = olderCount > 0 ? recentCount / olderCount : recentCount > 0 ? 2 : 1;
  
  if (changeRatio > 1.2) {
    return 'increasing';
  } else if (changeRatio < 0.8) {
    return 'decreasing';
  } else {
    return 'stable';
  }
}
