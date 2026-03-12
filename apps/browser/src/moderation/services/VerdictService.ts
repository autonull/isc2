/**
 * Verdict Service - Handles verdict logic and enforcement
 */

import { encode } from '@isc/core';
import { DelegationClient } from '../../delegation/fallback.js';
import { dbGet, dbPut, dbGetAll } from '../../db/helpers.js';
import { COURT_CONFIG } from '../config/courtConfig.js';
import type { Verdict } from '../models/appeal.js';
import type { Jury, JuryVote } from '../models/jury.js';
import { getAppeal } from './AppealService.js';

/**
 * Check if jury has enough votes to reach a verdict
 */
export function checkVerdictReadiness(jury: Jury): Verdict | null {
  const votes = jury.votes;
  const requiredVotes = Math.ceil(jury.jurors.length * COURT_CONFIG.jury.DEFAULT_QUORUM);

  if (votes.length < requiredVotes) {
    return null;
  }

  const voteBreakdown = {
    uphold: 0,
    overturn: 0,
    abstain: 0,
  };

  let reputationWeightedScore = 0;

  for (const vote of votes) {
    voteBreakdown[vote.decision]++;

    if (vote.decision === 'uphold') {
      reputationWeightedScore += vote.reputationWeight;
    } else if (vote.decision === 'overturn') {
      reputationWeightedScore -= vote.reputationWeight;
    }
  }

  const totalWeight = votes.reduce((sum, v) => sum + v.reputationWeight, 0);
  if (totalWeight > 0) {
    reputationWeightedScore = reputationWeightedScore / totalWeight;
  }

  const decision = voteBreakdown.overturn > voteBreakdown.uphold ? 'overturn' : 'uphold';
  const reasoning = `Verdict reached with ${voteBreakdown[decision]} out of ${votes.length} votes`;

  return {
    appealId: jury.appealId,
    decision,
    voteBreakdown,
    reputationWeightedScore,
    reasoning,
    decidedAt: Date.now(),
    enforced: false,
  };
}

/**
 * Enforce a verdict
 */
export async function enforceVerdict(verdict: Verdict): Promise<void> {
  const appeal = await getAppeal(verdict.appealId);
  if (!appeal) return;

  appeal.status = 'decided';
  await dbPut(COURT_CONFIG.stores.APPEALS, appeal);

  await dbPut(COURT_CONFIG.stores.VERDICTS, { ...verdict, enforced: true });

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `${COURT_CONFIG.dht.VERDICT_PREFIX}/${verdict.appealId}`;
    await client.announce(key, encode(verdict), COURT_CONFIG.timing.VERDICT_ANNOUNCEMENT_TTL);
  }

  if (verdict.decision === 'overturn') {
    console.log(`Verdict: Original report ${appeal.reportId} overturned`);
  } else {
    console.log(`Verdict: Original report ${appeal.reportId} upheld`);
  }
}

/**
 * Get verdict for an appeal
 */
export async function getVerdict(appealId: string): Promise<Verdict | null> {
  return dbGet<Verdict>(COURT_CONFIG.stores.VERDICTS, appealId);
}

/**
 * Get all verdicts
 */
export async function getAllVerdicts(): Promise<Verdict[]> {
  return dbGetAll<Verdict>(COURT_CONFIG.stores.VERDICTS);
}
