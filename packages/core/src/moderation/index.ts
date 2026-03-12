/**
 * ISC Phase 2.3: Community Moderation Courts
 * 
 * Decentralized moderation through community juries.
 * Peers are selected based on reputation to judge reported content.
 */

// Re-export moderation modules
export { ModerationCourt } from './courts.js';
export { JurySelector } from './jury.js';
export { QuadraticVoting } from './voting.js';

// Types
export type {
  CourtCase,
  Report,
  Verdict,
  JuryMember,
  CourtConfig,
  ModerationEvent,
} from './types.js';

// Constants
export const MODERATION_VERSION = '2.0.0';
export const DEFAULT_JURY_SIZE = 7;
