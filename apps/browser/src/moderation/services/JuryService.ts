/**
 * Jury Service - Handles jury selection and voting
 */

import { sign, encode } from '@isc/core';
import { DelegationClient } from '../../delegation/fallback.js';
import { dbGet, dbPut, dbFilter, dbGetAll } from '../../db/helpers.js';
import { getPeerID, getKeypair } from '../../identity/index.js';
import { computeReputationCached } from '../../reputation/decay.js';
import { getCouncil, isCouncilEligible } from '../../social/moderation.js';
import { COURT_CONFIG } from '../config/courtConfig.js';
import type { Jury, JuryVote } from '../models/jury.js';
import type { JurorStats } from '../models/session.js';
import { checkVerdictReadiness, enforceVerdict } from './VerdictService.js';

/**
 * Select jurors for an appeal case
 */
export async function selectJurors(
  appealId: string,
  councilId: string,
  numJurors: number = COURT_CONFIG.jury.DEFAULT_JUROR_COUNT
): Promise<Jury> {
  const council = await getCouncil(councilId);
  if (!council) {
    throw new Error(`Council ${councilId} not found`);
  }

  const jurorCount = Math.max(
    COURT_CONFIG.jury.MIN_JURORS,
    Math.min(COURT_CONFIG.jury.MAX_JURORS, numJurors)
  );

  const eligibleJurors: string[] = [];

  for (const memberId of council.members) {
    const isEligible = await isCouncilEligible(memberId, council.reputationThreshold);
    if (isEligible) {
      eligibleJurors.push(memberId);
    }
  }

  if (eligibleJurors.length < COURT_CONFIG.jury.MIN_JURORS) {
    throw new Error('Insufficient eligible jurors');
  }

  const selectedJurors: string[] = [];
  const available = [...eligibleJurors];

  while (selectedJurors.length < jurorCount && available.length > 0) {
    const randomIndex = Math.floor(Math.random() * available.length);
    selectedJurors.push(available.splice(randomIndex, 1)[0]);
  }

  const now = Date.now();
  const jury: Jury = {
    id: `jury_${crypto.randomUUID()}`,
    appealId,
    councilId,
    jurors: selectedJurors,
    selectedAt: now,
    expiresAt: now + COURT_CONFIG.timing.DEFAULT_VOTE_DURATION_MS,
    votes: [],
    verdict: null,
    status: 'active',
  };

  await dbPut(COURT_CONFIG.stores.JURY, jury);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `${COURT_CONFIG.dht.JURY_PREFIX}/${jury.id}`;
    await client.announce(key, encode(jury), COURT_CONFIG.timing.DEFAULT_VOTE_DURATION_MS / 1000);
  }

  return jury;
}

/**
 * Get jury by ID
 */
export async function getJury(juryId: string): Promise<Jury | null> {
  return dbGet<Jury>(COURT_CONFIG.stores.JURY, juryId);
}

/**
 * Submit a juror vote
 */
export async function submitJurorVote(
  juryId: string,
  decision: 'uphold' | 'overturn' | 'abstain',
  reasoning: string = ''
): Promise<Jury> {
  const jurorId = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const jury = await getJury(juryId);
  if (!jury) {
    throw new Error(`Jury ${juryId} not found`);
  }

  if (jury.status !== 'active') {
    throw new Error('Jury is not accepting votes');
  }

  if (jury.expiresAt < Date.now()) {
    throw new Error('Jury has expired');
  }

  if (!jury.jurors.includes(jurorId)) {
    throw new Error('Not a member of this jury');
  }

  const existingVote = jury.votes.find((v) => v.jurorId === jurorId);
  if (existingVote) {
    throw new Error('Already voted');
  }

  const reputation = await computeReputationCached(jurorId);
  const reputationWeight = reputation.sybilAdjustedScore;

  const vote: JuryVote = {
    jurorId,
    decision,
    reasoning,
    timestamp: Date.now(),
    reputationWeight,
  };

  const payload = encode(vote);
  const signatureObj = await sign(payload, keypair.privateKey);
  vote.signature = signatureObj.data;

  jury.votes.push(vote);
  await dbPut(COURT_CONFIG.stores.JURY, jury);

  const verdict = checkVerdictReadiness(jury);
  if (verdict) {
    jury.verdict = verdict;
    jury.status = 'concluded';
    await dbPut(COURT_CONFIG.stores.JURY, jury);
    await enforceVerdict(verdict);
  }

  return jury;
}

/**
 * Get juror statistics
 */
export async function getJurorStats(peerID: string): Promise<JurorStats> {
  const juries = await dbFilter<Jury>(COURT_CONFIG.stores.JURY, (j) => j.jurors.includes(peerID));

  const votes: JuryVote[] = [];
  for (const jury of juries) {
    votes.push(...jury.votes.filter((v) => v.jurorId === peerID));
  }

  const reputation = await computeReputationCached(peerID);

  let majorityAlignments = 0;
  let totalDecidedCases = 0;

  for (const jury of juries) {
    if (jury.verdict) {
      totalDecidedCases++;
      const userVote = jury.votes.find((v) => v.jurorId === peerID);
      if (userVote && userVote.decision === jury.verdict.decision) {
        majorityAlignments++;
      }
    }
  }

  const majorityAlignment = totalDecidedCases > 0 ? majorityAlignments / totalDecidedCases : 0;

  const responseTimes = votes.map(
    (v) =>
      v.timestamp -
      (juries.find((j) => j.votes.some((jv) => jv.jurorId === peerID))?.selectedAt ?? 0)
  );

  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;

  return {
    peerID,
    casesServed: juries.length,
    votesCast: votes.length,
    majorityAlignment,
    averageResponseTime,
    reputationScore: reputation.sybilAdjustedScore,
  };
}

/**
 * Check if user is eligible to serve as a juror
 */
export async function isEligibleJuror(peerID: string, councilId: string): Promise<boolean> {
  const council = await getCouncil(councilId);
  if (!council) return false;

  if (!council.members.includes(peerID)) return false;

  return isCouncilEligible(peerID, council.reputationThreshold);
}

/**
 * Get active juries for a user
 */
export async function getActiveJuries(peerID: string): Promise<Jury[]> {
  return dbFilter<Jury>(
    COURT_CONFIG.stores.JURY,
    (j) => j.jurors.includes(peerID) && j.status === 'active' && j.expiresAt > Date.now()
  );
}

/**
 * Expire old juries
 */
export async function expireOldJuries(): Promise<number> {
  const now = Date.now();
  const juries = await dbGetAll<Jury>(COURT_CONFIG.stores.JURY);

  let expiredCount = 0;

  for (const jury of juries) {
    if (jury.status === 'active' && jury.expiresAt < now) {
      jury.status = 'concluded';

      if (!jury.verdict) {
        jury.verdict = {
          appealId: jury.appealId,
          decision: 'uphold',
          voteBreakdown: { uphold: 0, overturn: 0, abstain: 0 },
          reputationWeightedScore: 0,
          reasoning: 'Jury expired without reaching verdict',
          decidedAt: now,
          enforced: false,
        };
      }

      await dbPut(COURT_CONFIG.stores.JURY, jury);
      expiredCount++;
    }
  }

  return expiredCount;
}
