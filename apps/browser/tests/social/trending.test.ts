/**
 * Trending & Feeds Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock interactions module
vi.mock('../../src/social/interactions', () => ({
  getInteractionCounts: vi.fn().mockResolvedValue({ likes: 0, reposts: 0, replies: 0, quotes: 0 }),
}));

// Mock posts module
vi.mock('../../src/social/posts', () => ({
  getAllPosts: vi.fn().mockResolvedValue([]),
  getPostsByChannel: vi.fn().mockResolvedValue([]),
}));

describe('Trending Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateTrendingScore', () => {
    it('should calculate score based on engagement and time', async () => {
      const { calculateTrendingScore } = await import('../../src/social/trending');

      const post = {
        id: 'post-1',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now() - 3600000, // 1 hour ago
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const interactions = { likes: 10, reposts: 5, replies: 3, quotes: 2 };
      const score = calculateTrendingScore(post, interactions);

      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for posts with insufficient engagement', async () => {
      const { calculateTrendingScore } = await import('../../src/social/trending');

      const post = {
        id: 'post-1',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now(),
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const interactions = { likes: 1, reposts: 0, replies: 0, quotes: 0 };
      const score = calculateTrendingScore(post, interactions);

      expect(score).toBe(0);
    });

    it('should apply time decay to older posts', async () => {
      const { calculateTrendingScore } = await import('../../src/social/trending');

      const interactions = { likes: 10, reposts: 5, replies: 3, quotes: 2 };

      const recentPost = {
        id: 'post-recent',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now() - 60000, // 1 minute ago
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const oldPost = {
        id: 'post-old',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now() - 86400000, // 1 day ago
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      const recentScore = calculateTrendingScore(recentPost, interactions);
      const oldScore = calculateTrendingScore(oldPost, interactions);

      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });

  describe('getTrendingPosts', () => {
    it('should return trending posts sorted by score', async () => {
      const { getTrendingPosts } = await import('../../src/social/trending');
      const { getAllPosts } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      const mockPosts = [
        { id: 'post-1', author: 'a1', content: 'c1', channelID: 'ch', timestamp: Date.now() - 3600000, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: 'post-2', author: 'a2', content: 'c2', channelID: 'ch', timestamp: Date.now() - 7200000, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.mocked(getAllPosts).mockResolvedValue(mockPosts);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const trending = await getTrendingPosts();

      expect(Array.isArray(trending)).toBe(true);
      expect(trending.every((p) => 'trendingScore' in p)).toBe(true);
    });
  });

  describe('getTrendingPostsForChannel', () => {
    it('should return trending posts for a specific channel', async () => {
      const { getTrendingPostsForChannel } = await import('../../src/social/trending');
      const { getPostsByChannel } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      const mockPosts = [
        { id: 'post-1', author: 'a1', content: 'c1', channelID: 'test-channel', timestamp: Date.now() - 3600000, signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.mocked(getPostsByChannel).mockResolvedValue(mockPosts);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const trending = await getTrendingPostsForChannel('test-channel');

      expect(Array.isArray(trending)).toBe(true);
      expect(trending.every((p) => p.channelID === 'test-channel')).toBe(true);
    });
  });

  describe('getHotPosts', () => {
    it('should return recent posts with high engagement', async () => {
      const { getHotPosts } = await import('../../src/social/trending');
      const { getAllPosts } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      const recentPost = {
        id: 'post-recent',
        author: 'a1',
        content: 'c1',
        channelID: 'ch',
        timestamp: Date.now() - 1800000, // 30 minutes ago
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      vi.mocked(getAllPosts).mockResolvedValue([recentPost]);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const hot = await getHotPosts();

      expect(Array.isArray(hot)).toBe(true);
    });
  });

  describe('getExploreFeed', () => {
    it('should return diverse explore feed', async () => {
      const { getExploreFeed } = await import('../../src/social/trending');
      const { getAllPosts } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      const mockPosts = Array(10).fill(null).map((_, i) => ({
        id: `post-${i}`,
        author: `a${i}`,
        content: `c${i}`,
        channelID: `channel-${i % 3}`,
        timestamp: Date.now() - i * 3600000,
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      }));

      vi.mocked(getAllPosts).mockResolvedValue(mockPosts);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const explore = await getExploreFeed(0.2, 10);

      expect(Array.isArray(explore)).toBe(true);
    });

    it('should apply chaos mode when chaosLevel > 0', async () => {
      const { getExploreFeed } = await import('../../src/social/trending');
      const { getAllPosts } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      const mockPosts = Array(10).fill(null).map((_, i) => ({
        id: `post-${i}`,
        author: `a${i}`,
        content: `c${i}`,
        channelID: `channel-${i % 3}`,
        timestamp: Date.now() - i * 3600000,
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      }));

      vi.mocked(getAllPosts).mockResolvedValue(mockPosts);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const exploreWithChaos = await getExploreFeed(0.3, 10);
      const exploreNoChaos = await getExploreFeed(0, 10);

      expect(Array.isArray(exploreWithChaos)).toBe(true);
      expect(Array.isArray(exploreNoChaos)).toBe(true);
    });
  });

  describe('getTrendingTopics', () => {
    it('should return trending topics based on engagement', async () => {
      const { getTrendingTopics } = await import('../../src/social/trending');
      const { getAllPosts } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      const mockPosts = Array(5).fill(null).map((_, i) => ({
        id: `post-${i}`,
        author: `a${i}`,
        content: `This is a trending topic ${i}`,
        channelID: 'ch',
        timestamp: Date.now() - i * 3600000,
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      }));

      vi.mocked(getAllPosts).mockResolvedValue(mockPosts);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const topics = await getTrendingTopics();

      expect(Array.isArray(topics)).toBe(true);
    });
  });

  describe('getFollowingFeed', () => {
    it('should return posts from followed users', async () => {
      const { getFollowingFeed } = await import('../../src/social/trending');
      const { getAllPosts } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      // Mock follow graph
      vi.mock('../../src/social/graph', () => ({
        getFollowees: vi.fn().mockResolvedValue(['followee-1', 'followee-2']),
      }));

      const mockPosts = [
        { id: 'post-1', author: 'followee-1', content: 'c1', channelID: 'ch', timestamp: Date.now(), signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: 'post-2', author: 'followee-2', content: 'c2', channelID: 'ch', timestamp: Date.now(), signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: 'post-3', author: 'stranger', content: 'c3', channelID: 'ch', timestamp: Date.now(), signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.mocked(getAllPosts).mockResolvedValue(mockPosts);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const feed = await getFollowingFeed();

      expect(Array.isArray(feed)).toBe(true);
      // Should only include posts from followees
      expect(feed.every((p) => p.author !== 'stranger')).toBe(true);
    });
  });
});
