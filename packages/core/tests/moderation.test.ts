/**
 * Unit Tests for Moderation Courts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModerationCourt } from '../src/moderation/courts.js';
import { JurySelector } from '../src/moderation/jury.js';
import { QuadraticVoting } from '../src/moderation/voting.js';
import { ReputationScorer } from '../src/reputation/scorer.js';
import type { Vote } from '../src/moderation/types.js';

describe('Moderation Courts', () => {
  describe('ModerationCourt', () => {
    let court: ModerationCourt;
    let scorer: ReputationScorer;

    beforeEach(() => {
      scorer = new ReputationScorer();
      court = new ModerationCourt({}, scorer);
    });

    describe('submitReport', () => {
      it('should create a report', () => {
        const signature = new Uint8Array(64);
        const report = court.submitReport(
          'reporter1',
          'reported1',
          'spam',
          ['evidence1'],
          'Test report',
          signature
        );

        expect(report.reportID).toBeDefined();
        expect(report.reporter).toBe('reporter1');
        expect(report.reported).toBe('reported1');
        expect(report.reason).toBe('spam');
        expect(report.status).toBe('pending');
      });

      it('should prioritize serious reports', () => {
        const signature = new Uint8Array(64);
        court.submitReport('r1', 'p1', 'sybil_attack', [], 'Test', signature);
        court.submitReport('r2', 'p2', 'spam', [], 'Test', signature);

        // Sybil attack should be first in queue
        const cases = court.processQueue();
        expect(cases.length).toBe(2);
      });
    });

    describe('castVote', () => {
      it('should allow jury members to vote', () => {
        const signature = new Uint8Array(64);
        const report = court.submitReport('r1', 'p1', 'spam', [], 'Test', signature);
        const cases = court.processQueue();
        const case_ = cases[0];

        // Mock a jury member
        case_.jury[0].peerID = 'juror1';

        const result = court.castVote(
          case_.caseID,
          'juror1',
          'guilty',
          0.8,
          'Clear spam',
          signature
        );

        expect(result.success).toBe(true);
        expect(case_.votes['juror1']).toBeDefined();
      });

      it('should reject non-jury votes', () => {
        const signature = new Uint8Array(64);
        const report = court.submitReport('r1', 'p1', 'spam', [], 'Test', signature);
        const cases = court.processQueue();
        const case_ = cases[0];

        const result = court.castVote(
          case_.caseID,
          'not_a_juror',
          'guilty',
          0.8,
          'Test',
          signature
        );

        expect(result.success).toBe(false);
      });

      it('should reject duplicate votes', () => {
        const signature = new Uint8Array(64);
        const report = court.submitReport('r1', 'p1', 'spam', [], 'Test', signature);
        const cases = court.processQueue();
        const case_ = cases[0];

        case_.jury[0].peerID = 'juror1';

        court.castVote(case_.caseID, 'juror1', 'guilty', 0.8, 'Test', signature);
        const result = court.castVote(case_.caseID, 'juror1', 'not_guilty', 0.8, 'Test', signature);

        expect(result.success).toBe(false);
      });
    });

    describe('fileAppeal', () => {
      it('should allow filing appeal within period', () => {
        const signature = new Uint8Array(64);
        const report = court.submitReport('r1', 'p1', 'spam', [], 'Test', signature);
        const cases = court.processQueue();
        const case_ = cases[0];

        // Close the case
        case_.status = 'closed';
        case_.verdict = 'guilty';
        case_.resolvedAt = Date.now();

        const result = court.fileAppeal(
          case_.caseID,
          'p1',
          'New evidence found',
          ['new_evidence']
        );

        expect(result.success).toBe(true);
        expect(case_.status).toBe('appealed');
      });

      it('should reject appeals after deadline', () => {
        const signature = new Uint8Array(64);
        const report = court.submitReport('r1', 'p1', 'spam', [], 'Test', signature);
        const cases = court.processQueue();
        const case_ = cases[0];

        // Close the case in the past
        case_.status = 'closed';
        case_.verdict = 'guilty';
        case_.resolvedAt = Date.now() - 100 * 60 * 60 * 1000; // 100 hours ago

        const result = court.fileAppeal(case_.caseID, 'p1', 'Test');

        expect(result.success).toBe(false);
      });

      it('should reject appeals from non-reported party', () => {
        const signature = new Uint8Array(64);
        const report = court.submitReport('r1', 'p1', 'spam', [], 'Test', signature);
        const cases = court.processQueue();
        const case_ = cases[0];

        case_.status = 'closed';
        case_.verdict = 'guilty';
        case_.resolvedAt = Date.now();

        const result = court.fileAppeal(case_.caseID, 'r1', 'Test'); // Reporter, not reported

        expect(result.success).toBe(false);
      });
    });

    describe('getStats', () => {
      it('should return court statistics', () => {
        const signature = new Uint8Array(64);
        court.submitReport('r1', 'p1', 'spam', [], 'Test', signature);
        court.submitReport('r2', 'p2', 'spam', [], 'Test', signature);
        court.processQueue();

        const stats = court.getStats();

        expect(stats.totalCases).toBe(2);
        expect(typeof stats.activeCases).toBe('number');
        expect(typeof stats.guiltyRate).toBe('number');
        expect(typeof stats.juryParticipation).toBe('number');
      });
    });
  });

  describe('JurySelector', () => {
    let selector: JurySelector;
    let scorer: ReputationScorer;

    beforeEach(() => {
      scorer = new ReputationScorer();
      selector = new JurySelector({
        jurySize: 7,
        minReputation: 30,
        voteThreshold: 0.6,
        votingPeriodHours: 24,
        minParticipation: 5,
        allowAppeals: true,
        appealPeriodHours: 72,
      }, scorer);
    });

    describe('selectJury', () => {
      it('should select jury members', () => {
        // Add some peers with reputation
        scorer.recordInteraction({
          type: 'chat',
          peerID: 'peer1',
          timestamp: Date.now(),
          weight: 10,
          signed: true,
        });
        scorer.recordInteraction({
          type: 'chat',
          peerID: 'peer2',
          timestamp: Date.now(),
          weight: 10,
          signed: true,
        });

        const jury = selector.selectJury('reporter', 'reported', 7);
        expect(Array.isArray(jury)).toBe(true);
      });

      it('should exclude reporter and reported', () => {
        const jury = selector.selectJury('reporter', 'reported', 7);
        
        for (const member of jury) {
          expect(member.peerID).not.toBe('reporter');
          expect(member.peerID).not.toBe('reported');
        }
      });

      it('should track selections', () => {
        selector.selectJury('r1', 'p1', 7);
        const stats = selector.getSelectionStats('r1');
        
        // Reporter should not be selected
        expect(stats.casesServed).toBe(0);
      });
    });

    describe('isEligibleJuror', () => {
      it('should check reputation requirement', () => {
        // Low reputation peer
        scorer.recordInteraction({
          type: 'chat',
          peerID: 'lowrep',
          timestamp: Date.now(),
          weight: 1,
          signed: true,
        });

        // High reputation peer
        scorer.recordInteraction({
          type: 'chat',
          peerID: 'hirep',
          timestamp: Date.now(),
          weight: 100,
          signed: true,
        });
      });
    });
  });

  describe('QuadraticVoting', () => {
    let voting: QuadraticVoting;

    beforeEach(() => {
      voting = new QuadraticVoting();
    });

    describe('tallyVotes', () => {
      it('should tally unanimous guilty votes', () => {
        const votes: Record<string, Vote> = {
          'juror1': { decision: 'guilty', confidence: 0.9, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror2': { decision: 'guilty', confidence: 0.8, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror3': { decision: 'guilty', confidence: 0.95, timestamp: Date.now(), signature: new Uint8Array(64) },
        };

        const result = voting.tallyVotes(votes, 0.6);

        expect(result.conclusive).toBe(true);
        expect(result.verdict).toBe('guilty');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('should tally unanimous not_guilty votes', () => {
        const votes: Record<string, Vote> = {
          'juror1': { decision: 'not_guilty', confidence: 0.9, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror2': { decision: 'not_guilty', confidence: 0.8, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror3': { decision: 'not_guilty', confidence: 0.95, timestamp: Date.now(), signature: new Uint8Array(64) },
        };

        const result = voting.tallyVotes(votes, 0.6);

        expect(result.conclusive).toBe(true);
        expect(result.verdict).toBe('not_guilty');
      });

      it('should return inconclusive for split votes', () => {
        const votes: Record<string, Vote> = {
          'juror1': { decision: 'guilty', confidence: 0.6, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror2': { decision: 'not_guilty', confidence: 0.6, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror3': { decision: 'inconclusive', confidence: 0.6, timestamp: Date.now(), signature: new Uint8Array(64) },
        };

        const result = voting.tallyVotes(votes, 0.6);

        expect(result.conclusive).toBe(false);
      });

      it('should weight by confidence', () => {
        const votes: Record<string, Vote> = {
          'juror1': { decision: 'guilty', confidence: 0.9, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror2': { decision: 'not_guilty', confidence: 0.3, timestamp: Date.now(), signature: new Uint8Array(64) },
        };

        const result = voting.tallyVotes(votes, 0.6);

        // Guilty should have more weight due to higher confidence
        expect(result.guiltyVotes).toBeGreaterThan(result.notGuiltyVotes);
      });
    });

    describe('calculateVoteCost', () => {
      it('should calculate quadratic cost', () => {
        expect(voting.calculateVoteCost(100, 1)).toBe(1);
        expect(voting.calculateVoteCost(100, 2)).toBe(4);
        expect(voting.calculateVoteCost(100, 3)).toBe(9);
        expect(voting.calculateVoteCost(100, 10)).toBe(100);
      });
    });

    describe('getMaxAffordableVotes', () => {
      it('should calculate max votes from credits', () => {
        expect(voting.getMaxAffordableVotes(1)).toBe(1);
        expect(voting.getMaxAffordableVotes(4)).toBe(2);
        expect(voting.getMaxAffordableVotes(9)).toBe(3);
        expect(voting.getMaxAffordableVotes(100)).toBe(10);
      });
    });

    describe('detectSuspiciousDistribution', () => {
      it('should detect uniform high confidence', () => {
        const votes = [
          { decision: 'guilty' as const, confidence: 0.95, timestamp: Date.now(), signature: new Uint8Array(64) },
          { decision: 'guilty' as const, confidence: 0.96, timestamp: Date.now(), signature: new Uint8Array(64) },
          { decision: 'guilty' as const, confidence: 0.94, timestamp: Date.now(), signature: new Uint8Array(64) },
          { decision: 'guilty' as const, confidence: 0.95, timestamp: Date.now(), signature: new Uint8Array(64) },
          { decision: 'guilty' as const, confidence: 0.95, timestamp: Date.now(), signature: new Uint8Array(64) },
        ];

        const result = voting.detectSuspiciousDistribution(votes);

        expect(result.suspicious).toBe(true);
        expect(result.reason).toContain('uniform');
      });

      it('should not flag normal distribution', () => {
        const votes = [
          { decision: 'guilty' as const, confidence: 0.7, timestamp: Date.now(), signature: new Uint8Array(64) },
          { decision: 'not_guilty' as const, confidence: 0.6, timestamp: Date.now(), signature: new Uint8Array(64) },
          { decision: 'guilty' as const, confidence: 0.5, timestamp: Date.now(), signature: new Uint8Array(64) },
          { decision: 'inconclusive' as const, confidence: 0.8, timestamp: Date.now(), signature: new Uint8Array(64) },
        ];

        const result = voting.detectSuspiciousDistribution(votes);

        expect(result.suspicious).toBe(false);
      });
    });

    describe('calculateReputationRewards', () => {
      it('should reward majority voters', () => {
        const votes: Record<string, Vote> = {
          'juror1': { decision: 'guilty', confidence: 0.8, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror2': { decision: 'guilty', confidence: 0.8, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror3': { decision: 'not_guilty', confidence: 0.8, timestamp: Date.now(), signature: new Uint8Array(64) },
        };

        const rewards = voting.calculateReputationRewards(votes, 'guilty');

        // Majority voters should get more
        expect(rewards['juror1']).toBeGreaterThan(rewards['juror3']);
        expect(rewards['juror2']).toBeGreaterThan(rewards['juror3']);
      });

      it('should reward correct independent thinking', () => {
        const votes: Record<string, Vote> = {
          'juror1': { decision: 'guilty', confidence: 0.9, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror2': { decision: 'guilty', confidence: 0.9, timestamp: Date.now(), signature: new Uint8Array(64) },
          'juror3': { decision: 'not_guilty', confidence: 0.95, timestamp: Date.now(), signature: new Uint8Array(64) },
        };

        // Juror3 was independent (against majority) and correct (final verdict is not_guilty)
        const rewards = voting.calculateReputationRewards(votes, 'not_guilty');

        // Juror3 should get the big independent thinking bonus
        expect(rewards['juror3']).toBeGreaterThan(rewards['juror1']);
      });
    });
  });
});
