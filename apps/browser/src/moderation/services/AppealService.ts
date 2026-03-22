/**
 * Appeal Service — browser adapter
 *
 * Delegates to @isc/social createAppealService with browser-specific adapters.
 */

import { createAppealService } from '@isc/social';
import {
  createBrowserModerationStorage,
  createBrowserModerationIdentity,
  createBrowserModerationNetwork,
} from '../adapters.js';
import type { AppealCase } from '@isc/social';

const service = createAppealService(
  createBrowserModerationStorage(),
  createBrowserModerationIdentity(),
  createBrowserModerationNetwork()
);

export function createAppeal(
  reportId: string,
  reason: string,
  evidence: string[] = []
): Promise<AppealCase> {
  return service.create(reportId, reason, evidence);
}

export function getAppeal(appealId: string): Promise<AppealCase | null> {
  return service.get(appealId);
}

export function getPendingAppeals(): Promise<AppealCase[]> {
  return service.getPending();
}

export function getAppealsByUser(peerID: string): Promise<AppealCase[]> {
  return service.getByUser(peerID);
}
