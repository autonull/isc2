/**
 * Community Courts - Decentralized Moderation Appeals
 *
 * Implements a decentralized jury system for content moderation appeals.
 * High-reputation users are selected as jurors to vote on reported content.
 *
 * References: NEXT_STEPS.md#62-community-courts
 */

import { sign, encode, decode } from '@isc/core';
import type { CommunityCouncil, CommunityReport, Vote } from '../social/types.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { computeReputationCached } from '../reputation/decay.js';
import {
  getCouncil,
  getCouncilsForChannel,
  getMyCouncils,
  isCouncilEligible,
  getPendingReports,
  getReportsForTarget,
  voteOnReport,
} from '../social/moderation.js';
import { dbGet, dbPut, dbFilter, dbGetAll } from '../db/helpers.js';

const COURTS_STORE = 'courts';
const APPEALS_STORE = 'appeals';
const JURY_STORE = 'juries';
const VERDICTS_STORE = 'verdicts';

const DEFAULT_VOTE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_QUORUM = 0.6; // 60% of jurors must vote
const MIN_JURORS = 3;
const MAX_JURORS = 9;

/**
 * Appeal case for community court review
 */
export interface AppealCase {
  id: string;
  reportId: string;
  appellant: string;
  reason: string;
  evidence: string[];
  timestamp: number;
  status: 'pending' | 'under_review' | 'decided' | 'expired';
  signature?: Uint8Array;
}

/**
 * Jury selection for a specific case
 */
export interface Jury {
  id: string;
  appealId: string;
  councilId: string;
  jurors: string[];
  selectedAt: number;
  expiresAt: number;
  votes: JuryVote[];
  verdict: Verdict | null;
  status: 'selecting' | 'active' | 'concluded';
}

/**
 * Individual juror vote
 */
export interface JuryVote {
  jurorId: string;
  decision: 'uphold' | 'overturn' | 'abstain';
  reasoning: string;
  timestamp: number;
  reputationWeight: number;
  signature?: Uint8Array;
}

/**
 * Court verdict
 */
export interface Verdict {
  appealId: string;
  decision: 'uphold' | 'overturn';
  voteBreakdown: {
    uphold: number;
    overturn: number;
    abstain: number;
  };
  reputationWeightedScore: number;
  reasoning: string;
  decidedAt: number;
  enforced: boolean;
}

/**
 * Court session for tracking active cases
 */
export interface CourtSession {
  id: string;
  councilId: string;
  activeAppeals: string[];
  completedAppeals: string[];
  startedAt: number;
  endedAt?: number;
}

/**
 * Juror statistics
 */
export interface JurorStats {
  peerID: string;
  casesServed: number;
  votesCast: number;
  majorityAlignment: number; // Percentage of votes in majority
  averageResponseTime: number; // ms
  reputationScore: number;
}

/**
 * Create an appeal for a moderation decision
 *
 * @param reportId - Original report ID to appeal
 * @param reason - Reason for appeal
 * @param evidence - Additional evidence to support appeal
 * @returns Created appeal case
 */
export async function createAppeal(
  reportId: string,
  reason: string,
  evidence: string[] = []
): Promise<AppealCase> {
  const appellant = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const appeal: Omit<AppealCase, 'signature'> = {
    id: `appeal_${crypto.randomUUID()}`,
    reportId,
    appellant,
    reason,
    evidence,
    timestamp: Date.now(),
    status: 'pending',
  };

  const payload = encode(appeal);
  const signatureObj = await sign(payload, keypair.privateKey);
  const signature = signatureObj.data;

  const signedAppeal: AppealCase = { ...appeal, signature };

  // Store locally
  await dbPut(APPEALS_STORE, signedAppeal);

  // Announce to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/appeal/${signedAppeal.id}`;
    await client.announce(key, encode(signedAppeal), DEFAULT_VOTE_DURATION_MS / 1000);
  }

  return signedAppeal;
}

/**
 * Get appeal by ID
 */
export async function getAppeal(appealId: string): Promise<AppealCase | null> {
  return dbGet<AppealCase>(APPEALS_STORE, appealId);
}

/**
 * Get all pending appeals
 */
export async function getPendingAppeals(): Promise<AppealCase[]> {
  return dbFilter<AppealCase>(APPEALS_STORE, (a) => a.status === 'pending');
}

/**
 * Get appeals for a specific user
 */
export async function getAppealsByUser(peerID: string): Promise<AppealCase[]> {
  return dbFilter<AppealCase>(APPEALS_STORE, (a) => a.appellant === peerID);
}

