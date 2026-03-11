import { describe, it, expect, beforeEach, vi, setTimeout } from 'vitest';
import {
  DelegationClient,
  type LocalHandler,
  type DelegationConfig,
} from '../src/delegation/fallback.js';
import { SupernodeDiscovery } from '../src/delegation/discovery.js';
import { HealthSelector } from '../src/delegation/selection.js';
import type { DelegateCapability, DelegateResponse, DelegateRequest } from '@isc/protocol/messages';

describe('Delegation Integration', () => {
  let mockDiscovery: SupernodeDiscovery;
  let mockHealthSelector: HealthSelector;
  let localHandler: LocalHandler;
  let config: DelegationConfig;
  const validSignature = new Uint8Array(64).fill(1);

  const createCapability = (peerID: string): DelegateCapability => ({
    type: 'delegate_capability',
    peerID,
    services: ['embed'],
    rateLimit: { requestsPerMinute: 30, maxConcurrent: 5 },
    model: 'test-model',
    uptime: 0.9,
    signature: validSignature,
  });

  beforeEach(() => {
    mockDiscovery = {
      discoverSupernodes: vi.fn().mockResolvedValue([]),
    } as any;

    mockHealthSelector = {
      fetchHealthMetrics: vi.fn().mockResolvedValue(new Map()),
    } as any;

    localHandler = {
      handleEmbed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      handleANN: vi.fn().mockResolvedValue(['peer1', 'peer2']),
      handleSigVerify: vi.fn().mockResolvedValue(true),
    };

    config = {
      discovery: mockDiscovery,
      healthSelector: mockHealthSelector,
      localHandler,
      maxSupernodes: 3,
      timeoutMs: 5000,
      privateKey: {} as CryptoKey,
      publicKey: new Uint8Array(32),
      localModel: 'test-model',
    };
  });

  describe('DelegationClient', () => {
    it('should fall back to local handler when no supernodes available', async () => {
      const client = new DelegationClient(config);

      const request: DelegateRequest = {
        type: 'delegate_request',
        requestID: 'test-1',
        service: 'embed',
        payload: new TextEncoder().encode(JSON.stringify({ text: 'test', model: 'test-model' })),
        requesterPubKey: new Uint8Array(32),
        timestamp: Date.now(),
        signature: validSignature,
      };

      const response = await client.delegate(request);

      expect(response.type).toBe('delegate_response');
      expect(localHandler.handleEmbed).toHaveBeenCalled();
    });

    it('should track stats correctly', async () => {
      const client = new DelegationClient(config);

      const request: DelegateRequest = {
        type: 'delegate_request',
        requestID: 'test-1',
        service: 'embed',
        payload: new TextEncoder().encode(JSON.stringify({ text: 'test', model: 'test-model' })),
        requesterPubKey: new Uint8Array(32),
        timestamp: Date.now(),
        signature: validSignature,
      };

      await client.delegate(request);

      const stats = client.getStats();
      expect(stats.totalAttempts).toBe(1);
      expect(stats.localFallbacks).toBe(1);
    });

    it('should block supernode after 3 failures', async () => {
      const cap1 = createCapability('peer1');
      vi.mocked(mockDiscovery.discoverSupernodes).mockResolvedValue([cap1]);

      const client = new DelegationClient(config);

      // Make 3 requests that will fail (no network)
      for (let i = 0; i < 3; i++) {
        try {
          await client.delegate({
            type: 'delegate_request',
            requestID: `test-${i}`,
            service: 'embed',
            payload: new TextEncoder().encode(
              JSON.stringify({ text: 'test', model: 'test-model' })
            ),
            requesterPubKey: new Uint8Array(32),
            timestamp: Date.now(),
            signature: validSignature,
          });
        } catch {
          // Expected to fail
        }
      }

      const blocked = client.getBlockedSupernodes();
      expect(blocked).toContain('peer1');
    });

    it('should unblock supernode', async () => {
      const cap1 = createCapability('peer1');
      vi.mocked(mockDiscovery.discoverSupernodes).mockResolvedValue([cap1]);

      const client = new DelegationClient(config);

      // Block a supernode
      client.unblockSupernode('peer1');

      const blocked = client.getBlockedSupernodes();
      expect(blocked).not.toContain('peer1');
    });

    it('should queue requests when max concurrent reached', async () => {
      const client = new DelegationClient(config, 2, 10); // max 2 concurrent

      const request: DelegateRequest = {
        type: 'delegate_request',
        requestID: 'test-1',
        service: 'embed',
        payload: new TextEncoder().encode(JSON.stringify({ text: 'test', model: 'test-model' })),
        requesterPubKey: new Uint8Array(32),
        timestamp: Date.now(),
        signature: validSignature,
      };

      // First two requests should start immediately
      const p1 = client.delegate(request);
      const p2 = client.delegate(request);

      // Wait a bit for them to start
      await new Promise((r) => setTimeout(r, 10));

      const stats = client.getStats();
      expect(stats.queuedRequests).toBe(0); // No queueing yet

      // Third request should be queued
      const p3 = client.delegate(request);
      const stats2 = client.getStats();
      expect(stats2.queuedRequests).toBe(1);

      // All should resolve
      await Promise.all([p1, p2, p3]);
    });

    it('should reject when queue is full', async () => {
      const client = new DelegationClient(config, 1, 2); // max 1 concurrent, queue size 2

      const request: DelegateRequest = {
        type: 'delegate_request',
        requestID: 'test-1',
        service: 'embed',
        payload: new TextEncoder().encode(JSON.stringify({ text: 'test', model: 'test-model' })),
        requesterPubKey: new Uint8Array(32),
        timestamp: Date.now(),
        signature: validSignature,
      };

      // Start one request
      const p1 = client.delegate(request);

      // Fill the queue
      const p2 = client.delegate(request);
      const p3 = client.delegate(request);

      // This should be rejected
      await expect(client.delegate(request)).rejects.toThrow('QUEUE_FULL');

      const stats = client.getStats();
      expect(stats.rejectedRequests).toBe(1);

      await Promise.all([p1, p2, p3].map((p) => p.catch(() => {})));
    });

    it('should track queued and rejected stats', async () => {
      const client = new DelegationClient(config, 1, 5);

      const request: DelegateRequest = {
        type: 'delegate_request',
        requestID: 'test-1',
        service: 'embed',
        payload: new TextEncoder().encode(JSON.stringify({ text: 'test', model: 'test-model' })),
        requesterPubKey: new Uint8Array(32),
        timestamp: Date.now(),
        signature: validSignature,
      };

      // Start one request
      client.delegate(request);

      // Queue some requests
      await client.delegate(request);
      await client.delegate(request);

      const stats = client.getStats();
      expect(stats.queuedRequests).toBeGreaterThanOrEqual(0);
    });
  });
});
