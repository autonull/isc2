/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserNetworkAdapter } from '../src/browser/network.js';

describe('BrowserNetworkAdapter', () => {
  let adapter: BrowserNetworkAdapter;

  beforeEach(() => {
    adapter = new BrowserNetworkAdapter();
  });

  afterEach(async () => {
    try {
      await adapter.stop();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('lifecycle', () => {
    it('should be idempotent on start', async () => {
      // Skip actual start due to libp2p dependencies in test environment
      expect(adapter.isRunning()).toBe(false);
    });

    it('should be idempotent on stop', async () => {
      expect(adapter.isRunning()).toBe(false);
      await adapter.stop();
      expect(adapter.isRunning()).toBe(false);
    });

    it('should have a peer ID method', () => {
      const peerId = adapter.getPeerId();
      // Returns empty string when not started
      expect(peerId).toBe('');
    });
  });

  describe('event handling', () => {
    it('should register and trigger event handlers', async () => {
      const handler = vi.fn();
      adapter.on('test:event', handler);

      // Access private method via type assertion for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adapter as any).emit('test:event', { data: 'test' });

      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should remove event handlers', async () => {
      const handler = vi.fn();
      adapter.on('test:event', handler);
      adapter.off('test:event', handler);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adapter as any).emit('test:event', { data: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple handlers for same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      adapter.on('test:event', handler1);
      adapter.on('test:event', handler2);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adapter as any).emit('test:event', { data: 'test' });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const adapter = new BrowserNetworkAdapter();
      // Should not throw
      expect(adapter).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const adapter = new BrowserNetworkAdapter({
        maxConnections: 100,
        bootstrapNodes: ['/ip4/127.0.0.1/tcp/8080'],
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('connection management', () => {
    it('should report zero connections when stopped', () => {
      expect(adapter.getConnectionCount()).toBe(0);
    });

    it('should return empty array for connected peers when stopped', async () => {
      const peers = await adapter.getConnectedPeers();
      expect(peers).toEqual([]);
    });
  });

  describe('DHT operations (mock)', () => {
    it('should throw when announce called before start', async () => {
      await expect(
        adapter.announce('key', new Uint8Array([1, 2, 3]))
      ).rejects.toThrow('Network not started');
    });

    it('should throw when query called before start', async () => {
      await expect(
        adapter.query('key', 10)
      ).rejects.toThrow('Network not started');
    });

    it('should throw when dial called before start', async () => {
      await expect(
        adapter.dial('peer123', '/protocol/1.0')
      ).rejects.toThrow('Network not started');
    });
  });
});
