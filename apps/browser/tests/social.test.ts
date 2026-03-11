/**
 * Social Layer Tests
 * 
 * Tests for posts, feeds, interactions, and social graph.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cosineSimilarity } from '@isc/core/math';

// Mock identity module
vi.mock('../src/identity', () => ({
  getPeerID: vi.fn().mockResolvedValue('mock-peer-id'),
  getKeypair: vi.fn().mockResolvedValue({
    privateKey: { toString: () => 'private-key' },
    publicKey: new Uint8Array([4, 5, 6]),
  }),
}));

// Mock embedding module
vi.mock('../src/identity/embedding', () => ({
  loadEmbeddingModel: vi.fn().mockResolvedValue({
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
  }),
}));

// Mock channels manager
vi.mock('../src/channels/manager', () => ({
  getChannel: vi.fn().mockResolvedValue({
    distributions: [{ mu: [0.1, 0.2, 0.3, 0.4], sigma: [0.1, 0.1, 0.1, 0.1] }],
  }),
}));

// Mock delegation client
const mockDelegationClient = {
  announce: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([]),
};

vi.mock('../src/delegation/fallback', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue(mockDelegationClient),
  },
}));

describe('Social Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Posts', () => {
    it('should create a signed post', async () => {
      // Mock generateUUID
      vi.doMock('@isc/core/encoding', () => ({
        generateUUID: vi.fn().mockReturnValue('test-uuid-123'),
      }));
      
      const { createPost } = await import('../src/social/posts');
      
      const post = await createPost('Hello, world!', 'test-channel');
      
      expect(post.type).toBe('post');
      expect(post.content).toBe('Hello, world!');
      expect(post.channelID).toBe('test-channel');
      expect(post.embedding).toHaveLength(4);
      expect(post.timestamp).toBeGreaterThan(0);
      expect(post.ttl).toBe(86400);
      expect(post.signature).toBeDefined();
    });

    it('should check post validity based on TTL', async () => {
      const { isPostValid } = await import('../src/social/moderation');
      
      // Valid post
      const validPost = {
        type: 'post' as const,
        postID: 'test',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        embedding: [0.1, 0.2],
        timestamp: Date.now(),
        ttl: 86400,
        signature: new Uint8Array([1, 2, 3]),
      };
      expect(isPostValid(validPost)).toBe(true);
      
      // Expired post
      const expiredPost = { ...validPost, timestamp: Date.now() - 90000000, ttl: 60 };
      expect(isPostValid(expiredPost)).toBe(false);
    });
  });

  describe('Feeds', () => {
    it('should rank posts by similarity', async () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const vec3 = [0, 1, 0];
      
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1);
      expect(cosineSimilarity(vec1, vec3)).toBeCloseTo(0);
    });
  });

  describe('Interactions', () => {
    it('should like a post', async () => {
      const { likePost } = await import('../src/social/interactions');
      
      const like = await likePost('post-123');
      
      expect(like.type).toBe('like');
      expect(like.targetPostID).toBe('post-123');
      expect(like.timestamp).toBeGreaterThan(0);
    });

    it('should compute engagement score', async () => {
      const { computeEngagementScore } = await import('../src/social/interactions');
      
      const score = await computeEngagementScore('post-123');
      
      // With mocks returning empty arrays, score should be 0
      expect(typeof score).toBe('number');
      expect(score).toBe(0);
    });
  });

  describe('Social Graph', () => {
    it('should follow a peer', async () => {
      const { followPeer } = await import('../src/social/graph');
      
      const event = await followPeer('followee-peer-id');
      
      expect(event.type).toBe('follow');
      expect(event.followee).toBe('followee-peer-id');
    });

    it('should apply chaos mode perturbation', async () => {
      const { applyChaosMode } = await import('../src/social/graph');
      
      const embedding = [0.5, 0.5, 0.5, 0.5];
      const perturbed = applyChaosMode(embedding, 0.1);
      
      expect(perturbed).toHaveLength(4);
      // Perturbed vector should still be normalized
      const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1, 1);
    });
  });

  describe('Moderation', () => {
    it('should filter muted posts', async () => {
      const { filterMutedPosts } = await import('../src/social/moderation');
      
      const posts = [
        { author: 'user1', content: 'post1' },
        { author: 'user2', content: 'post2' },
        { author: 'user3', content: 'post3' },
      ] as any;
      
      const muted = ['user2'];
      const filtered = filterMutedPosts(posts, muted);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map((p: any) => p.author)).not.toContain('user2');
    });
  });
});
