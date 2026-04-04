/* eslint-disable */
/**
 * Community Courts — re-exports
 *
 * All business logic lives in @isc/social/moderation.
 * Types are re-exported from the package; functions come from the thin
 * browser adapter wrappers in ./services/.
 */

export { COURT_CONFIG } from './config/courtConfig.ts';

export type { AppealCase, Verdict, Jury, JuryVote, CourtSession, JurorStats } from '@isc/social';

export {
  createAppeal,
  getAppeal,
  getPendingAppeals,
  getAppealsByUser,
} from './services/AppealService.ts';

export {
  selectJurors,
  getJury,
  submitJurorVote,
  getJurorStats,
  isEligibleJuror,
  getActiveJuries,
  expireOldJuries,
} from './services/JuryService.ts';

export {
  checkVerdictReadiness,
  enforceVerdict,
  getVerdict,
  getAllVerdicts,
} from './services/VerdictService.ts';

export {
  startCourtSession,
  getCourtSession,
  addAppealToSession,
  completeAppealInSession,
  endCourtSession,
  getCourtStats,
} from './services/CourtSessionService.ts';
