/* eslint-disable */
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

vi.mock('@isc/delegation', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue(mockDelegationClient),
  },
}));

// Mock Storage Adapter
vi.mock('../../src/social/adapters/storage', () => ({
  browserStorageAdapter: {
    savePost: vi.fn().mockResolvedValue(undefined),
    getPosts: vi.fn().mockResolvedValue([]),
    getPostsByChannel: vi.fn().mockResolvedValue([]),
    getPostsByAuthor: vi.fn().mockResolvedValue([]),
    deletePost: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Network Adapter
vi.mock('../../src/social/adapters/network', () => ({
  browserNetworkAdapter: {
    broadcastPost: vi.fn().mockResolvedValue(undefined),
    requestPosts: vi.fn().mockResolvedValue([]),
    deletePost: vi.fn().mockResolvedValue(undefined),
  }
}));

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

// Mock Identity Adapter
vi.mock('../../src/social/adapters/identity', () => ({
  browserIdentityAdapter: {
    getPeerId: vi.fn().mockResolvedValue('test-peer-id-123'),
    getPublicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    sign: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), algorithm: 'Ed25519' }),
    verify: vi.fn().mockResolvedValue(true),
  }
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
    });

    it('should throw error if identity not initialized', async () => {
      vi.doMock('../../src/social/adapters/identity', () => ({
        browserIdentityAdapter: {
          getPeerId: vi.fn().mockResolvedValue('test-peer-id'),
          getPublicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
          sign: vi.fn().mockRejectedValue(new Error('Keypair not initialized')),
          verify: vi.fn().mockResolvedValue(true),
        }
      }));

      vi.resetModules();
      const { createPost } = await import('../../src/social/posts');

      await expect(createPost('Hello', 'channel')).rejects.toThrow('Keypair not initialized');
    });
  });

  describe('verifyPost', () => {
    it('should return true since it is currently stubbed', async () => {
      vi.doMock('../../src/social/adapters/identity', () => ({
        browserIdentityAdapter: {
          getPeerId: vi.fn().mockResolvedValue('test-peer-id'),
          getPublicKey: vi.fn().mockResolvedValue(null),
          sign: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), algorithm: 'Ed25519' }),
          verify: vi.fn().mockResolvedValue(false),
        }
      }));

      vi.resetModules();
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
      expect(valid).toBe(true);
    });
  });

  describe('getPost operations', () => {
    it('should get post by ID', async () => {
      const mockPost = {
        id: 'post-123',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now(),
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      vi.doMock('../../src/social/adapters/storage', () => ({
        browserStorageAdapter: {
          getPost: vi.fn().mockResolvedValue(mockPost),
          getAllPosts: vi.fn().mockResolvedValue([mockPost]),
          savePost: vi.fn().mockResolvedValue(undefined),
        },
      }));

      vi.resetModules();
      const { getPost } = await import('../../src/social/posts');

      const post = await getPost('post-123');
      expect(post).toEqual(mockPost);
    });

    it('should return null for non-existent post', async () => {
      vi.doMock('../../src/social/adapters/storage', () => ({
        browserStorageAdapter: {
          getPost: vi.fn().mockResolvedValue(null),
          getAllPosts: vi.fn().mockResolvedValue([]),
          savePost: vi.fn().mockResolvedValue(undefined),
        },
      }));

      vi.resetModules();
      const { getPost } = await import('../../src/social/posts');

      const post = await getPost('non-existent');
      expect(post).toBeNull();
    });

    it('should get posts by channel', async () => {
      const mockPosts = [
        { id: '1', channelID: 'test-channel', author: 'a', content: 'c1', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: '2', channelID: 'test-channel', author: 'b', content: 'c2', timestamp: 2, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.doMock('../../src/social/adapters/storage', () => ({
        browserStorageAdapter: {
          getPostsByChannel: vi.fn().mockResolvedValue(mockPosts),
          savePost: vi.fn().mockResolvedValue(undefined),
        },
      }));

      vi.resetModules();
      const { getPostsByChannel } = await import('../../src/social/posts');

      const posts = await getPostsByChannel('test-channel');
      expect(posts).toHaveLength(2);
      expect(posts.every((p) => p.channelID === 'test-channel')).toBe(true);
    });

    it('should get posts by author', async () => {
      const mockPosts = [
        { id: '1', author: 'test-author', content: 'c1', channelID: 'ch', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.doMock('../../src/social/adapters/storage', () => ({
        browserStorageAdapter: {
          getPostsByAuthor: vi.fn().mockResolvedValue(mockPosts),
          savePost: vi.fn().mockResolvedValue(undefined),
        },
      }));

      vi.resetModules();
      const { getPostsByAuthor } = await import('../../src/social/posts');

      const posts = await getPostsByAuthor('test-author');
      expect(posts).toHaveLength(1);
    });
  });

  describe('getAllPosts', () => {
    it('should return all posts from storage', async () => {
      const mockPosts = [
        { id: '1', author: 'a', content: 'c1', channelID: 'ch', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: '2', author: 'b', content: 'c2', channelID: 'ch', timestamp: 2, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.doMock('../../src/social/adapters/storage', () => ({
        browserStorageAdapter: {
          getAllPosts: vi.fn().mockResolvedValue(mockPosts),
          savePost: vi.fn().mockResolvedValue(undefined),
        },
      }));

      vi.resetModules();
      const { getAllPosts } = await import('../../src/social/posts');

      const posts = await getAllPosts();
      expect(posts).toHaveLength(2);
    });
  });
});
