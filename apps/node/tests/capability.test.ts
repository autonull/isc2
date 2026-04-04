/* eslint-disable */
import { describe, it, expect } from 'vitest';
import {
  validateDelegateCapability,
  createDelegateCapability,
  scoreSupernode,
  rankSupernodes,
  type SupernodeStats,
} from '../src/supernode/capability.js';

describe('capability', () => {
  const validSignature = new Uint8Array(64);
  validSignature.fill(1);

  describe('validateDelegateCapability', () => {
    it('should return true for valid capability', () => {
      const cap = createDelegateCapability(
        'peer123',
        ['embed', 'ann_query'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'Xenova/all-MiniLM-L6-v2',
        0.95,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(true);
    });

    it('should return false for invalid type', () => {
      const cap = {
        type: 'invalid_type',
        peerID: 'peer123',
        services: ['embed'],
        rateLimit: { requestsPerMinute: 30, maxConcurrent: 5 },
        model: 'test-model',
        uptime: 0.9,
        signature: validSignature,
      };

      expect(validateDelegateCapability(cap as any)).toBe(false);
    });

    it('should return false for missing peerID', () => {
      const cap = createDelegateCapability(
        '',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'test-model',
        0.9,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for empty services', () => {
      const cap = createDelegateCapability(
        'peer123',
        [],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'test-model',
        0.9,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for invalid service', () => {
      const cap = createDelegateCapability(
        'peer123',
        ['invalid_service'] as any,
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'test-model',
        0.9,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for invalid rate limit', () => {
      const cap = createDelegateCapability(
        'peer123',
        ['embed'],
        { requestsPerMinute: 0, maxConcurrent: 5 },
        'test-model',
        0.9,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for negative rate limit', () => {
      const cap = createDelegateCapability(
        'peer123',
        ['embed'],
        { requestsPerMinute: -1, maxConcurrent: 5 },
        'test-model',
        0.9,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for invalid uptime', () => {
      const cap = createDelegateCapability(
        'peer123',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'test-model',
        1.5,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for negative uptime', () => {
      const cap = createDelegateCapability(
        'peer123',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'test-model',
        -0.1,
        validSignature
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for missing signature', () => {
      const cap = createDelegateCapability(
        'peer123',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'test-model',
        0.9,
        new Uint8Array(0)
      );

      expect(validateDelegateCapability(cap)).toBe(false);
    });

    it('should return false for non-Uint8Array signature', () => {
      const cap = {
        type: 'delegate_capability',
        peerID: 'peer123',
        services: ['embed'],
        rateLimit: { requestsPerMinute: 30, maxConcurrent: 5 },
        model: 'test-model',
        uptime: 0.9,
        signature: 'invalid' as any,
      };

      expect(validateDelegateCapability(cap as any)).toBe(false);
    });
  });

  describe('createDelegateCapability', () => {
    it('should create a valid capability', () => {
      const cap = createDelegateCapability(
        'peerABC',
        ['embed', 'ann_query', 'sig_verify'],
        { requestsPerMinute: 60, maxConcurrent: 10 },
        'Xenova/all-MiniLM-L6-v2',
        0.99,
        validSignature
      );

      expect(cap.type).toBe('delegate_capability');
      expect(cap.peerID).toBe('peerABC');
      expect(cap.services).toEqual(['embed', 'ann_query', 'sig_verify']);
      expect(cap.rateLimit.requestsPerMinute).toBe(60);
      expect(cap.rateLimit.maxConcurrent).toBe(10);
      expect(cap.model).toBe('Xenova/all-MiniLM-L6-v2');
      expect(cap.uptime).toBe(0.99);
      expect(cap.signature).toBe(validSignature);
    });
  });

  describe('scoreSupernode', () => {
    it('should score based on uptime, success rate, requests served, and rate limit', () => {
      const cap = createDelegateCapability(
        'peer1',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.9,
        validSignature
      );

      const stats: SupernodeStats = {
        successRate: 0.95,
        avgLatencyMs: 100,
        requestsServed24h: 500,
      };

      const score = scoreSupernode(cap, stats);

      // Expected: 0.9 * 0.4 + 0.95 * 0.3 + 500/1000 * 0.2 + (1 - 30/30) * 0.1
      // = 0.36 + 0.285 + 0.1 + 0 = 0.745
      expect(score).toBeCloseTo(0.745, 2);
    });

    it('should use default stats for missing stats', () => {
      const cap = createDelegateCapability(
        'peer1',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.8,
        validSignature
      );

      const score = scoreSupernode(cap, {
        successRate: 0,
        avgLatencyMs: 0,
        requestsServed24h: 0,
      });

      // Expected: 0.8 * 0.4 + 0 * 0.3 + 0 * 0.2 + 0 * 0.1 = 0.32
      expect(score).toBeCloseTo(0.32, 2);
    });

    it('should favor higher uptime', () => {
      const cap1 = createDelegateCapability(
        'peer1',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.9,
        validSignature
      );
      const cap2 = createDelegateCapability(
        'peer2',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.5,
        validSignature
      );

      const stats: SupernodeStats = {
        successRate: 0.8,
        avgLatencyMs: 100,
        requestsServed24h: 100,
      };

      const score1 = scoreSupernode(cap1, stats);
      const score2 = scoreSupernode(cap2, stats);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should favor higher success rate', () => {
      const cap1 = createDelegateCapability(
        'peer1',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.8,
        validSignature
      );
      const cap2 = createDelegateCapability(
        'peer2',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.8,
        validSignature
      );

      const stats1: SupernodeStats = {
        successRate: 0.95,
        avgLatencyMs: 100,
        requestsServed24h: 100,
      };
      const stats2: SupernodeStats = {
        successRate: 0.5,
        avgLatencyMs: 100,
        requestsServed24h: 100,
      };

      const score1 = scoreSupernode(cap1, stats1);
      const score2 = scoreSupernode(cap2, stats2);

      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('rankSupernodes', () => {
    it('should rank supernodes by score descending', () => {
      const cap1 = createDelegateCapability(
        'peer1',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.9,
        validSignature
      );
      const cap2 = createDelegateCapability(
        'peer2',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.5,
        validSignature
      );
      const cap3 = createDelegateCapability(
        'peer3',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.7,
        validSignature
      );

      const statsMap = new Map<string, SupernodeStats>([
        ['peer1', { successRate: 0.9, avgLatencyMs: 100, requestsServed24h: 500 }],
        ['peer2', { successRate: 0.5, avgLatencyMs: 100, requestsServed24h: 100 }],
        ['peer3', { successRate: 0.8, avgLatencyMs: 100, requestsServed24h: 300 }],
      ]);

      const ranked = rankSupernodes([cap1, cap2, cap3], statsMap);

      expect(ranked[0].peerID).toBe('peer1');
      expect(ranked[1].peerID).toBe('peer3');
      expect(ranked[2].peerID).toBe('peer2');
    });

    it('should handle empty array', () => {
      const ranked = rankSupernodes([], new Map());
      expect(ranked).toEqual([]);
    });

    it('should handle supernodes without stats', () => {
      const cap1 = createDelegateCapability(
        'peer1',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.9,
        validSignature
      );
      const cap2 = createDelegateCapability(
        'peer2',
        ['embed'],
        { requestsPerMinute: 30, maxConcurrent: 5 },
        'model1',
        0.9,
        validSignature
      );

      // peer2 has no stats
      const statsMap = new Map<string, SupernodeStats>([
        ['peer1', { successRate: 0.9, avgLatencyMs: 100, requestsServed24h: 500 }],
      ]);

      const ranked = rankSupernodes([cap1, cap2], statsMap);

      // peer1 should rank higher due to having stats
      expect(ranked[0].peerID).toBe('peer1');
    });
  });
});
