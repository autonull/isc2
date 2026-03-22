/**
 * @isc/social — Moderation
 *
 * Two-level moderation system:
 *
 *  1. Block list  — simple local peer blocking (createModerationService)
 *  2. Courts      — decentralized appeal/jury/verdict system
 */

// Types
export type {
  AppealCase,
  Verdict,
  JuryVote,
  Jury,
  CourtSession,
  JurorStats,
  CourtStats,
  Council,
} from './types.js';

// Config
export { COURT_CONFIG } from './config.js';

// Adapter interfaces
export type {
  ModerationStorage,
  ModerationIdentity,
  ModerationNetwork,
  ModerationReputation,
  CouncilProvider,
} from './adapters.js';

// Block list service (was packages/social/src/moderation.ts)
export { createModerationService, type ModerationService } from './block-list.js';

// Courts
export { createAppealService, type AppealService } from './appeals.js';
export { createJuryService, type JuryService } from './jury.js';
export {
  checkVerdictReadiness,
  createVerdictService,
  type VerdictService,
} from './verdicts.js';
export { createSessionService, type SessionService } from './sessions.js';
