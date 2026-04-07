/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SupernodeDiscovery,
  type SupernodeDiscoveryConfig,
  type DHTAdapter,
} from '@isc/delegation';
import type { DelegateCapability } from '@isc/protocol/messages';

describe('SupernodeDiscovery', () => {
  let mockDHT: DHTAdapter;
  let config: SupernodeDiscoveryConfig;
  const validSignature = new Uint8Array(64).fill(1);

  const createCapability = (
    peerID: string,
    services: string[],
    model: string
  ): DelegateCapability => ({
    type: 'delegate_capability',
    peerID,
    services: services as any,
    rateLimit: { requestsPerMinute: 30, maxConcurrent: 5 },
    model,
    uptime: 0.9,
    signature: validSignature,
  });

  beforeEach(() => {
    mockDHT = {
      get: vi.fn(),
      getMany: vi.fn(),
    };
    config = {
      dht: mockDHT,
    };
  });

  describe('discoverSupernodes', () => {
    it('should return empty array when DHT returns nothing', async () => {
      vi.mocked(mockDHT.getMany).mockResolvedValue([]);

      const discovery = new SupernodeDiscovery(config);
      const result = await discovery.discoverSupernodes();

      expect(result).toEqual([]);
    });

    it('should parse and return capabilities from DHT entries', async () => {
      const cap1 = createCapability('peer1', ['embed'], 'model1');
      const cap2 = createCapability('peer2', ['embed', 'ann_query'], 'model1');
      const encoded1 = new TextEncoder().encode(JSON.stringify(cap1));
      const encoded2 = new TextEncoder().encode(JSON.stringify(cap2));

      vi.mocked(mockDHT.getMany).mockResolvedValue([encoded1, encoded2]);

      const discovery = new SupernodeDiscovery(config);
      const result = await discovery.discoverSupernodes();

      expect(result).toHaveLength(2);
      expect(result[0].peerID).toBe('peer1');
      expect(result[1].peerID).toBe('peer2');
    });

    it('should filter by required services', async () => {
      const cap1 = createCapability('peer1', ['embed'], 'model1');
      const cap2 = createCapability('peer2', ['embed', 'ann_query'], 'model1');
      const encoded1 = new TextEncoder().encode(JSON.stringify(cap1));
      const encoded2 = new TextEncoder().encode(JSON.stringify(cap2));

      vi.mocked(mockDHT.getMany).mockResolvedValue([encoded1, encoded2]);

      const discovery = new SupernodeDiscovery({
        ...config,
        requiredServices: ['embed', 'ann_query'],
      });
      const result = await discovery.discoverSupernodes();

      expect(result).toHaveLength(1);
      expect(result[0].peerID).toBe('peer2');
    });

    it('should filter by model', async () => {
      const cap1 = createCapability('peer1', ['embed'], 'model1');
      const cap2 = createCapability('peer2', ['embed'], 'model2');
      const encoded1 = new TextEncoder().encode(JSON.stringify(cap1));
      const encoded2 = new TextEncoder().encode(JSON.stringify(cap2));

      vi.mocked(mockDHT.getMany).mockResolvedValue([encoded1, encoded2]);

      const discovery = new SupernodeDiscovery({
        ...config,
        modelFilter: 'model2',
      });
      const result = await discovery.discoverSupernodes();

      expect(result).toHaveLength(1);
      expect(result[0].peerID).toBe('peer2');
    });

    it('should deduplicate by peerID', async () => {
      const cap1 = createCapability('peer1', ['embed'], 'model1');
      const encoded1 = new TextEncoder().encode(JSON.stringify(cap1));

      vi.mocked(mockDHT.getMany).mockResolvedValue([encoded1, encoded1, encoded1]);

      const discovery = new SupernodeDiscovery(config);
      const result = await discovery.discoverSupernodes();

      expect(result).toHaveLength(1);
      expect(result[0].peerID).toBe('peer1');
    });

    it('should handle invalid JSON gracefully', async () => {
      vi.mocked(mockDHT.getMany).mockResolvedValue([
        new TextEncoder().encode('invalid json'),
        new TextEncoder().encode(JSON.stringify(createCapability('peer1', ['embed'], 'model1'))),
      ]);

      const discovery = new SupernodeDiscovery(config);
      const result = await discovery.discoverSupernodes();

      expect(result).toHaveLength(1);
    });

    it('should handle DHT errors gracefully', async () => {
      vi.mocked(mockDHT.getMany).mockRejectedValue(new Error('Network error'));

      const discovery = new SupernodeDiscovery(config);
      const result = await discovery.discoverSupernodes();

      expect(result).toEqual([]);
    });

    it('should cache discovered supernodes for individual lookup', async () => {
      const cap1 = createCapability('peer1', ['embed'], 'model1');
      const encoded1 = new TextEncoder().encode(JSON.stringify(cap1));

      vi.mocked(mockDHT.getMany).mockResolvedValue([encoded1]);

      const discovery = new SupernodeDiscovery(config);

      await discovery.discoverSupernodes();

      // Now getSupernode should use cache
      const result = await discovery.getSupernode('peer1');

      expect(result?.peerID).toBe('peer1');
      expect(mockDHT.get).not.toHaveBeenCalled();
    });
  });

  describe('getSupernode', () => {
    it('should return capability from cache if fresh', async () => {
      const cap = createCapability('peer1', ['embed'], 'model1');
      const discovery = new SupernodeDiscovery(config);

      (discovery as any).cache.set('peer1', {
        capability: cap,
        timestamp: Date.now(),
      });

      const result = await discovery.getSupernode('peer1');

      expect(result?.peerID).toBe('peer1');
      expect(mockDHT.get).not.toHaveBeenCalled();
    });

    it('should fetch from DHT if cache is stale', async () => {
      const cap = createCapability('peer1', ['embed'], 'model1');
      const encoded = new TextEncoder().encode(JSON.stringify(cap));

      vi.mocked(mockDHT.get).mockResolvedValue(encoded);

      const discovery = new SupernodeDiscovery(config);

      (discovery as any).cache.set('peer1', {
        capability: cap,
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago, stale
      });

      const result = await discovery.getSupernode('peer1');

      expect(mockDHT.get).toHaveBeenCalled();
    });

    it('should return null if not found', async () => {
      vi.mocked(mockDHT.get).mockResolvedValue(null);

      const discovery = new SupernodeDiscovery(config);
      const result = await discovery.getSupernode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const discovery = new SupernodeDiscovery(config);

      (discovery as any).cache.set('peer1', {
        capability: createCapability('peer1', ['embed'], 'model1'),
        timestamp: Date.now(),
      });

      discovery.clearCache();

      expect((discovery as any).cache.size).toBe(0);
    });

    it('should invalidate specific peer', async () => {
      const discovery = new SupernodeDiscovery(config);

      (discovery as any).cache.set('peer1', {
        capability: createCapability('peer1', ['embed'], 'model1'),
        timestamp: Date.now(),
      });
      (discovery as any).cache.set('peer2', {
        capability: createCapability('peer2', ['embed'], 'model1'),
        timestamp: Date.now(),
      });

      discovery.invalidateCache('peer1');

      expect((discovery as any).cache.size).toBe(1);
      expect((discovery as any).cache.has('peer1')).toBe(false);
      expect((discovery as any).cache.has('peer2')).toBe(true);
    });
  });
});
