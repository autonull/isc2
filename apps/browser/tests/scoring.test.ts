/* eslint-disable */
import { describe, it, expect } from 'vitest';
import {
  scoreSupernode,
  rankSupernodes,
  filterHealthySupernodes,
  selectTopSupernodes,
  type SupernodeStats,
} from '../src/delegation/scoring.js';
import type { DelegateCapability, DelegationHealth } from '@isc/protocol/messages';

describe('scoring', () => {
  const validSignature = new Uint8Array(64).fill(1);

  const createCapability = (
    peerID: string,
    uptime: number,
    rateLimit: number
  ): DelegateCapability => ({
    type: 'delegate_capability',
    peerID,
    services: ['embed'],
    rateLimit: { requestsPerMinute: rateLimit, maxConcurrent: 5 },
    model: 'test-model',
    uptime,
    signature: validSignature,
  });

  describe('scoreSupernode', () => {
    it('should calculate score based on all factors', () => {
      const cap = createCapability('peer1', 0.9, 30);
      const stats: SupernodeStats = {
        successRate: 0.9,
        avgLatencyMs: 100,
        requestsServed24h: 500,
      };

      const score = scoreSupernode(cap, stats);

      // uptimeScore = 0.9, successRateScore = 0.9, throughputScore = 0.5, rateLimitScore = 0
      // score = 0.9*0.4 + 0.9*0.3 + 0.5*0.2 + 0*0.1 = 0.36 + 0.27 + 0.1 + 0 = 0.73
      expect(score).toBeCloseTo(0.73, 2);
    });

    it('should cap throughput at 1', () => {
      const cap = createCapability('peer1', 0.9, 30);
      const stats: SupernodeStats = {
        successRate: 0.9,
        avgLatencyMs: 100,
        requestsServed24h: 2000, // More than 1000
      };

      const score = scoreSupernode(cap, stats);

      // throughputScore = min(2, 1) = 1
      // score = 0.9*0.4 + 0.9*0.3 + 1*0.2 + 0*0.1 = 0.36 + 0.27 + 0.2 = 0.83
      expect(score).toBeCloseTo(0.83, 2);
    });

    it('should favor lower rate limit (higher score)', () => {
      const cap1 = createCapability('peer1', 0.8, 10);
      const cap2 = createCapability('peer2', 0.8, 30);
      const stats: SupernodeStats = {
        successRate: 0.8,
        avgLatencyMs: 100,
        requestsServed24h: 100,
      };

      const score1 = scoreSupernode(cap1, stats);
      const score2 = scoreSupernode(cap2, stats);

      // rateLimitScore1 = 1 - 10/30 = 0.667
      // rateLimitScore2 = 1 - 30/30 = 0
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('rankSupernodes', () => {
    it('should rank supernodes by score descending', () => {
      const cap1 = createCapability('peer1', 0.9, 30);
      const cap2 = createCapability('peer2', 0.5, 30);
      const cap3 = createCapability('peer3', 0.7, 30);

      const healthMap = new Map<string, DelegationHealth>();
      const statsMap = new Map<string, SupernodeStats>([
        ['peer1', { successRate: 0.9, avgLatencyMs: 100, requestsServed24h: 500 }],
        ['peer2', { successRate: 0.5, avgLatencyMs: 100, requestsServed24h: 100 }],
        ['peer3', { successRate: 0.8, avgLatencyMs: 100, requestsServed24h: 300 }],
      ]);

      const ranked = rankSupernodes([cap1, cap2, cap3], healthMap, statsMap);

      expect(ranked[0].capability.peerID).toBe('peer1');
      expect(ranked[1].capability.peerID).toBe('peer3');
      expect(ranked[2].capability.peerID).toBe('peer2');
    });

    it('should use health data when stats are missing', () => {
      const cap1 = createCapability('peer1', 0.9, 30);
      const cap2 = createCapability('peer2', 0.7, 30);

      const healthMap = new Map<string, DelegationHealth>([
        [
          'peer1',
          {
            type: 'delegation_health',
            peerID: 'peer1',
            successRate: 0.95,
            avgLatencyMs: 50,
            requestsServed24h: 800,
            timestamp: Date.now(),
            signature: validSignature,
          },
        ],
      ]);
      const statsMap = new Map<string, SupernodeStats>();

      const ranked = rankSupernodes([cap1, cap2], healthMap, statsMap);

      expect(ranked[0].capability.peerID).toBe('peer1');
    });

    it('should use defaults when no stats or health available', () => {
      const cap1 = createCapability('peer1', 0.9, 30);

      const ranked = rankSupernodes([cap1], new Map(), new Map());

      expect(ranked[0].stats.successRate).toBe(0.5); // Default
    });
  });

  describe('filterHealthySupernodes', () => {
    it('should filter out supernodes with low success rate', () => {
      const scored = [
        {
          capability: createCapability('peer1', 0.9, 30),
          score: 0.9,
          stats: { successRate: 0.95, avgLatencyMs: 100, requestsServed24h: 500 },
        },
        {
          capability: createCapability('peer2', 0.8, 30),
          score: 0.7,
          stats: { successRate: 0.5, avgLatencyMs: 100, requestsServed24h: 100 },
        },
        {
          capability: createCapability('peer3', 0.7, 30),
          score: 0.5,
          stats: { successRate: 0.9, avgLatencyMs: 100, requestsServed24h: 300 },
        },
      ] as any;

      const filtered = filterHealthySupernodes(scored, 0.85);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((s) => s.capability.peerID)).toContain('peer1');
      expect(filtered.map((s) => s.capability.peerID)).toContain('peer3');
    });

    it('should use default threshold of 0.85', () => {
      const scored = [
        {
          capability: createCapability('peer1', 0.9, 30),
          score: 0.9,
          stats: { successRate: 0.84, avgLatencyMs: 100, requestsServed24h: 500 },
        },
        {
          capability: createCapability('peer2', 0.9, 30),
          score: 0.9,
          stats: { successRate: 0.86, avgLatencyMs: 100, requestsServed24h: 500 },
        },
      ] as any;

      const filtered = filterHealthySupernodes(scored);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].capability.peerID).toBe('peer2');
    });
  });

  describe('selectTopSupernodes', () => {
    it('should return top N supernodes', () => {
      const scored = [
        {
          capability: createCapability('peer1', 0.9, 30),
          score: 0.9,
          stats: { successRate: 0.9, avgLatencyMs: 100, requestsServed24h: 500 },
        },
        {
          capability: createCapability('peer2', 0.8, 30),
          score: 0.8,
          stats: { successRate: 0.8, avgLatencyMs: 100, requestsServed24h: 400 },
        },
        {
          capability: createCapability('peer3', 0.7, 30),
          score: 0.7,
          stats: { successRate: 0.7, avgLatencyMs: 100, requestsServed24h: 300 },
        },
        {
          capability: createCapability('peer4', 0.6, 30),
          score: 0.6,
          stats: { successRate: 0.6, avgLatencyMs: 100, requestsServed24h: 200 },
        },
      ] as any;

      const selected = selectTopSupernodes(scored, 2);

      expect(selected).toHaveLength(2);
      expect(selected[0].capability.peerID).toBe('peer1');
      expect(selected[1].capability.peerID).toBe('peer2');
    });

    it('should return all if fewer than count', () => {
      const scored = [
        {
          capability: createCapability('peer1', 0.9, 30),
          score: 0.9,
          stats: { successRate: 0.9, avgLatencyMs: 100, requestsServed24h: 500 },
        },
      ] as any;

      const selected = selectTopSupernodes(scored, 5);

      expect(selected).toHaveLength(1);
    });
  });
});
