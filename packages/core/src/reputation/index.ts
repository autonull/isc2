/**
 * ISC Phase 2: Reputation System
 *
 * Comprehensive reputation with time-decay, mutual signing, and Web of Trust.
 */

// Re-export core reputation modules
export { ReputationScorer } from './scorer.js';
export { computeDecayedScore, DECAY_HALF_LIFE_DAYS } from './decay.js';
export { findTrustPaths, computeWoTScore } from './wot.js';

// Utility modules
export { DecayCalculator } from './decay-utils.js';
export { BootstrapService, BOOTSTRAP_CONSTANTS } from './bootstrap-utils.js';
export { SybilResistanceService, SYBIL_CONSTANTS } from './sybil-utils.js';

// Types
export type { ReputationResult, TrustPath, TrustScore, Interaction } from './types.js';
export type { DecayInteraction, DecayCurvePoint } from './decay-utils.js';
export type { BootstrapConfig } from './bootstrap-utils.js';
export type { SybilConfig } from './sybil-utils.js';

// Constants
export const REPUTATION_VERSION = '2.0.0';
