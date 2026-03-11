/**
 * Moderation Module
 *
 * Community courts for decentralized moderation appeals.
 * References: NEXT_STEPS.md#62-community-courts
 */

export {
  // Appeals
  createAppeal,
  getAppeal,
  getPendingAppeals,
  getAppealsByUser,
  
  // Jury
  selectJurors,
  getJury,
  submitJurorVote,
  
  // Verdicts
  getVerdict,
  getAllVerdicts,
  
  // Juror management
  getJurorStats,
  isEligibleJuror,
  getActiveJuries,
  expireOldJuries,
  
  // Court sessions
  startCourtSession,
  getCourtSession,
  addAppealToSession,
  completeAppealInSession,
  endCourtSession,
  
  // Statistics
  getCourtStats,
} from './courts.js';

export type {
  AppealCase,
  Jury,
  JuryVote,
  Verdict,
  CourtSession,
  JurorStats,
} from './courts.js';
