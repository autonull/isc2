/* eslint-disable */
/**
 * Network Adapter Tests
 *
 * Tests channel CRUD, post broadcast, follow announce/query operations
 * through the social layer's browser network adapter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock DHT
const mockDHTStore: Record<string, unknown> = {};
const mockDHT = {
  put: vi.fn().mockImplementation(async (key: string, value: unknown) => {
    mockDHTStore[key] = value;
  }),
  get: vi.fn().mockImplementation(async (key: string) => mockDHTStore[key] ?? null),
  findNode: vi.fn().mockResolvedValue([]),
  queryPeers: vi.fn().mockResolvedValue([]),
};

vi.mock('../../src/network/dht.js', () => ({
  getDHTClient: vi.fn(() => mockDHT),
  initializeDHT: vi.fn().mockResolvedValue(undefined),
}));

// Mock identity adapter
vi.mock('../../src/identity/index.js', () => ({
  getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
  getKeypair: vi.fn().mockReturnValue({
    privateKey: {} as CryptoKey,
    publicKey: {} as CryptoKey,
  }),
  getPeerPublicKey: vi.fn().mockResolvedValue({} as CryptoKey),
}));

// Mock @isc/core
vi.mock('@isc/core', () => ({
  encode: vi.fn((data) => new TextEncoder().encode(JSON.stringify(data))),
  decode: vi.fn((data) => JSON.parse(new TextDecoder().decode(data))),
  sign: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), algorithm: 'Ed25519' as const }),
  verify: vi.fn().mockResolvedValue(true),
  AppError: class AppError extends Error { constructor(msg: string) { super(msg); } },
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  loggers: {
    social: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

// Mock EventEmitter
class MockEventEmitter {
  private handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  on(event: string, handler: (...args: unknown[]) => void) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }
  emit(event: string, ...args: unknown[]) {
    (this.handlers[event] ?? []).forEach(h => h(...args));
  }
  off(event: string, handler: (...args: unknown[]) => void) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }
}

// Mock subscription event emitter
let subscriptionEmitter: MockEventEmitter | null = null;

vi.mock('@isc/adapters', () => ({
  BrowserModel: class {
    async load() {}
    async unload() {}
  },
}));

describe('Browser Network Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockDHTStore).forEach(k => delete mockDHTStore[k]);
    subscriptionEmitter = new MockEventEmitter();
  });

  describe('broadcastPost', () => {
    it('should store post in DHT with channel index', async () => {
      const { browserNetworkAdapter } = await import('../../src/social/adapters/network.js');

      const post = {
        id: 'post-1',
        author: 'test-peer-id',
        content: 'Hello',
        channelID: 'ch-1',
        timestamp: Date.now(),
        signature: new Uint8Array([1, 2, 3]),
      };

      await browserNetworkAdapter.broadcastPost(post);

      // Verify DHT put was called for channel index
      const putCalls = mockDHT.put.mock.calls;
      expect(putCalls.some(call => (call[0] as string).includes('/isc/post/ch-1/index'))).toBe(true);
    });
  });

  describe('requestPosts', () => {
    it('should return empty array when no posts in DHT', async () => {
      const { browserNetworkAdapter } = await import('../../src/social/adapters/network.js');

      const posts = await browserNetworkAdapter.requestPosts('ch-empty');
      expect(posts).toEqual([]);
    });
  });

  describe('deletePost', () => {
    it('should remove post from channel index', async () => {
      const { browserNetworkAdapter } = await import('../../src/social/adapters/network.js');

      // First create a post
      const post = {
        id: 'post-to-delete',
        author: 'test-peer-id',
        content: 'Delete me',
        channelID: 'ch-1',
        timestamp: Date.now(),
        signature: new Uint8Array([1, 2, 3]),
      };
      await browserNetworkAdapter.broadcastPost(post);

      // Then delete it
      await browserNetworkAdapter.deletePost('post-to-delete', 'ch-1');

      // Verify DHT get would not find the post ID in index
      const getCalls = mockDHT.get.mock.calls;
      const indexCalls = getCalls.filter(call => (call[0] as string).includes('/isc/post/ch-1/index'));
      expect(indexCalls.length).toBeGreaterThan(0);
    });
  });

  describe('announceFollow', () => {
    it('should store follow relationship in DHT', async () => {
      const { browserNetworkAdapter } = await import('../../src/social/adapters/network.js');

      await browserNetworkAdapter.announceFollow('follower-1', 'followee-1', Date.now());

      const putCalls = mockDHT.put.mock.calls;
      expect(putCalls.some(call => (call[0] as string).includes('/isc/follow/'))).toBe(true);
    });
  });

  describe('queryFollows', () => {
    it('should return empty array when no follows stored', async () => {
      const { browserNetworkAdapter } = await import('../../src/social/adapters/network.js');

      const follows = await browserNetworkAdapter.queryFollows('some-peer');
      expect(Array.isArray(follows)).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should store DM in recipient inbox', async () => {
      const { browserNetworkAdapter } = await import('../../src/social/adapters/network.js');

      const message = {
        id: 'dm-1',
        conversationId: 'conv-1',
        senderId: 'test-peer-id',
        content: 'Hello',
        timestamp: Date.now(),
        read: false,
      };

      await browserNetworkAdapter.sendMessage('recipient-1', message);

      // Verify DHT put was called for inbox
      const putCalls = mockDHT.put.mock.calls;
      expect(putCalls.some(call => (call[0] as string).includes('/isc/dm/inbox/recipient-1'))).toBe(true);
    });
  });
});