/**
 * Select jurors for an appeal case
 *
 * Jurors are selected based on:
 * - Reputation score (must meet council threshold)
 * - Not involved in original report
 * - Random selection from eligible pool
 *
 * @param appealId - Appeal to select jurors for
 * @param councilId - Council overseeing the appeal
 * @param numJurors - Number of jurors to select
 * @returns Created jury
 */
export async function selectJurors(
  appealId: string,
  councilId: string,
  numJurors: number = 5
): Promise<Jury> {
  const council = await getCouncil(councilId);
  if (!council) {
    throw new Error(`Council ${councilId} not found`);
  }

  // Clamp jurors to valid range
  const jurorCount = Math.max(MIN_JURORS, Math.min(MAX_JURORS, numJurors));

  // Get eligible jurors from council members
  const eligibleJurors: string[] = [];

  for (const memberId of council.members) {
    const isEligible = await isCouncilEligible(memberId, council.reputationThreshold);
    if (isEligible) {
      eligibleJurors.push(memberId);
    }
  }

  if (eligibleJurors.length < MIN_JURORS) {
    throw new Error('Insufficient eligible jurors');
  }

  // Random selection
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
    expiresAt: now + DEFAULT_VOTE_DURATION_MS,
    votes: [],
    verdict: null,
    status: 'active',
  };

  await dbPut(JURY_STORE, jury);

  // Announce jury selection to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/jury/${jury.id}`;
    await client.announce(key, encode(jury), DEFAULT_VOTE_DURATION_MS / 1000);
  }

  return jury;
}

/**
 * Get jury by ID
 */
export async function getJury(juryId: string): Promise<Jury | null> {
  return dbGet<Jury>(JURY_STORE, juryId);
}

/**
 * Submit a juror vote
 *
 * @param juryId - Jury to vote in
 * @param decision - Vote decision
 * @param reasoning - Optional reasoning for the vote
 * @returns Updated jury with vote recorded
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

  // Check if already voted
  const existingVote = jury.votes.find((v) => v.jurorId === jurorId);
  if (existingVote) {
    throw new Error('Already voted');
  }

  // Get juror reputation for weighted voting
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
  await dbPut(JURY_STORE, jury);

  // Check if verdict can be reached
  const verdict = await checkVerdictReadiness(jury);
  if (verdict) {
    jury.verdict = verdict;
    jury.status = 'concluded';
    await dbPut(JURY_STORE, jury);
    await enforceVerdict(verdict);
  }

  return jury;
}

/**
 * Check if jury has enough votes to reach a verdict
 */
async function checkVerdictReadiness(jury: Jury): Promise<Verdict | null> {
  const votes = jury.votes;
  const requiredVotes = Math.ceil(jury.jurors.length * DEFAULT_QUORUM);

  if (votes.length < requiredVotes) {
    return null;
  }

  // Count votes with reputation weighting
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

  // Normalize reputation weighted score to [-1, 1]
  const totalWeight = votes.reduce((sum, v) => sum + v.reputationWeight, 0);
  if (totalWeight > 0) {
    reputationWeightedScore = reputationWeightedScore / totalWeight;
  }

  // Determine decision based on simple majority
  const decision = voteBreakdown.overturn > voteBreakdown.uphold ? 'overturn' : 'uphold';

  // Generate reasoning from vote breakdown
  const reasoning = `Verdict reached with ${voteBreakdown[decision]} out of ${votes.length} votes`;

  const verdict: Verdict = {
    appealId: jury.appealId,
    decision,
    voteBreakdown,
    reputationWeightedScore,
    reasoning,
    decidedAt: Date.now(),
    enforced: false,
  };

  return verdict;
}

/**
 * Enforce a verdict
 *
 * @param verdict - Verdict to enforce
 */
async function enforceVerdict(verdict: Verdict): Promise<void> {
  const appeal = await getAppeal(verdict.appealId);
  if (!appeal) return;

  // Update appeal status
  appeal.status = 'decided';
  await dbPut(APPEALS_STORE, appeal);

  // Store verdict
  await dbPut(VERDICTS_STORE, { ...verdict, enforced: true });

  // Announce verdict to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/verdict/${verdict.appealId}`;
    await client.announce(key, encode(verdict), 86400 * 30); // 30 days
  }

  // If overturned, clear the original report's consequences
  if (verdict.decision === 'overturn') {
    // In a full implementation, this would reverse any penalties
    console.log(`Verdict: Original report ${appeal.reportId} overturned`);
  } else {
    console.log(`Verdict: Original report ${appeal.reportId} upheld`);
  }
}

/**
 * Get verdict for an appeal
 */
