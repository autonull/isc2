/* eslint-disable */
/**
 * Delegation Ranking Tests
 *
 * Tests for Phase 7: Performance & Scale - Delegation Ranking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DelegationRanker,
  createDelegationRanker,
  type RankingConfig,
  type SupernodeMetrics,
} from '../../src/delegation/ranking';

describe('DelegationRanker', () => {
  let ranker: DelegationRanker;

  beforeEach(() => {
    ranker = createDelegationRanker();
  });

  describe('updateMetrics', () => {
    it('should create metrics for new supernode', () => {
      const metrics = ranker.updateMetrics('peer_1', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 95,
      });

      expect(metrics.peerID).toBe('peer_1');
      expect(metrics.uptimePercent).toBe(99);
      expect(metrics.totalRequests).toBe(100);
    });

    it('should update existing metrics', () => {
      ranker.updateMetrics('peer_1', { uptimePercent: 99 });
      const updated = ranker.updateMetrics('peer_1', { uptimePercent: 98 });

      expect(updated.uptimePercent).toBe(98);
    });

    it('should trim latencies to sample size', () => {
      const latencies = Array(200).fill(100);
      const metrics = ranker.updateMetrics('peer_1', { latencies });

      expect(metrics.latencies.length).toBeLessThanOrEqual(100);
    });
  });

  describe('recordRequest', () => {
    it('should record successful request', () => {
      const metrics = ranker.recordRequest('peer_1', 100, true);

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.consecutiveFailures).toBe(0);
    });

    it('should record failed request', () => {
      const metrics = ranker.recordRequest('peer_1', 500, false);

      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
    });

    it('should update average latency with EMA', () => {
      ranker.recordRequest('peer_1', 100, true);
      ranker.recordRequest('peer_1', 200, true);
      ranker.recordRequest('peer_1', 300, true);

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics.avgLatency).toBeGreaterThan(0);
      expect(metrics.avgLatency).toBeLessThan(300);
    });

    it('should recalculate percentiles', () => {
      for (let i = 1; i <= 100; i++) {
        ranker.recordRequest('peer_1', i, true);
      }

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics.p50Latency).toBeGreaterThan(0);
      expect(metrics.p95Latency).toBeGreaterThan(metrics.p50Latency);
      expect(metrics.p99Latency).toBeGreaterThanOrEqual(metrics.p95Latency);
    });

    it('should reset consecutive failures on success', () => {
      ranker.recordRequest('peer_1', 100, false);
      ranker.recordRequest('peer_1', 100, false);
      ranker.recordRequest('peer_1', 100, true);

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('updateLoad', () => {
    it('should increase load', () => {
      ranker.updateMetrics('peer_1', { maxCapacity: 100, currentLoad: 0 });
      ranker.updateLoad('peer_1', 10);

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics.currentLoad).toBe(10);
      expect(metrics.loadPercent).toBe(10);
    });

    it('should decrease load', () => {
      ranker.updateMetrics('peer_1', { maxCapacity: 100, currentLoad: 50 });
      ranker.updateLoad('peer_1', -10);

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics.currentLoad).toBe(40);
    });

    it('should not go below zero', () => {
      ranker.updateMetrics('peer_1', { maxCapacity: 100, currentLoad: 10 });
      ranker.updateLoad('peer_1', -20);

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics.currentLoad).toBe(0);
    });

    it('should not exceed max capacity', () => {
      ranker.updateMetrics('peer_1', { maxCapacity: 100, currentLoad: 90 });
      ranker.updateLoad('peer_1', 20);

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics.currentLoad).toBe(100);
    });
  });

  describe('rankSupernode', () => {
    it('should return ranking for healthy supernode', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 98,
        p95Latency: 100,
        loadPercent: 30,
        maxCapacity: 100,
      });

      const ranking = ranker.rankSupernode('peer_1');
      expect(ranking).not.toBeNull();
      expect(ranking?.overallScore).toBeGreaterThan(0.5);
    });

    it('should return null for low uptime', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 85, // Below minimum
        totalRequests: 100,
        successfulRequests: 95,
      });

      const ranking = ranker.rankSupernode('peer_1');
      expect(ranking).toBeNull();
    });

    it('should return null for low success rate', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 70, // 70% - below minimum
      });

      const ranking = ranker.rankSupernode('peer_1');
      expect(ranking).toBeNull();
    });

    it('should return null for high load', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 95,
        loadPercent: 95, // Above maximum
      });

      const ranking = ranker.rankSupernode('peer_1');
      expect(ranking).toBeNull();
    });

    it('should include all ranking components', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 95,
        p95Latency: 100,
        loadPercent: 30,
        maxCapacity: 100,
        latencies: Array(20).fill(100),
      });

      const ranking = ranker.rankSupernode('peer_1');
      expect(ranking?.components).toHaveProperty('uptimeScore');
      expect(ranking?.components).toHaveProperty('successRateScore');
      expect(ranking?.components).toHaveProperty('latencyScore');
      expect(ranking?.components).toHaveProperty('consistencyScore');
      expect(ranking?.components).toHaveProperty('loadScore');
      expect(ranking?.components).toHaveProperty('geographicScore');
    });
  });

  describe('rankAll', () => {
    it('should rank all eligible supernodes', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 95,
      });
      ranker.updateMetrics('peer_2', {
        uptimePercent: 98,
        totalRequests: 100,
        successfulRequests: 90,
      });
      ranker.updateMetrics('peer_3', {
        uptimePercent: 85, // Ineligible
        totalRequests: 100,
        successfulRequests: 95,
      });

      const rankings = ranker.rankAll();
      expect(rankings.length).toBe(2);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].rank).toBe(2);
    });

    it('should sort by overall score descending', () => {
      ranker.updateMetrics('peer_low', {
        uptimePercent: 95,
        totalRequests: 100,
        successfulRequests: 85,
      });
      ranker.updateMetrics('peer_high', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 98,
      });

      const rankings = ranker.rankAll();
      expect(rankings[0].peerID).toBe('peer_high');
      expect(rankings[0].overallScore).toBeGreaterThan(rankings[1].overallScore);
    });
  });

  describe('getTopN', () => {
    it('should return top N supernodes', () => {
      for (let i = 1; i <= 10; i++) {
        ranker.updateMetrics(`peer_${i}`, {
          uptimePercent: 99,
          totalRequests: 100,
          successfulRequests: 90 + i,
        });
      }

      const top3 = ranker.getTopN(3);
      expect(top3.length).toBe(3);
      expect(top3[0].rank).toBe(1);
      expect(top3[2].rank).toBe(3);
    });

    it('should return all if fewer than N', () => {
      ranker.updateMetrics('peer_1', { uptimePercent: 99 });
      ranker.updateMetrics('peer_2', { uptimePercent: 99 });

      const top5 = ranker.getTopN(5);
      expect(top5.length).toBe(2);
    });
  });

  describe('getBest', () => {
    it('should return best supernode', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 95,
        totalRequests: 100,
        successfulRequests: 90,
      });
      ranker.updateMetrics('peer_2', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 98,
      });

      const best = ranker.getBest();
      expect(best?.peerID).toBe('peer_2');
    });

    it('should return null if no supernodes', () => {
      const best = ranker.getBest();
      expect(best).toBeNull();
    });
  });

  describe('geographic affinity', () => {
    it('should calculate geographic score', () => {
      ranker.setClientLocation('us-east', 'US');
      
      ranker.updateMetrics('peer_same_country', {
        uptimePercent: 99,
        country: 'US',
        region: 'us-east',
      });
      ranker.updateMetrics('peer_same_region', {
        uptimePercent: 99,
        country: 'CA',
        region: 'us-east',
      });
      ranker.updateMetrics('peer_different', {
        uptimePercent: 99,
        country: 'DE',
        region: 'eu-west',
      });

      const sameCountry = ranker.rankSupernode('peer_same_country');
      const sameRegion = ranker.rankSupernode('peer_same_region');
      const different = ranker.rankSupernode('peer_different');

      expect(sameCountry?.geographicAffinity).toBe(1.0);
      expect(sameRegion?.geographicAffinity).toBe(0.8);
      expect(different?.geographicAffinity).toBeLessThan(0.8);
    });
  });

  describe('getStats', () => {
    it('should return ranking statistics', () => {
      ranker.updateMetrics('peer_1', {
        uptimePercent: 99,
        totalRequests: 100,
        successfulRequests: 95,
      });
      ranker.updateMetrics('peer_2', {
        uptimePercent: 98,
        totalRequests: 100,
        successfulRequests: 90,
      });

      const stats = ranker.getStats();
      expect(stats.totalSupernodes).toBe(2);
      expect(stats.eligibleSupernodes).toBe(2);
      expect(stats.avgScore).toBeGreaterThan(0);
    });

    it('should return zeros for empty ranker', () => {
      const stats = ranker.getStats();
      expect(stats.totalSupernodes).toBe(0);
      expect(stats.eligibleSupernodes).toBe(0);
      expect(stats.avgScore).toBe(0);
    });
  });

  describe('remove', () => {
    it('should remove supernode from tracking', () => {
      ranker.updateMetrics('peer_1', { uptimePercent: 99 });
      ranker.remove('peer_1');

      const metrics = ranker.getMetrics('peer_1');
      expect(metrics).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all supernodes', () => {
      ranker.updateMetrics('peer_1', { uptimePercent: 99 });
      ranker.updateMetrics('peer_2', { uptimePercent: 99 });
      ranker.clear();

      const stats = ranker.getStats();
      expect(stats.totalSupernodes).toBe(0);
    });
  });
});

describe('DelegationRanker - Scoring Components', () => {
  it('should score uptime correctly', () => {
    const ranker = createDelegationRanker();
    
    ranker.updateMetrics('peer_99', { uptimePercent: 99, totalRequests: 100, successfulRequests: 95 });
    ranker.updateMetrics('peer_95', { uptimePercent: 95, totalRequests: 100, successfulRequests: 95 });
    ranker.updateMetrics('peer_90', { uptimePercent: 90, totalRequests: 100, successfulRequests: 95 });

    const score99 = ranker.rankSupernode('peer_99');
    const score95 = ranker.rankSupernode('peer_95');
    const score90 = ranker.rankSupernode('peer_90');

    expect(score99?.components.uptimeScore).toBeGreaterThanOrEqual(score95?.components.uptimeScore);
    expect(score95?.components.uptimeScore).toBeGreaterThanOrEqual(score90?.components.uptimeScore);
  });

  it('should score latency correctly', () => {
    const ranker = createDelegationRanker();
    
    ranker.updateMetrics('peer_fast', {
      uptimePercent: 99,
      totalRequests: 100,
      successfulRequests: 95,
      p95Latency: 50,
      latencies: Array(20).fill(50),
    });
    ranker.updateMetrics('peer_slow', {
      uptimePercent: 99,
      totalRequests: 100,
      successfulRequests: 95,
      p95Latency: 1500,
      latencies: Array(20).fill(1500),
    });

    const fast = ranker.rankSupernode('peer_fast');
    const slow = ranker.rankSupernode('peer_slow');

    expect(fast?.components.latencyScore).toBeGreaterThan(slow?.components.latencyScore);
  });

  it('should score load correctly', () => {
    const ranker = createDelegationRanker();
    
    ranker.updateMetrics('peer_light', {
      uptimePercent: 99,
      totalRequests: 100,
      successfulRequests: 95,
      loadPercent: 20,
      maxCapacity: 100,
    });
    ranker.updateMetrics('peer_heavy', {
      uptimePercent: 99,
      totalRequests: 100,
      successfulRequests: 95,
      loadPercent: 80,
      maxCapacity: 100,
    });

    const light = ranker.rankSupernode('peer_light');
    const heavy = ranker.rankSupernode('peer_heavy');

    expect(light?.components.loadScore).toBeGreaterThan(heavy?.components.loadScore);
  });
});

describe('DelegationRanker - Custom Configuration', () => {
  it('should use custom weights', () => {
    const customConfig: Partial<RankingConfig> = {
      weights: {
        uptimeWeight: 0.30,
        successRateWeight: 0.30,
        latencyWeight: 0.20,
        consistencyWeight: 0.05,
        failureRateWeight: 0.05,
        loadWeight: 0.05,
        capacityWeight: 0.05,
        geographicWeight: 0,
        networkQualityWeight: 0,
      },
    };

    const ranker = createDelegationRanker(customConfig);
    ranker.updateMetrics('peer_1', {
      uptimePercent: 99,
      totalRequests: 100,
      successfulRequests: 95,
    });

    const ranking = ranker.rankSupernode('peer_1');
    expect(ranking).not.toBeNull();
  });

  it('should use custom thresholds', () => {
    const customConfig: Partial<RankingConfig> = {
      minUptimePercent: 99,
      minSuccessRate: 0.95,
      maxLatencyMs: 500,
    };

    const ranker = createDelegationRanker(customConfig);
    
    // 98% uptime should be ineligible with 99% minimum
    ranker.updateMetrics('peer_1', {
      uptimePercent: 98,
      totalRequests: 100,
      successfulRequests: 95,
    });

    const ranking = ranker.rankSupernode('peer_1');
    expect(ranking).toBeNull();
  });
});

describe('DelegationRanker - Edge Cases', () => {
  it('should handle new supernode with no requests', () => {
    const ranker = createDelegationRanker();
    ranker.updateMetrics('peer_new', {
      uptimePercent: 100,
      totalRequests: 0,
      successfulRequests: 0,
    });

    const ranking = ranker.rankSupernode('peer_new');
    expect(ranking).not.toBeNull();
    expect(ranking?.components.successRateScore).toBe(0.5); // Default for new nodes
  });

  it('should handle many supernodes', () => {
    const ranker = createDelegationRanker();
    
    for (let i = 0; i < 100; i++) {
      ranker.updateMetrics(`peer_${i}`, {
        uptimePercent: 90 + Math.random() * 10,
        totalRequests: 100,
        successfulRequests: 85 + Math.random() * 14,
        p95Latency: 50 + Math.random() * 200,
      });
    }

    const rankings = ranker.rankAll();
    expect(rankings.length).toBeGreaterThan(0);
    expect(rankings[0].rank).toBe(1);
  });

  it('should handle consistent latency', () => {
    const ranker = createDelegationRanker();
    
    // Record requests with consistent latency
    for (let i = 0; i < 50; i++) {
      ranker.recordRequest('peer_consistent', 100, true);
    }

    const ranking = ranker.rankSupernode('peer_consistent');
    expect(ranking?.components.consistencyScore).toBeGreaterThan(0.8);
  });

  it('should handle variable latency', () => {
    const ranker = createDelegationRanker();
    
    // Record requests with variable latency
    for (let i = 0; i < 50; i++) {
      const latency = 50 + Math.random() * 200;
      ranker.recordRequest('peer_variable', latency, true);
    }

    const ranking = ranker.rankSupernode('peer_variable');
    expect(ranking?.components.consistencyScore).toBeLessThan(0.8);
  });
});
