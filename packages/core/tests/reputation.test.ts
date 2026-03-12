/**
 * Unit Tests for Reputation System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReputationScorer } from '../src/reputation/scorer.js';
import {
  computeDecayFactor,
  computeDecayedScore,
  computeBootstrapBonus,
  computeSybilResistance,
  computeReputationTrend,
  DECAY_HALF_LIFE_DAYS,
} from '../src/reputation/decay.js';
import {
  findTrustPaths,
  computeWoTScore,
  findTrustedIntroducers,
  computeTrustCluster,
} from '../src/reputation/wot.js';

describe('Reputation System', () => {
  describe('Time Decay', () => {
    describe('computeDecayFactor', () => {
      it('should return 1.0 for current timestamp', () => {
        const now = Date.now();
        const factor = computeDecayFactor(now);
        expect(factor).toBeCloseTo(1, 5);
      });

      it('should return 0.5 after one half-life', () => {
        const halfLifeMs = DECAY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
        const timestamp = Date.now() - halfLifeMs;
        const factor = computeDecayFactor(timestamp);
        expect(factor).toBeCloseTo(0.5, 2);
      });

      it('should return 0.25 after two half-lives', () => {
        const twoHalfLivesMs = 2 * DECAY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
        const timestamp = Date.now() - twoHalfLivesMs;
        const factor = computeDecayFactor(timestamp);
        expect(factor).toBeCloseTo(0.25, 2);
      });

      it('should approach 0 for very old timestamps', () => {
        const oldTimestamp = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const factor = computeDecayFactor(oldTimestamp);
        expect(factor).toBeLessThan(0.01);
      });
    });

    describe('computeDecayedScore', () => {
      it('should return 0 for empty interactions', () => {
        const score = computeDecayedScore([]);
        expect(score).toBe(0);
      });

      it('should decay scores over time', () => {
        const now = Date.now();
        const interactions = [
          { score: 10, timestamp: now },
          { score: 10, timestamp: now - DECAY_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000 },
        ];
        const score = computeDecayedScore(interactions);
        expect(score).toBeLessThan(20);
        expect(score).toBeGreaterThan(10);
      });

      it('should cap at maximum score', () => {
        const interactions = Array.from({ length: 100 }, () => ({
          score: 10,
          timestamp: Date.now(),
        }));
        const score = computeDecayedScore(interactions);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    describe('computeBootstrapBonus', () => {
      it('should return 1.5 for brand new peer', () => {
        const bonus = computeBootstrapBonus(Date.now());
        expect(bonus).toBeCloseTo(1.5, 2);
      });

      it('should return 1.0 after bootstrap period', () => {
        const bootstrapPeriodMs = 7 * 24 * 60 * 60 * 1000;
        const timestamp = Date.now() - bootstrapPeriodMs - 1000;
        const bonus = computeBootstrapBonus(timestamp);
        expect(bonus).toBe(1.0);
      });

      it('should interpolate during bootstrap period', () => {
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
        const bonus = computeBootstrapBonus(threeDaysAgo);
        expect(bonus).toBeGreaterThan(1.0);
        expect(bonus).toBeLessThan(1.5);
      });
    });

    describe('computeSybilResistance', () => {
      it('should return low score for new accounts', () => {
        const score = computeSybilResistance(
          'peer1',
          Date.now(),
          new Set(['chat']),
          1,
          false
        );
        expect(score).toBeLessThan(0.3);
      });

      it('should return high score for old diverse accounts', () => {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const score = computeSybilResistance(
          'peer1',
          thirtyDaysAgo,
          new Set(['chat', 'post', 'follow', 'tip', 'court']),
          50,
          true
        );
        expect(score).toBeGreaterThan(0.9);
      });

      it('should increase with account age', () => {
        const newPeer = computeSybilResistance('peer1', Date.now(), new Set(), 0, false);
        const oldPeer = computeSybilResistance(
          'peer2',
          Date.now() - 60 * 24 * 60 * 60 * 1000,
          new Set(),
          0,
          false
        );
        expect(oldPeer).toBeGreaterThan(newPeer);
      });

      it('should increase with interaction diversity', () => {
        const lowDiversity = computeSybilResistance(
          'peer1',
          Date.now(),
          new Set(['chat']),
          0,
          false
        );
        const highDiversity = computeSybilResistance(
          'peer2',
          Date.now(),
          new Set(['chat', 'post', 'follow', 'tip', 'court']),
          0,
          false
        );
        expect(highDiversity).toBeGreaterThan(lowDiversity);
      });

      it('should increase with stake', () => {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const withoutStake = computeSybilResistance(
          'peer1',
          thirtyDaysAgo,
          new Set(['chat']),
          5,
          false
        );
        const withStake = computeSybilResistance(
          'peer2',
          thirtyDaysAgo,
          new Set(['chat']),
          5,
          true
        );
        expect(withStake).toBeGreaterThan(withoutStake);
      });
    });

    describe('computeReputationTrend', () => {
      it('should return increasing for more recent activity', () => {
        const now = Date.now();
        const interactions = [
          // Old interactions
          { type: 'chat', peerID: 'p1', timestamp: now - 45 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          { type: 'chat', peerID: 'p1', timestamp: now - 40 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          // Recent interactions (more)
          { type: 'chat', peerID: 'p1', timestamp: now - 10 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          { type: 'chat', peerID: 'p1', timestamp: now - 5 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          { type: 'chat', peerID: 'p1', timestamp: now - 1 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
        ];
        const trend = computeReputationTrend(interactions as any, 60);
        expect(trend).toBe('increasing');
      });

      it('should return decreasing for less recent activity', () => {
        const now = Date.now();
        const interactions = [
          // Old interactions (more)
          { type: 'chat', peerID: 'p1', timestamp: now - 50 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          { type: 'chat', peerID: 'p1', timestamp: now - 45 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          { type: 'chat', peerID: 'p1', timestamp: now - 40 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          // Recent interactions (less)
          { type: 'chat', peerID: 'p1', timestamp: now - 5 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
        ];
        const trend = computeReputationTrend(interactions as any, 60);
        expect(trend).toBe('decreasing');
      });

      it('should return stable for consistent activity', () => {
        const now = Date.now();
        const interactions = [
          // Older half (30-60 days): 2 interactions
          { type: 'chat', peerID: 'p1', timestamp: now - 50 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          { type: 'chat', peerID: 'p1', timestamp: now - 35 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          // Recent half (0-30 days): 2 interactions
          { type: 'chat', peerID: 'p1', timestamp: now - 25 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
          { type: 'chat', peerID: 'p1', timestamp: now - 10 * 24 * 60 * 60 * 1000, weight: 1, signed: true },
        ];
        const trend = computeReputationTrend(interactions as any, 60);
        expect(trend).toBe('stable');
      });
    });
  });

  describe('ReputationScorer', () => {
    let scorer: ReputationScorer;

    beforeEach(() => {
      scorer = new ReputationScorer();
    });

    it('should compute reputation for a peer', () => {
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'peer1',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });

      const result = scorer.computeReputation('peer1');
      expect(result.peerID).toBe('peer1');
      expect(result.decayedScore).toBeGreaterThan(0);
    });

    it('should apply mutual follow bonus', () => {
      scorer.recordFollow('peer1', 'peer2');
      scorer.recordFollow('peer2', 'peer1');
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'peer1',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });

      const result = scorer.computeReputation('peer1');
      expect(result.mutualFollows).toBe(1);
    });

    it('should compute trust score with WoT', () => {
      // Setup: source -> peer1 -> peer2
      scorer.recordFollow('source', 'peer1');
      scorer.recordFollow('peer1', 'peer2');
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'peer1',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'peer2',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });

      const trustScore = scorer.computeTrustScore('peer2', 'source');
      expect(trustScore.total).toBeGreaterThan(0);
    });

    it('should find trust paths', () => {
      // Setup: A -> B -> C
      scorer.recordFollow('A', 'B');
      scorer.recordFollow('B', 'C');
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'B',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'C',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });

      const paths = scorer.findTrustPaths('A', 'C', 3);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].hops).toContain('B');
    });

    it('should return empty paths when no connection exists', () => {
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'A',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'B',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });

      const paths = scorer.findTrustPaths('A', 'B', 3);
      expect(paths.length).toBe(0);
    });

    it('should export and import state', () => {
      scorer.recordInteraction({
        type: 'chat',
        peerID: 'peer1',
        timestamp: Date.now(),
        weight: 1,
        signed: true,
      });
      scorer.recordFollow('peer1', 'peer2');
      scorer.setStakeStatus('peer1', true);

      const state = scorer.export();
      const newScorer = new ReputationScorer();
      newScorer.import(state);

      const result = newScorer.computeReputation('peer1');
      expect(result.interactionCount).toBe(1);
    });
  });

  describe('Web of Trust', () => {
    describe('findTrustPaths', () => {
      it('should find direct connection', () => {
        const follows = new Map([
          ['A', new Set(['B'])],
          ['B', new Set()],
        ]);
        const trustScores = new Map([['B', 0.8]]);

        const paths = findTrustPaths('A', 'B', follows, trustScores);
        expect(paths.length).toBe(1);
        expect(paths[0].depth).toBe(1);
      });

      it('should find multi-hop paths', () => {
        const follows = new Map([
          ['A', new Set(['B'])],
          ['B', new Set(['C'])],
          ['C', new Set()],
        ]);
        const trustScores = new Map([
          ['B', 0.8],
          ['C', 0.7],
        ]);

        const paths = findTrustPaths('A', 'C', follows, trustScores, 3);
        expect(paths.length).toBeGreaterThan(0);
        expect(paths[0].hops).toContain('B');
      });

      it('should prune low-trust paths', () => {
        const follows = new Map([
          ['A', new Set(['B'])],
          ['B', new Set(['C'])],
          ['C', new Set()],
        ]);
        const trustScores = new Map([
          ['B', 0.2], // Below threshold
          ['C', 0.7],
        ]);

        const paths = findTrustPaths('A', 'C', follows, trustScores, 3);
        expect(paths.length).toBe(0);
      });
    });

    describe('computeWoTScore', () => {
      it('should combine direct and indirect trust', () => {
        const follows = new Map([
          ['A', new Set(['B'])],
          ['B', new Set(['C'])],
        ]);
        const trustScores = new Map([
          ['B', 0.8],
          ['C', 0.6],
        ]);

        const score = computeWoTScore('A', 'C', follows, trustScores);
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    describe('findTrustedIntroducers', () => {
      it('should find common trusted peers', () => {
        const follows = new Map([
          ['A', new Set(['B', 'C', 'D'])],
          ['B', new Set()],
          ['C', new Set()],
          ['D', new Set()],
        ]);
        const targetFollows = new Set(['C', 'D', 'E']);
        follows.set('target', targetFollows);

        const trustScores = new Map([
          ['C', 0.8],
          ['D', 0.6],
        ]);

        const introducers = findTrustedIntroducers('A', 'target', follows, trustScores, 0.5);
        expect(introducers).toContain('C');
        expect(introducers).toContain('D');
        expect(introducers).not.toContain('E');
      });
    });

    describe('computeTrustCluster', () => {
      it('should find all peers within trust distance', () => {
        const follows = new Map([
          ['A', new Set(['B', 'C'])],
          ['B', new Set(['D'])],
          ['C', new Set(['E'])],
          ['D', new Set()],
          ['E', new Set()],
        ]);
        const trustScores = new Map([
          ['B', 0.8],
          ['C', 0.8],
          ['D', 0.7],
          ['E', 0.7],
        ]);

        const cluster = computeTrustCluster('A', follows, trustScores, 2, 0.5);
        expect(cluster.has('A')).toBe(true);
        expect(cluster.has('B')).toBe(true);
        expect(cluster.has('C')).toBe(true);
        expect(cluster.has('D')).toBe(true);
        expect(cluster.has('E')).toBe(true);
      });
    });
  });
});
