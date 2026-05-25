/* eslint-disable */
/**
 * Jury Service — browser adapter
 *
 * Delegates to @isc/social createJuryService with browser-specific adapters.
 */

import { createJuryService } from '@isc/social';
import {
  createBrowserModerationStorage,
  createBrowserModerationIdentity,
  createBrowserModerationNetwork,
  createBrowserModerationReputation,
  createBrowserCouncilProvider,
} from '../adapters.ts';
import type { Jury, JurorStats } from '@isc/social';

const service = createJuryService(
  createBrowserModerationStorage(),
  createBrowserModerationIdentity(),
  createBrowserCouncilProvider(),
  createBrowserModerationReputation(),
  createBrowserModerationNetwork()
);

export function selectJurors(
  appealId: string,
  councilId: string,
  numJurors?: number
): Promise<Jury> {
  return service.selectJurors(appealId, councilId, numJurors);
}

export function getJury(juryId: string): Promise<Jury | null> {
  return service.getJury(juryId);
}

export function submitJurorVote(
  juryId: string,
  decision: 'uphold' | 'overturn' | 'abstain',
  reasoning = ''
): Promise<Jury> {
  return service.submitVote(juryId, decision, reasoning);
}

export function getJurorStats(peerID: string): Promise<JurorStats> {
  return service.getStats(peerID);
}

export function isEligibleJuror(peerID: string, councilId: string): Promise<boolean> {
  return service.isEligible(peerID, councilId);
}

export function getActiveJuries(peerID: string): Promise<Jury[]> {
  return service.getActive(peerID);
}

export function expireOldJuries(): Promise<number> {
  return service.expireOld();
}
