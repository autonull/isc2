/**
 * ISC Phase 2: Reputation System
 * 
 * Comprehensive reputation with time-decay, mutual signing, and Web of Trust.
 */

// Re-export core reputation modules
export { ReputationScorer } from './scorer.js';
export { computeDecayedScore, DECAY_HALF_LIFE_DAYS } from './decay.js';
export { findTrustPaths, computeWoTScore } from './wot.js';

// Types
export type { ReputationResult, TrustPath, TrustScore, Interaction } from './types.js';

// Constants
export const REPUTATION_VERSION = '2.0.0';
