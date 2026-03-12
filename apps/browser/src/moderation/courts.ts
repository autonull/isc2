/**
 * Community Courts - Decentralized Moderation Appeals
 *
 * Facade module re-exporting court system functionality.
 * See submodules for implementation details.
 *
 * References: NEXT_STEPS.md#62-community-courts
 */

export { COURT_CONFIG } from './config/courtConfig.js';

export type { AppealCase, Verdict } from './models/appeal.js';
export type { Jury, JuryVote } from './models/jury.js';
export type { CourtSession, JurorStats } from './models/session.js';

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
