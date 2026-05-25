/* eslint-disable */
/**
 * Verdict Service
 *
 * checkVerdictReadiness is a pure function — no storage needed.
 * createVerdictService handles persistence and DHT announcement.
 */

import { encode } from '@isc/core';
import { COURT_CONFIG } from './config.js';
import type { Jury, Verdict } from './types.js';
import type { ModerationStorage, ModerationNetwork } from './adapters.js';

/**
 * Pure function. Returns a verdict if quorum has been reached, null otherwise.
 */
export function checkVerdictReadiness(
  jury: Jury,
  quorum = COURT_CONFIG.jury.DEFAULT_QUORUM
): Verdict | null {
  const { votes } = jury;
  const required = Math.ceil(jury.jurors.length * quorum);

  if (votes.length < required) {return null;}

  const breakdown = { uphold: 0, overturn: 0, abstain: 0 };
  let weightedScore = 0;

  for (const vote of votes) {
    breakdown[vote.decision]++;
    if (vote.decision === 'uphold') {weightedScore += vote.reputationWeight;}
    else if (vote.decision === 'overturn') {weightedScore -= vote.reputationWeight;}
  }

  const totalWeight = votes.reduce((sum, v) => sum + v.reputationWeight, 0);
  if (totalWeight > 0) {weightedScore /= totalWeight;}

  const decision = breakdown.overturn > breakdown.uphold ? 'overturn' : 'uphold';

  return {
    appealId: jury.appealId,
    decision,
    voteBreakdown: breakdown,
    reputationWeightedScore: weightedScore,
    reasoning: `Verdict reached with ${breakdown[decision]} out of ${votes.length} votes`,
    decidedAt: Date.now(),
    enforced: false,
  };
}

export interface VerdictService {
  enforce(verdict: Verdict): Promise<void>;
  get(appealId: string): Promise<Verdict | null>;
  getAll(): Promise<Verdict[]>;
}

export function createVerdictService(
  storage: ModerationStorage,
  network?: ModerationNetwork
): VerdictService {
  return {
    async enforce(verdict) {
      const appeal = await storage.getAppeal(verdict.appealId);
      if (appeal) {
        await storage.saveAppeal({ ...appeal, status: 'decided' });
      }
      await storage.saveVerdict({ ...verdict, enforced: true });

      if (network) {
        const key = `${COURT_CONFIG.dht.VERDICT_PREFIX}/${verdict.appealId}`;
        await network.announce(
          key,
          encode(verdict),
          COURT_CONFIG.timing.VERDICT_ANNOUNCEMENT_TTL
        );
      }
    },

    async get(appealId) {
      return storage.getVerdict(appealId);
    },

    async getAll() {
      return storage.getAllVerdicts();
    },
  };
}
