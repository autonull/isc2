/**
 * Jury Service
 *
 * Jury selection, vote submission, and juror statistics.
 * When a vote tips a jury past quorum the verdict is enforced inline.
 */

import { encode } from '@isc/core';
import { COURT_CONFIG } from './config.js';
import { checkVerdictReadiness } from './verdicts.js';
import type { Jury, JuryVote, JurorStats } from './types.js';
import type {
  ModerationStorage,
  ModerationIdentity,
  ModerationNetwork,
  ModerationReputation,
  CouncilProvider,
} from './adapters.js';

export interface JuryService {
  selectJurors(
    appealId: string,
    councilId: string,
    numJurors?: number
  ): Promise<Jury>;
  getJury(id: string): Promise<Jury | null>;
  submitVote(
    juryId: string,
    decision: 'uphold' | 'overturn' | 'abstain',
    reasoning?: string
  ): Promise<Jury>;
  getStats(peerId: string): Promise<JurorStats>;
  isEligible(peerId: string, councilId: string): Promise<boolean>;
  getActive(peerId: string): Promise<Jury[]>;
  expireOld(): Promise<number>;
}

export function createJuryService(
  storage: ModerationStorage,
  identity: ModerationIdentity,
  councils: CouncilProvider,
  reputation: ModerationReputation,
  network?: ModerationNetwork
): JuryService {
  async function enforceVerdict(jury: Jury): Promise<void> {
    const verdict = checkVerdictReadiness(jury);
    if (!verdict) return;

    const concludedJury: Jury = { ...jury, verdict, status: 'concluded' };
    await storage.saveJury(concludedJury);

    // Persist verdict and update appeal status
    const appeal = await storage.getAppeal(verdict.appealId);
    if (appeal) await storage.saveAppeal({ ...appeal, status: 'decided' });
    await storage.saveVerdict({ ...verdict, enforced: true });

    if (network) {
      const key = `${COURT_CONFIG.dht.VERDICT_PREFIX}/${verdict.appealId}`;
      await network.announce(
        key,
        encode(verdict),
        COURT_CONFIG.timing.VERDICT_ANNOUNCEMENT_TTL
      );
    }
  }

  return {
    async selectJurors(appealId, councilId, numJurors = COURT_CONFIG.jury.DEFAULT_JUROR_COUNT) {
      const council = await councils.getCouncil(councilId);
      if (!council) throw new Error(`Council ${councilId} not found`);

      const jurorCount = Math.max(
        COURT_CONFIG.jury.MIN_JURORS,
        Math.min(COURT_CONFIG.jury.MAX_JURORS, numJurors)
      );

      const eligible: string[] = [];
      for (const memberId of council.members) {
        if (await councils.isEligible(memberId, council.reputationThreshold)) {
          eligible.push(memberId);
        }
      }

      if (eligible.length < COURT_CONFIG.jury.MIN_JURORS) {
        throw new Error('Insufficient eligible jurors');
      }

      const pool = [...eligible];
      const selected: string[] = [];
      while (selected.length < jurorCount && pool.length > 0) {
        const i = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(i, 1)[0]);
      }

      const now = Date.now();
      const jury: Jury = {
        id: `jury_${crypto.randomUUID()}`,
        appealId,
        councilId,
        jurors: selected,
        selectedAt: now,
        expiresAt: now + COURT_CONFIG.timing.DEFAULT_VOTE_DURATION_MS,
        votes: [],
        verdict: null,
        status: 'active',
      };

      await storage.saveJury(jury);

      if (network) {
        const key = `${COURT_CONFIG.dht.JURY_PREFIX}/${jury.id}`;
        await network.announce(
          key,
          encode(jury),
          COURT_CONFIG.timing.DEFAULT_VOTE_DURATION_MS / 1000
        );
      }

      return jury;
    },

    async getJury(id) {
      return storage.getJury(id);
    },

    async submitVote(juryId, decision, reasoning = '') {
      const jurorId = await identity.getPeerId();

      const jury = await storage.getJury(juryId);
      if (!jury) throw new Error(`Jury ${juryId} not found`);
      if (jury.status !== 'active') throw new Error('Jury is not accepting votes');
      if (jury.expiresAt < Date.now()) throw new Error('Jury has expired');
      if (!jury.jurors.includes(jurorId)) throw new Error('Not a member of this jury');
      if (jury.votes.some((v) => v.jurorId === jurorId)) throw new Error('Already voted');

      const reputationWeight = await reputation.getScore(jurorId);

      const voteWithoutSig: Omit<JuryVote, 'signature'> = {
        jurorId,
        decision,
        reasoning,
        timestamp: Date.now(),
        reputationWeight,
      };

      const signature = await identity.sign(encode(voteWithoutSig));
      const vote: JuryVote = { ...voteWithoutSig, signature };

      const updatedJury: Jury = { ...jury, votes: [...jury.votes, vote] };
      await storage.saveJury(updatedJury);

      await enforceVerdict(updatedJury);

      return updatedJury;
    },

    async getStats(peerId) {
      const juries = await storage.filterJuries((j) => j.jurors.includes(peerId));

      const votes = juries.flatMap((j) => j.votes.filter((v) => v.jurorId === peerId));

      const reputationScore = await reputation.getScore(peerId);

      let majorityAlignments = 0;
      let totalDecided = 0;

      for (const jury of juries) {
        if (jury.verdict) {
          totalDecided++;
          const userVote = jury.votes.find((v) => v.jurorId === peerId);
          if (userVote && userVote.decision === jury.verdict.decision) {
            majorityAlignments++;
          }
        }
      }

      const responseTimes = votes.map(
        (v) =>
          v.timestamp -
          (juries.find((j) => j.votes.some((jv) => jv.jurorId === peerId))?.selectedAt ?? 0)
      );

      return {
        peerID: peerId,
        casesServed: juries.length,
        votesCast: votes.length,
        majorityAlignment: totalDecided > 0 ? majorityAlignments / totalDecided : 0,
        averageResponseTime:
          responseTimes.length > 0
            ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
            : 0,
        reputationScore,
      };
    },

    async isEligible(peerId, councilId) {
      const council = await councils.getCouncil(councilId);
      if (!council || !council.members.includes(peerId)) return false;
      return councils.isEligible(peerId, council.reputationThreshold);
    },

    async getActive(peerId) {
      const now = Date.now();
      return storage.filterJuries(
        (j) => j.jurors.includes(peerId) && j.status === 'active' && j.expiresAt > now
      );
    },

    async expireOld() {
      const now = Date.now();
      const juries = await storage.getAllJuries();
      let count = 0;

      for (const jury of juries) {
        if (jury.status === 'active' && jury.expiresAt < now) {
          const expiredJury: Jury = {
            ...jury,
            status: 'concluded',
            verdict: jury.verdict ?? {
              appealId: jury.appealId,
              decision: 'uphold',
              voteBreakdown: { uphold: 0, overturn: 0, abstain: 0 },
              reputationWeightedScore: 0,
              reasoning: 'Jury expired without reaching verdict',
              decidedAt: now,
              enforced: false,
            },
          };
          await storage.saveJury(expiredJury);
          count++;
        }
      }

      return count;
    },
  };
}
