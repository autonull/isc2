/**
 * Court Session Service — browser adapter
 *
 * Delegates to @isc/social createSessionService with browser-specific storage.
 */

import { createSessionService } from '@isc/social';
import { createBrowserModerationStorage } from '../adapters.js';
import type { CourtSession, CourtStats } from '@isc/social';

const service = createSessionService(createBrowserModerationStorage());

export function startCourtSession(councilId: string): Promise<CourtSession> {
  return service.start(councilId);
}

export function getCourtSession(sessionId: string): Promise<CourtSession | null> {
  return service.get(sessionId);
}

export function addAppealToSession(sessionId: string, appealId: string): Promise<void> {
  return service.addAppeal(sessionId, appealId);
}

export function completeAppealInSession(sessionId: string, appealId: string): Promise<void> {
  return service.completeAppeal(sessionId, appealId);
}

export function endCourtSession(sessionId: string): Promise<void> {
  return service.end(sessionId);
}

export function getCourtStats(councilId: string): Promise<CourtStats> {
  return service.getStats(councilId);
}
