/* eslint-disable */
/**
 * Post Service Tests
 *
 * Tests post creation with DHT broadcast, liked posts, and optimistic updates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[key]); }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

// Mock networkService
vi.mock('../../src/services/network.ts', () => ({
  networkService: {
    getIdentity: vi.fn().mockReturnValue({ peerId: 'test-peer', name: 'Test User' }),
    createPost: vi.fn().mockImplementation(async (channelId: string, content: string) => ({
      id: `post-${Date.now()}`,
      channelId,
      content,
      author: 'test-peer',
      authorId: 'test-peer',
      createdAt: Date.now(),
    })),
    getStatus: vi.fn().mockReturnValue({ connected: true, status: 'connected' }),
  },
}));

// Mock browserNetworkAdapter
vi.mock('../../src/social/adapters/network.js', () => ({
  browserNetworkAdapter: {
    broadcastPost: vi.fn().mockResolvedValue(undefined),
    requestPosts: vi.fn().mockResolvedValue([]),
    deletePost: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock state
vi.mock('../../src/state.js', () => ({
  actions: {
    addPost: vi.fn(),
    removePost: vi.fn(),
  },
  getState: vi.fn().mockReturnValue({ posts: [] }),
}));

// Mock logger
vi.mock('../../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock DHT
vi.mock('../../src/network/dht.js', () => ({
  getDHTClient: vi.fn().mockReturnValue({
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
  }),
}));

// Mock identity
vi.mock('../../src/identity/index.js', () => ({
  getPeerID: vi.fn().mockResolvedValue('test-peer'),
}));

// Mock @isc/core
vi.mock('@isc/core', () => ({
  encode: vi.fn((data) => new TextEncoder().encode(JSON.stringify(data))),
  sign: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), algorithm: 'Ed25519' as const }),
}));

describe('Post Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a post locally and broadcast to DHT', async () => {
      const { postService } = await import('../../src/services/postService.js');
      const { browserNetworkAdapter } = await import('../../src/social/adapters/network.js');

      await postService.create('ch-1', 'Hello world');

      // Local creation
      expect(networkService.createPost).toHaveBeenCalledWith('ch-1', 'Hello world');

      // DHT broadcast
      expect(browserNetworkAdapter.broadcastPost).toHaveBeenCalled();
    });

    it('should add post to app state', async () => {
      const { postService } = await import('../../src/services/postService.js');
      const { actions } = await import('../../src/state.js');

      await postService.create('ch-1', 'Test post');

      expect(actions.addPost).toHaveBeenCalled();
    });
  });

  describe('liked posts', () => {
    it('should track liked posts in localStorage', async () => {
      const { postService } = await import('../../src/services/postService.js');

      postService.toggleLike('post-1', true);
      expect(postService.isPostLiked('post-1')).toBe(true);
      expect(store['isc:liked-posts']).toContain('post-1');
    });

    it('should unlike a post', async () => {
      const { postService } = await import('../../src/services/postService.js');

      postService.toggleLike('post-1', true);
      expect(postService.isPostLiked('post-1')).toBe(true);

      postService.toggleLike('post-1', false);
      expect(postService.isPostLiked('post-1')).toBe(false);
    });

    it('should persist liked posts across sessions', async () => {
      const { postService } = await import('../../src/services/postService.js');

      postService.toggleLike('post-1', true);
      postService.toggleLike('post-2', true);

      // Simulate reload by re-importing (creates new instance reading from localStorage)
      vi.resetModules();
      const { postService: freshService } = await import('../../src/services/postService.js');

      expect(freshService.isPostLiked('post-1')).toBe(true);
      expect(freshService.isPostLiked('post-2')).toBe(true);
      expect(freshService.isPostLiked('post-3')).toBe(false);
    });
  });

  describe('repost', () => {
    it('should create a repost with reference to original', async () => {
      const { postService } = await import('../../src/services/postService.js');

      const repost = await postService.repost('ch-1', 'original-post-id');

      expect(repost).toBeDefined();
      expect(repost.repostedFrom).toBe('original-post-id');
    });
  });

  describe('reply', () => {
    it('should create a reply with reference to parent', async () => {
      const { postService } = await import('../../src/services/postService.js');

      const reply = await postService.reply('ch-1', 'original-post-id', 'This is a reply');

      expect(reply).toBeDefined();
      expect(reply.replyTo).toBe('original-post-id');
    });
  });
});
