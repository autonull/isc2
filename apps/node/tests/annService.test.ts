/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ANNService, type IndexStore, type HNSWIndex } from '../src/supernode/services/ann.js';

describe('ANNService', () => {
  let service: ANNService;
  let mockIndexStore: IndexStore;
  let mockIndex: HNSWIndex;

  beforeEach(() => {
    mockIndex = {
      search: vi.fn().mockReturnValue([
        { key: 'peer1', score: 0.9 },
        { key: 'peer2', score: 0.8 },
      ]),
      add: vi.fn(),
      remove: vi.fn(),
      size: vi.fn().mockReturnValue(10),
    };

    mockIndexStore = {
      get: vi.fn().mockReturnValue(mockIndex),
      set: vi.fn(),
      delete: vi.fn(),
    };

    service = new ANNService(mockIndexStore, 50);
  });

  describe('handleRequest', () => {
    it('should handle valid ANN query request', async () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          query: new Array(384).fill(0.1),
          k: 5,
          modelHash: 'model-hash-123',
        })
      );

      const result = await service.handleRequest(payload);

      const decoded = JSON.parse(new TextDecoder().decode(result));
      expect(decoded.matches).toEqual(['peer1', 'peer2']);
      expect(decoded.scores).toEqual([0.9, 0.8]);
    });

    it('should reject invalid request - wrong query length', async () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          query: [0.1, 0.2], // Too short
          k: 5,
          modelHash: 'model-hash-123',
        })
      );

      await expect(service.handleRequest(payload)).rejects.toThrow('Invalid ANN query request');
    });

    it('should reject invalid request - k too small', async () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          query: new Array(384).fill(0.1),
          k: 0, // Too small
          modelHash: 'model-hash-123',
        })
      );

      await expect(service.handleRequest(payload)).rejects.toThrow('Invalid ANN query request');
    });

    it('should reject invalid request - k too large', async () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          query: new Array(384).fill(0.1),
          k: 200, // Too large
          modelHash: 'model-hash-123',
        })
      );

      await expect(service.handleRequest(payload)).rejects.toThrow('Invalid ANN query request');
    });

    it('should return empty results when index not found', async () => {
      mockIndexStore.get = vi.fn().mockReturnValue(undefined);

      const payload = new TextEncoder().encode(
        JSON.stringify({
          query: new Array(384).fill(0.1),
          k: 5,
          modelHash: 'unknown-model',
        })
      );

      const result = await service.handleRequest(payload);

      const decoded = JSON.parse(new TextDecoder().decode(result));
      expect(decoded.matches).toEqual([]);
      expect(decoded.scores).toEqual([]);
    });

    it('should limit k to index size', async () => {
      mockIndex.size = vi.fn().mockReturnValue(3);

      const payload = new TextEncoder().encode(
        JSON.stringify({
          query: new Array(384).fill(0.1),
          k: 100,
          modelHash: 'model-hash-123',
        })
      );

      await service.handleRequest(payload);

      // Should call search with min(100, 3) = 3
      expect(mockIndex.search).toHaveBeenCalledWith(expect.any(Array), 3);
    });
  });

  describe('getOrCreateIndex', () => {
    it('should return existing index', () => {
      const index = service.getOrCreateIndex('existing-model');

      expect(mockIndexStore.get).toHaveBeenCalledWith('existing-model');
      expect(index).toBe(mockIndex);
    });

    it('should create new index if not exists', () => {
      mockIndexStore.get = vi.fn().mockReturnValue(undefined);

      const index = service.getOrCreateIndex('new-model');

      expect(mockIndexStore.set).toHaveBeenCalled();
      expect(index).toBeDefined();
    });
  });
});
