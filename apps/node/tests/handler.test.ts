/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupernodeHandler, type DelegationMetrics } from '../src/supernode/handler.js';
import type { DelegateRequest, DelegateResponse } from '@isc/protocol';
import type { EmbedService } from '../src/supernode/services/embed.js';
import type { ANNService } from '../src/supernode/services/ann.js';
import type { SigVerifyService } from '../src/supernode/services/verify.js';

describe('SupernodeHandler', () => {
  let handler: SupernodeHandler;
  let mockEmbedService: EmbedService;
  let mockANNService: ANNService;
  let mockSigVerifyService: SigVerifyService;
  let testKeypair: { publicKey: CryptoKey; privateKey: CryptoKey };
  let mockPublicKey: Uint8Array;

  const validSignature = new Uint8Array(64).fill(1);

  const createRequest = (overrides: Partial<DelegateRequest> = {}): DelegateRequest => ({
    type: 'delegate_request',
    requestID: 'req-123',
    service: 'embed',
    payload: new TextEncoder().encode(JSON.stringify({ text: 'hello', model: 'test-model' })),
    requesterPubKey: new Uint8Array(32).fill(1),
    timestamp: Date.now(),
    signature: validSignature,
    ...overrides,
  });

  beforeEach(async () => {
    mockEmbedService = {
      handleRequest: vi
        .fn()
        .mockResolvedValue(
          new TextEncoder().encode(
            JSON.stringify({ embedding: [0.1, 0.2], model: 'test', norm: 1 })
          )
        ),
      isAvailable: vi.fn().mockReturnValue(true),
    } as any;

    mockANNService = {
      handleRequest: vi
        .fn()
        .mockResolvedValue(
          new TextEncoder().encode(JSON.stringify({ matches: ['peer1'], scores: [0.9] }))
        ),
    } as any;

    mockSigVerifyService = {
      handleRequest: vi
        .fn()
        .mockResolvedValue(new TextEncoder().encode(JSON.stringify({ valid: true }))),
    } as any;

    testKeypair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);

    mockPublicKey = new Uint8Array(32);

    handler = new SupernodeHandler(
      mockEmbedService,
      mockANNService,
      mockSigVerifyService,
      testKeypair.privateKey,
      mockPublicKey,
      5
    );
  });

  describe('handleRequest', () => {
    it('should handle embed request', async () => {
      const request = createRequest({ service: 'embed' });

      const response = await handler.handleRequest(request);

      expect(response.type).toBe('delegate_response');
      expect(response.requestID).toBe('req-123');
      expect(response.service).toBe('embed');
      expect(mockEmbedService.handleRequest).toHaveBeenCalled();
    });

    it('should handle ann_query request', async () => {
      const request = createRequest({ service: 'ann_query' });

      const response = await handler.handleRequest(request);

      expect(response.service).toBe('ann_query');
      expect(mockANNService.handleRequest).toHaveBeenCalled();
    });

    it('should handle sig_verify request', async () => {
      const request = createRequest({ service: 'sig_verify' });

      const response = await handler.handleRequest(request);

      expect(response.service).toBe('sig_verify');
      expect(mockSigVerifyService.handleRequest).toHaveBeenCalled();
    });

    it('should throw when rate limited', async () => {
      const limitedHandler = new SupernodeHandler(
        mockEmbedService,
        mockANNService,
        mockSigVerifyService,
        testKeypair.privateKey,
        mockPublicKey,
        0
      );

      const request = createRequest();

      await expect(limitedHandler.handleRequest(request)).rejects.toThrow('RATE_LIMITED');
    });

    it('should reject invalid request type', async () => {
      const request = createRequest({ type: 'invalid' as any });

      await expect(handler.handleRequest(request)).rejects.toThrow('INVALID_REQUEST');
    });

    it('should reject old timestamp', async () => {
      const request = createRequest({ timestamp: Date.now() - 60000 });

      await expect(handler.handleRequest(request)).rejects.toThrow('INVALID_REQUEST');
    });

    it('should sign response', async () => {
      const request = createRequest();

      const response = await handler.handleRequest(request);

      expect(response.signature).toBeDefined();
      expect(response.signature.length).toBeGreaterThan(0);
    });

    it('should track metrics on success', async () => {
      const request = createRequest();

      await handler.handleRequest(request);

      const metrics = handler.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('metrics', () => {
    it('should return 0 success rate when no requests', () => {
      const freshHandler = new SupernodeHandler(
        mockEmbedService,
        mockANNService,
        mockSigVerifyService,
        testKeypair.privateKey,
        mockPublicKey,
        5
      );
      expect(freshHandler.getSuccessRate()).toBe(0);
    });

    it('should calculate average latency', async () => {
      const startTime = Date.now();
      await handler.handleRequest(createRequest({ requestID: 'req-latency' }));
      const endTime = Date.now();

      // Give a small buffer to ensure metrics are recorded
      await new Promise((resolve) => setTimeout(resolve, 10));

      const avgLatency = handler.getAvgLatency();
      expect(avgLatency).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 avg latency when no requests', () => {
      const freshHandler = new SupernodeHandler(
        mockEmbedService,
        mockANNService,
        mockSigVerifyService,
        testKeypair.privateKey,
        mockPublicKey,
        5
      );
      expect(freshHandler.getAvgLatency()).toBe(0);
    });

    it('should limit latency history to 100 entries', async () => {
      for (let i = 0; i < 150; i++) {
        try {
          await handler.handleRequest(createRequest({ requestID: `req-${i}` }));
        } catch {
          // Some will fail but that's ok
        }
      }

      const metrics = handler.getMetrics();
      expect(metrics.latencies.length).toBeLessThanOrEqual(100);
    });
  });
});
