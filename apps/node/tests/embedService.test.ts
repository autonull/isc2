/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmbedService, type EmbedModelAdapter } from '../src/supernode/services/embed.js';

describe('EmbedService', () => {
  let service: EmbedService;
  let mockModelAdapter: EmbedModelAdapter;

  beforeEach(() => {
    mockModelAdapter = {
      load: vi.fn().mockResolvedValue(undefined),
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      unload: vi.fn().mockResolvedValue(undefined),
      isLoaded: vi.fn().mockReturnValue(true),
      getModelId: vi.fn().mockReturnValue('test-model'),
    } as any;

    service = new EmbedService(mockModelAdapter, 'test-model');
  });

  describe('handleRequest', () => {
    it('should handle valid embed request', async () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({ text: 'hello world', model: 'test-model' })
      );

      const result = await service.handleRequest(payload);

      const decoded = JSON.parse(new TextDecoder().decode(result));
      expect(decoded.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(decoded.model).toBe('test-model');
      expect(decoded.norm).toBeDefined();
    });

    it('should reject invalid request', async () => {
      const payload = new TextEncoder().encode(JSON.stringify({ text: '', model: 'test-model' }));

      await expect(service.handleRequest(payload)).rejects.toThrow('Invalid embed request');
    });

    it('should reject model mismatch', async () => {
      const payload = new TextEncoder().encode(
        JSON.stringify({ text: 'hello', model: 'wrong-model' })
      );

      await expect(service.handleRequest(payload)).rejects.toThrow('Model mismatch');
    });

    it('should compute norm correctly', async () => {
      mockModelAdapter.embed = vi.fn().mockResolvedValue([3, 4]); // 3-4-5 triangle

      const payload = new TextEncoder().encode(
        JSON.stringify({ text: 'test', model: 'test-model' })
      );

      const result = await service.handleRequest(payload);
      const decoded = JSON.parse(new TextDecoder().decode(result));

      expect(decoded.norm).toBeCloseTo(5, 5);
    });

    it('should load model if not loaded', async () => {
      mockModelAdapter.isLoaded = vi.fn().mockReturnValue(false);

      const payload = new TextEncoder().encode(
        JSON.stringify({ text: 'test', model: 'test-model' })
      );

      await service.handleRequest(payload);

      expect(mockModelAdapter.load).toHaveBeenCalledWith('test-model');
    });
  });

  describe('isAvailable', () => {
    it('should return true when model is loaded', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when model is not loaded', () => {
      mockModelAdapter.isLoaded = vi.fn().mockReturnValue(false);
      const newService = new EmbedService(mockModelAdapter, 'test-model');

      expect(newService.isAvailable()).toBe(false);
    });
  });
});
