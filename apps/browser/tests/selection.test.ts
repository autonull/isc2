/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthSelector } from '../src/delegation/selection.js';
import type { DelegationHealth } from '@isc/protocol/messages';

const createMockHealth = (overrides: Partial<DelegationHealth> = {}): DelegationHealth => ({
  type: 'delegation_health',
  peerID: '12D3KooWK8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2R2',
  successRate: 0.9,
  avgLatencyMs: 500,
  requestsServed24h: 100,
  timestamp: Date.now(),
  signature: new Uint8Array([1, 2, 3]),
  ...overrides,
});

describe('HealthSelector', () => {
  let selector: HealthSelector;
  let mockDHT: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDHT = {
      get: vi.fn().mockResolvedValue(null),
    };
    selector = new HealthSelector({
      dht: mockDHT as any,
      cacheTTL: 5 * 60 * 1000,
      minSuccessRate: 0.85,
    });
  });

  describe('fetchHealthMetrics', () => {
    it('should return empty map when no peerIDs provided', async () => {
      const result = await selector.fetchHealthMetrics([]);
      expect(result.size).toBe(0);
    });

    it('should fetch health from DHT for each peer', async () => {
      const health = createMockHealth({ peerID: 'peer1' });
      const encoder = new TextEncoder();
      mockDHT.get = vi.fn().mockResolvedValue(encoder.encode(JSON.stringify(health)));

      const result = await selector.fetchHealthMetrics(['peer1']);

      expect(mockDHT.get).toHaveBeenCalledWith('/isc/health/peer1');
      expect(result.get('peer1')?.peerID).toBe('peer1');
    });

    it('should use cached health when available and fresh', async () => {
      const health = createMockHealth({ peerID: 'peer1' });
      const encoder = new TextEncoder();
      mockDHT.get = vi.fn().mockResolvedValue(encoder.encode(JSON.stringify(health)));

      await selector.fetchHealthMetrics(['peer1']);
      await selector.fetchHealthMetrics(['peer1']);

      expect(mockDHT.get).toHaveBeenCalledTimes(1);
    });

    it('should return cached health when DHT fetch fails', async () => {
      const health = createMockHealth({ peerID: 'peer1' });
      const encoder = new TextEncoder();
      mockDHT.get = vi
        .fn()
        .mockResolvedValueOnce(encoder.encode(JSON.stringify(health)))
        .mockRejectedValueOnce(new Error('Network error'));

      await selector.fetchHealthMetrics(['peer1']);
      const result = await selector.fetchHealthMetrics(['peer1']);

      expect(result.get('peer1')?.peerID).toBe('peer1');
    });

    it('should skip invalid health entries', async () => {
      const invalidHealth = { peerID: 'peer1', successRate: 1.5 };
      const encoder = new TextEncoder();
      mockDHT.get = vi.fn().mockResolvedValue(encoder.encode(JSON.stringify(invalidHealth)));

      const result = await selector.fetchHealthMetrics(['peer1']);

      expect(result.size).toBe(0);
    });

    it('should skip expired health entries', async () => {
      const expiredHealth = createMockHealth({
        peerID: 'peer1',
        timestamp: Date.now() - 10 * 60 * 1000,
      });
      const encoder = new TextEncoder();
      mockDHT.get = vi.fn().mockResolvedValue(encoder.encode(JSON.stringify(expiredHealth)));

      const result = await selector.fetchHealthMetrics(['peer1']);

      expect(result.size).toBe(0);
    });
  });

  describe('filterByHealth', () => {
    it('should filter out supernodes below success rate threshold', () => {
      const healthMap = new Map<string, DelegationHealth>([
        ['good', createMockHealth({ peerID: 'good', successRate: 0.9 })],
        ['bad', createMockHealth({ peerID: 'bad', successRate: 0.5 })],
        ['borderline', createMockHealth({ peerID: 'borderline', successRate: 0.85 })],
      ]);

      const result = selector.filterByHealth(healthMap);

      expect(result.has('good')).toBe(true);
      expect(result.has('bad')).toBe(false);
      expect(result.has('borderline')).toBe(true);
    });
  });

  describe('getHealthyPeerIDs', () => {
    it('should include peers without health data', () => {
      const capabilities = [{ peerID: '12D3KooWK8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q5' }, { peerID: '12D3KooWK8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q6' }];
      const healthMap = new Map<string, DelegationHealth>([
        ['known', createMockHealth({ peerID: '12D3KooWK8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q6', successRate: 0.9 })],
      ]);

      const result = selector.getHealthyPeerIDs(capabilities, healthMap);

      expect(result).toContain('unknown');
      expect(result).toContain('known');
    });

    it('should exclude peers with low success rate', () => {
      const capabilities = [{ peerID: 'good' }, { peerID: 'bad' }];
      const healthMap = new Map<string, DelegationHealth>([
        ['good', createMockHealth({ peerID: 'good', successRate: 0.9 })],
        ['bad', createMockHealth({ peerID: 'bad', successRate: 0.5 })],
      ]);

      const result = selector.getHealthyPeerIDs(capabilities, healthMap);

      expect(result).toContain('good');
      expect(result).not.toContain('bad');
    });
  });

  describe('cache management', () => {
    it('should clear all cached health data', async () => {
      const health = createMockHealth({ peerID: 'peer1' });
      const encoder = new TextEncoder();
      mockDHT.get = vi.fn().mockResolvedValue(encoder.encode(JSON.stringify(health)));

      await selector.fetchHealthMetrics(['peer1']);
      selector.clearCache();
      await selector.fetchHealthMetrics(['peer1']);

      expect(mockDHT.get).toHaveBeenCalledTimes(2);
    });

    it('should invalidate specific peer health', async () => {
      const health = createMockHealth({ peerID: 'peer1' });
      const encoder = new TextEncoder();
      mockDHT.get = vi.fn().mockResolvedValue(encoder.encode(JSON.stringify(health)));

      await selector.fetchHealthMetrics(['peer1']);
      selector.invalidateCache('peer1');
      await selector.fetchHealthMetrics(['peer1']);

      expect(mockDHT.get).toHaveBeenCalledTimes(2);
    });
  });
});