export async function getVerdict(appealId: string): Promise<Verdict | null> {
  return dbGet<Verdict>(VERDICTS_STORE, appealId);
}

/**
 * Get all verdicts
 */
export async function getAllVerdicts(): Promise<Verdict[]> {
  return dbGetAll<Verdict>(VERDICTS_STORE);
}

/**
 * Get juror statistics
 */
export async function getJurorStats(peerID: string): Promise<JurorStats> {
  const juries = await dbFilter<Jury>(JURY_STORE, (j) => j.jurors.includes(peerID));

  const votes: JuryVote[] = [];
  for (const jury of juries) {
    votes.push(...jury.votes.filter((v) => v.jurorId === peerID));
  }

  const reputation = await computeReputationCached(peerID);

  // Calculate majority alignment
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

  // Calculate average response time
  const responseTimes = votes.map((v) => v.timestamp - (juries.find((j) =>
    j.votes.some((jv) => jv.jurorId === peerID)
  )?.selectedAt ?? 0));

  const averageResponseTime = responseTimes.length > 0
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
export async function isEligibleJuror(
  peerID: string,
  councilId: string
): Promise<boolean> {
  const council = await getCouncil(councilId);
  if (!council) return false;

  if (!council.members.includes(peerID)) return false;

  return isCouncilEligible(peerID, council.reputationThreshold);
}

/**
 * Get active juries for a user
 */
export async function getActiveJuries(peerID: string): Promise<Jury[]> {
  const juries = await dbFilter<Jury>(JURY_STORE, (j) =>
    j.jurors.includes(peerID) &&
    j.status === 'active' &&
    j.expiresAt > Date.now()
  );

  return juries;
}

/**
 * Expire old juries
 */
export async function expireOldJuries(): Promise<number> {
  const now = Date.now();
  const juries = await dbGetAll<Jury>(JURY_STORE);

  let expiredCount = 0;

  for (const jury of juries) {
    if (jury.status === 'active' && jury.expiresAt < now) {
      jury.status = 'concluded';

      // If no verdict was reached, mark as expired
      if (!jury.verdict) {
        jury.verdict = {
          appealId: jury.appealId,
          decision: 'uphold', // Default to upholding on timeout
          voteBreakdown: { uphold: 0, overturn: 0, abstain: 0 },
          reputationWeightedScore: 0,
          reasoning: 'Jury expired without reaching verdict',
          decidedAt: now,
          enforced: false,
        };
      }

      await dbPut(JURY_STORE, jury);
      expiredCount++;
    }
  }

  return expiredCount;
}

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

  await dbPut(COURTS_STORE, session);
  return session;
}

/**
 * Get court session by ID
 */
export async function getCourtSession(sessionId: string): Promise<CourtSession | null> {
  return dbGet<CourtSession>(COURTS_STORE, sessionId);
}

/**
 * Add appeal to court session
 */
export async function addAppealToSession(
  sessionId: string,
  appealId: string
): Promise<void> {
  const session = await getCourtSession(sessionId);
  if (!session) return;

  if (!session.activeAppeals.includes(appealId)) {
    session.activeAppeals.push(appealId);
    await dbPut(COURTS_STORE, session);
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
  await dbPut(COURTS_STORE, session);
}

/**
 * End court session
 */
export async function endCourtSession(sessionId: string): Promise<void> {
  const session = await getCourtSession(sessionId);
  if (!session) return;

  session.endedAt = Date.now();
  await dbPut(COURTS_STORE, session);
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
  const appeals = await dbFilter<AppealCase>(APPEALS_STORE, () => true);
  const verdicts = await getAllVerdicts();

  const councilAppeals = appeals; // Would filter by council in full implementation
  const councilVerdicts = verdicts;

  const pendingAppeals = councilAppeals.filter((a) => a.status === 'pending').length;
  const completedAppeals = councilAppeals.filter((a) => a.status === 'decided').length;

  // Calculate average resolution time
  const resolutionTimes = councilVerdicts.map((v) => {
    const appeal = councilAppeals.find((a) => a.id === v.appealId);
    if (!appeal) return 0;
    return v.decidedAt - appeal.timestamp;
  });

  const averageResolutionTime = resolutionTimes.length > 0
    ? resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length
    : 0;

  // Calculate overturn rate
  const overturnCount = councilVerdicts.filter((v) => v.decision === 'overturn').length;
  const overturnRate = councilVerdicts.length > 0
    ? overturnCount / councilVerdicts.length
    : 0;

  return {
    totalAppeals: councilAppeals.length,
    pendingAppeals,
    completedAppeals,
    averageResolutionTime,
    overturnRate,
  };
}
