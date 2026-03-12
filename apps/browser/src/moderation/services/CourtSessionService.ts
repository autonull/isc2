/**
 * Court Session Service - Manages court sessions and statistics
 */

import { dbGet, dbPut, dbFilter } from '../../db/helpers.js';
import { COURT_CONFIG } from '../config/courtConfig.js';
import type { CourtSession } from '../models/session.js';
import type { AppealCase } from '../models/appeal.js';
import type { Verdict } from '../models/appeal.js';
import { getAllVerdicts } from './VerdictService.js';

/**
 * Start a court session
 */
export async function startCourtSession(councilId: string): Promise<CourtSession> {
  const session: CourtSession = {
    id: `session_${crypto.randomUUID()}`,
    councilId,
    activeAppeals: [],
    completedAppeals: [],
    startedAt: Date.now(),
  };

  await dbPut(COURT_CONFIG.stores.COURTS, session);
  return session;
}

/**
 * Get court session by ID
 */
export async function getCourtSession(sessionId: string): Promise<CourtSession | null> {
  return dbGet<CourtSession>(COURT_CONFIG.stores.COURTS, sessionId);
}

/**
 * Add appeal to court session
 */
export async function addAppealToSession(sessionId: string, appealId: string): Promise<void> {
  const session = await getCourtSession(sessionId);
  if (!session) return;

  if (!session.activeAppeals.includes(appealId)) {
    session.activeAppeals.push(appealId);
    await dbPut(COURT_CONFIG.stores.COURTS, session);
  }
}

/**
 * Move appeal from active to completed in session
 */
export async function completeAppealInSession(
  sessionId: string,
  appealId: string
): Promise<void> {
  const session = await getCourtSession(sessionId);
  if (!session) return;

  session.activeAppeals = session.activeAppeals.filter((id) => id !== appealId);
  session.completedAppeals.push(appealId);
  await dbPut(COURT_CONFIG.stores.COURTS, session);
}

/**
 * End court session
 */
export async function endCourtSession(sessionId: string): Promise<void> {
  const session = await getCourtSession(sessionId);
  if (!session) return;

  session.endedAt = Date.now();
  await dbPut(COURT_CONFIG.stores.COURTS, session);
}

/**
 * Get court statistics
 */
export async function getCourtStats(councilId: string): Promise<{
  totalAppeals: number;
  pendingAppeals: number;
  completedAppeals: number;
  averageResolutionTime: number;
  overturnRate: number;
}> {
  const appeals = await dbFilter<AppealCase>(COURT_CONFIG.stores.APPEALS, () => true);
  const verdicts = await getAllVerdicts();

  const councilAppeals = appeals;
  const councilVerdicts = verdicts;

  const pendingAppeals = councilAppeals.filter((a) => a.status === 'pending').length;
  const completedAppeals = councilAppeals.filter((a) => a.status === 'decided').length;

  const resolutionTimes = councilVerdicts.map((v) => {
    const appeal = councilAppeals.find((a) => a.id === v.appealId);
    if (!appeal) return 0;
    return v.decidedAt - appeal.timestamp;
  });

  const averageResolutionTime =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length
      : 0;

  const overturnCount = councilVerdicts.filter((v) => v.decision === 'overturn').length;
  const overturnRate =
    councilVerdicts.length > 0 ? overturnCount / councilVerdicts.length : 0;

  return {
    totalAppeals: councilAppeals.length,
    pendingAppeals,
    completedAppeals,
    averageResolutionTime,
    overturnRate,
  };
}
