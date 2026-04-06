/* eslint-disable */
/**
 * Time-Weighted Reputation Decay Tests
 *
 * Tests for Phase 6: Reputation decay with 30-day half-life
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateDecayFactor,
  applyDecayToInteraction,
  isWithinBootstrapPeriod,
  calculateBootstrapBonus,
  applySybilResistance,
  computeDecayedReputation,
  getReputationDecayCurve,
  getInteractionWeight,
  recordWeightedInteraction,
  getEffectiveReputation,
  meetsReputationThreshold,
  timeToReachScore,
  type DecayConfig,
} from '../../src/reputation/decay';
import { recordInteraction, getInteractionHistory } from '../../src/social/graph';

// Mock identity and DB functions
vi.mock('../../src/identity', () => ({
  getPeerID: vi.fn().mockResolvedValue('peer_test'),
  getKeypair: vi.fn().mockResolvedValue({
    publicKey: {} as CryptoKey,
    privateKey: {} as CryptoKey,
  }),
}));

vi.mock('@isc/delegation', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    }),
  },
}));

describe('Reputation Decay', () => {
  describe('calculateDecayFactor', () => {
    it('should return 1.0 for fresh interactions (age = 0)', () => {
      expect(calculateDecayFactor(0, 30)).toBe(1.0);
    });

    it('should return 0.5 after one half-life', () => {
      const factor = calculateDecayFactor(30, 30);
      expect(factor).toBeCloseTo(0.5, 2);
    });

    it('should return 0.25 after two half-lives', () => {
      const factor = calculateDecayFactor(60, 30);
      expect(factor).toBeCloseTo(0.25, 2);
    });

    it('should return 0.125 after three half-lives', () => {
      const factor = calculateDecayFactor(90, 30);
      expect(factor).toBeCloseTo(0.125, 2);
    });

    it('should handle negative age as fresh', () => {
      expect(calculateDecayFactor(-5, 30)).toBe(1.0);
    });

    it('should return 0 for zero half-life', () => {
      expect(calculateDecayFactor(10, 0)).toBe(0.0);
    });

    it('should decay smoothly for partial half-lives', () => {
      const factor15 = calculateDecayFactor(15, 30);
      expect(factor15).toBeGreaterThan(0.5);
      expect(factor15).toBeLessThan(1.0);
    });
  });

  describe('applyDecayToInteraction', () => {
    it('should apply no decay to current interactions', () => {
      const now = Date.now();
      const result = applyDecayToInteraction(now, 10, 30);

      expect(result.decayedWeight).toBeCloseTo(10, 1);
      expect(result.ageInDays).toBeLessThan(0.001);
      expect(result.decayFactor).toBeCloseTo(1.0, 2);
    });

    it('should apply 50% decay after one half-life', () => {
      const halfLifeAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      // In DecayCalculator, the timestamp is considered the *interaction* time.
      // So if age is 30 days and half-life is 30, decayFactor = 0.5. Base weight 10 => 5.
      const result = applyDecayToInteraction(halfLifeAgo, 10, 30);

      expect(result.decayedWeight).toBeCloseTo(5, 0);
      expect(result.ageInDays).toBeCloseTo(30, 0);
    });

    it('should handle different half-life configurations', () => {
      const oldTimestamp = Date.now() - 7 * 24 * 60 * 60 * 1000;

      const result7Day = applyDecayToInteraction(oldTimestamp, 10, 7);
      const result30Day = applyDecayToInteraction(oldTimestamp, 10, 30);

      expect(result7Day.decayedWeight).toBeLessThan(result30Day.decayedWeight);
    });
  });

  describe('isWithinBootstrapPeriod', () => {
    it('should return true for new users', () => {
      const now = Date.now();
      expect(isWithinBootstrapPeriod(now, 7)).toBe(true);
    });

    it('should return false after bootstrap period', () => {
      const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;
      expect(isWithinBootstrapPeriod(oldTimestamp, 7)).toBe(false);
    });

    it('should return true at edge of bootstrap period', () => {
      const edgeTimestamp = Date.now() - 6 * 24 * 60 * 60 * 1000;
      expect(isWithinBootstrapPeriod(edgeTimestamp, 7)).toBe(true);
    });
  });

  describe('calculateBootstrapBonus', () => {
    it('should return 0.2 for brand new users', () => {
      const now = Date.now();
      const bonus = calculateBootstrapBonus(now, {
        halfLifeDays: 30,
        bootstrapPeriodDays: 7,
        sybilCap: 0.3,
        minInteractions: 3,
      });

      expect(bonus).toBeCloseTo(0.2, 2);
    });

    it('should return 0 after bootstrap period', () => {
      const oldTimestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const bonus = calculateBootstrapBonus(oldTimestamp, 7);

      expect(bonus).toBe(0);
    });

    it('should decay linearly during bootstrap period', () => {
      const halfwayTimestamp = Date.now() - 3.5 * 24 * 60 * 60 * 1000;
      const bonus = calculateBootstrapBonus(halfwayTimestamp, {
        halfLifeDays: 30,
        bootstrapPeriodDays: 7,
        sybilCap: 0.3,
        minInteractions: 3,
      });

      expect(bonus).toBeCloseTo(0.1, 1);
    });
  });

  describe('applySybilResistance', () => {
    it('should cap reputation at sybil cap for zero mutual follows', () => {
      const result = applySybilResistance(0.9, 0);
      expect(result).toBeLessThanOrEqual(0.3);
    });

    it('should allow higher scores with mutual follows', () => {
      const result = applySybilResistance(0.9, 10);
      expect(result).toBeGreaterThan(0.3);
    });

    it('should cap mutual follow bonus at 0.4', () => {
      const result = applySybilResistance(0.9, 100);
      expect(result).toBeLessThanOrEqual(0.7); // 0.3 sybil cap + 0.4 mutual bonus
    });

    it('should handle custom sybil cap', () => {
      const config: DecayConfig = {
        halfLifeDays: 30,
        bootstrapPeriodDays: 7,
        sybilCap: 0.5,
        minInteractions: 3,
      };
      const result = applySybilResistance(0.9, 0, config);
      expect(result).toBeLessThanOrEqual(0.5);
    });
  });

  describe('getInteractionWeight', () => {
    it('should return correct weights for known interaction types', () => {
      expect(getInteractionWeight('follow')).toBe(5);
      expect(getInteractionWeight('repost')).toBe(3);
      expect(getInteractionWeight('reply')).toBe(2);
      expect(getInteractionWeight('quote')).toBe(2);
      expect(getInteractionWeight('like')).toBe(1);
    });

    it('should return 1 for unknown interaction types', () => {
      expect(getInteractionWeight('unknown')).toBe(1);
    });
  });

  describe('timeToReachScore', () => {
    it('should return 0 when already at or below target', () => {
      expect(timeToReachScore(0.3, 0.5, 30)).toBe(0);
      expect(timeToReachScore(0.5, 0.5, 30)).toBe(0);
    });

    it('should calculate time to decay to target', () => {
      const days = timeToReachScore(0.8, 0.4, 30);
      expect(days).toBeGreaterThan(0);
      expect(days).toBeLessThan(60);
    });

    it('should return correct time for one half-life', () => {
      const days = timeToReachScore(1.0, 0.5, 30);
      expect(days).toBeCloseTo(30, 0);
    });
  });

  describe('computeDecayedReputation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return zero reputation for user with no interactions', async () => {
      const reputation = await computeDecayedReputation('new_user');

      expect(reputation.peerID).toBe('new_user');
      expect(reputation.rawScore).toBe(0);
      expect(reputation.decayedScore).toBe(0);
      expect(reputation.interactionCount).toBe(0);
    });

    it('should include all score components', async () => {
      const reputation = await computeDecayedReputation('test_user');

      expect(reputation).toHaveProperty('rawScore');
      expect(reputation).toHaveProperty('decayedScore');
      expect(reputation).toHaveProperty('bootstrapBonus');
      expect(reputation).toHaveProperty('sybilAdjustedScore');
      expect(reputation).toHaveProperty('halfLifeDays');
      expect(reputation).toHaveProperty('lastUpdated');
      expect(reputation).toHaveProperty('interactionCount');
      expect(reputation).toHaveProperty('decayCurve');
    });

    it('should have decayed score <= raw score', async () => {
      const reputation = await computeDecayedReputation('test_user');
      expect(reputation.decayedScore).toBeLessThanOrEqual(reputation.rawScore);
    });
  });

  describe('getReputationDecayCurve', () => {
    it('should return decay curve for specified days', async () => {
      const curve = await getReputationDecayCurve('test_user', 30);

      expect(curve.length).toBe(31); // 0 to 30 inclusive
      expect(curve[0].day).toBe(0);
      expect(curve[30].day).toBe(30);
    });

    it('should show decreasing scores over time', async () => {
      const curve = await getReputationDecayCurve('test_user', 30);

      // Scores should generally decrease (may have flat sections at 0)
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].score).toBeLessThanOrEqual(curve[i - 1].score);
      }
    });

    it('should include raw score for comparison', async () => {
      const curve = await getReputationDecayCurve('test_user', 7);

      curve.forEach((point) => {
        expect(point).toHaveProperty('rawScore');
      });
    });
  });

  describe('getEffectiveReputation', () => {
    it('should return score between 0 and 1', async () => {
      const score = await getEffectiveReputation('test_user');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('meetsReputationThreshold', () => {
    it('should return true for zero threshold', async () => {
      const meets = await meetsReputationThreshold('test_user', 0);
      expect(meets).toBe(true);
    });

    it('should return false for impossibly high threshold', async () => {
      const meets = await meetsReputationThreshold('test_user', 0.99);
      expect(meets).toBe(false);
    });
  });
});

describe('Reputation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compute reputation after recording interactions', async () => {
    const peerId = '12D3KooWK8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q9';

    // Record some interactions
    await recordInteraction(peerId, 'like', 1);
    await recordInteraction(peerId, 'repost', 3);

    const reputation = await computeDecayedReputation(peerId);

    expect(reputation.peerID).toBe(peerId);
    expect(reputation.interactionCount).toBeGreaterThanOrEqual(2);
  });

  it('should handle weighted interactions correctly', async () => {
    const peerId = '12D3KooWK8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2R1';

    await recordWeightedInteraction(peerId, 'follow'); // weight 5
    await recordWeightedInteraction(peerId, 'like'); // weight 1

    const reputation = await computeDecayedReputation(peerId);

    expect(reputation.rawScore).toBeGreaterThanOrEqual(6);
  });
});
