/**
 * Posts Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock identity module
vi.mock('../../src/identity', () => ({
  getPeerID: vi.fn().mockResolvedValue('test-peer-id-123'),
  getKeypair: vi.fn().mockReturnValue({
    privateKey: { toString: () => 'private-key' },
    publicKey: new Uint8Array([4, 5, 6]),
  }),
  getPeerPublicKey: vi.fn().mockResolvedValue(null),
  announcePublicKey: vi.fn().mockResolvedValue(undefined),
}));

// Mock delegation client
const mockDelegationClient = {
  announce: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
};

vi.mock('../../src/delegation/fallback', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue(mockDelegationClient),
  },
}));

// Mock IndexedDB
const mockDB = {
  transaction: vi.fn().mockReturnThis(),
  objectStore: vi.fn().mockReturnThis(),
  get: vi.fn().mockResolvedValue(undefined),
  getAll: vi.fn().mockResolvedValue([]),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/db/helpers', () => ({
  dbGet: vi.fn().mockResolvedValue(null),
  dbGetAll: vi.fn().mockResolvedValue([]),
  dbPut: vi.fn().mockResolvedValue(undefined),
  dbFilter: vi.fn().mockResolvedValue([]),
  dbDelete: vi.fn().mockResolvedValue(undefined),
}));

describe('Posts Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPost', () => {
    it('should create a signed post', async () => {
      const { createPost } = await import('../../src/social/posts');

      const post = await createPost('Hello, world!', 'test-channel');

      expect(post.id).toBeDefined();
      expect(post.author).toBe('test-peer-id-123');
      expect(post.content).toBe('Hello, world!');
      expect(post.channelID).toBe('test-channel');
      expect(post.timestamp).toBeGreaterThan(0);
      expect(post.signature).toBeDefined();
      expect(post.signature.data).toBeDefined();
      expect(post.signature.algorithm).toBe('Ed25519');
    });

    it('should throw error if identity not initialized', async () => {
      vi.mocked(await import('../../src/identity')).getKeypair.mockReturnValue(null);

      const { createPost } = await import('../../src/social/posts');

      await expect(createPost('Hello', 'channel')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('verifyPost', () => {
    it('should return false if public key not found', async () => {
      const { verifyPost } = await import('../../src/social/posts');

      const post = {
        id: 'post-123',
        author: 'unknown-peer',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now(),
        signature: { data: new Uint8Array([1, 2, 3]), algorithm: 'Ed25519' as const },
      };

      const valid = await verifyPost(post);
      expect(valid).toBe(false);
    });
  });

  describe('getPost operations', () => {
    it('should get post by ID', async () => {
      const { getPost } = await import('../../src/social/posts');
      const { dbGet } = await import('../../src/db/helpers');

      const mockPost = {
        id: 'post-123',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now(),
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      vi.mocked(dbGet).mockResolvedValue(mockPost);

      const post = await getPost('post-123');
      expect(post).toEqual(mockPost);
    });

    it('should return null for non-existent post', async () => {
      const { getPost } = await import('../../src/social/posts');
      const { dbGet } = await import('../../src/db/helpers');

      vi.mocked(dbGet).mockResolvedValue(null);

      const post = await getPost('non-existent');
      expect(post).toBeNull();
    });

    it('should get posts by channel', async () => {
      const { getPostsByChannel } = await import('../../src/social/posts');
      const { dbFilter } = await import('../../src/db/helpers');

      const mockPosts = [
        { id: '1', channelID: 'test-channel', author: 'a', content: 'c1', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: '2', channelID: 'test-channel', author: 'b', content: 'c2', timestamp: 2, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.mocked(dbFilter).mockResolvedValue(mockPosts);

      const posts = await getPostsByChannel('test-channel');
      expect(posts).toHaveLength(2);
      expect(posts.every((p) => p.channelID === 'test-channel')).toBe(true);
    });

    it('should get posts by author', async () => {
      const { getPostsByAuthor } = await import('../../src/social/posts');
      const { dbFilter } = await import('../../src/db/helpers');

      const mockPosts = [
        { id: '1', author: 'test-author', content: 'c1', channelID: 'ch', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.mocked(dbFilter).mockResolvedValue(mockPosts);

      const posts = await getPostsByAuthor('test-author');
      expect(posts).toHaveLength(1);
    });
  });

  describe('getAllPosts', () => {
    it('should return all posts from storage', async () => {
      const { getAllPosts } = await import('../../src/social/posts');
      const { dbGetAll } = await import('../../src/db/helpers');

      const mockPosts = [
        { id: '1', author: 'a', content: 'c1', channelID: 'ch', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: '2', author: 'b', content: 'c2', channelID: 'ch', timestamp: 2, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.mocked(dbGetAll).mockResolvedValue(mockPosts);

      const posts = await getAllPosts();
      expect(posts).toHaveLength(2);
    });
  });
});
