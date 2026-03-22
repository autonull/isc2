/**
 * Community Courts — re-exports
 *
 * All business logic lives in @isc/social/moderation.
 * Types are re-exported from the package; functions come from the thin
 * browser adapter wrappers in ./services/.
 */

export { COURT_CONFIG } from './config/courtConfig.js';

export type { AppealCase, Verdict, Jury, JuryVote, CourtSession, JurorStats } from '@isc/social';

export {
  createAppeal,
  getAppeal,
  getPendingAppeals,
  getAppealsByUser,
} from './services/AppealService.js';

export {
  selectJurors,
  getJury,
  submitJurorVote,
  getJurorStats,
  isEligibleJuror,
  getActiveJuries,
  expireOldJuries,
} from './services/JuryService.js';

export {
  checkVerdictReadiness,
  enforceVerdict,
  getVerdict,
  getAllVerdicts,
} from './services/VerdictService.js';

export {
  startCourtSession,
  getCourtSession,
  addAppealToSession,
  completeAppealInSession,
  endCourtSession,
  getCourtStats,
} from './services/CourtSessionService.js';
