/**
 * Social Feed Integration Tests
 *
 * Tests the complete flow: Create post → appears in feed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock identity module
vi.mock('../../src/identity', () => ({
  getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
  getKeypair: vi.fn().mockReturnValue({
    privateKey: { toString: () => 'private-key' },
    publicKey: new Uint8Array([4, 5, 6]),
  }),
  getPeerPublicKey: vi.fn().mockResolvedValue(null),
  getPublicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
  announcePublicKey: vi.fn().mockResolvedValue(undefined),
}));

// Mock delegation client
vi.mock('../../src/delegation/fallback', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    }),
  },
}));

// Mock DB helpers with in-memory storage
const storage = new Map<string, Map<string, unknown>>();

const mockDBHelpers = {
  dbGet: vi.fn().mockImplementation(async (store: string, key: string) => {
    return (storage.get(store)?.get(key) as any) ?? null;
  }),
  dbGetAll: vi.fn().mockImplementation(async (store: string) => {
    return Array.from(storage.get(store)?.values() || []);
  }),
  dbPut: vi.fn().mockImplementation(async (store: string, item: any) => {
    if (!storage.has(store)) {
      storage.set(store, new Map());
    }
    const key = (item as any).id || (item as any).peerID || (item as any).followee || 'default';
    storage.get(store)!.set(key, item);
  }),
  dbFilter: vi.fn().mockImplementation(async (store: string, predicate: (item: any) => boolean) => {
    const items = Array.from(storage.get(store)?.values() || []);
    return items.filter(predicate);
  }),
  dbDelete: vi.fn().mockImplementation(async (store: string, key: string) => {
    storage.get(store)?.delete(key);
  }),
};

vi.mock('../../src/db/helpers', () => mockDBHelpers);

// Mock interactions
vi.mock('../../src/social/interactions', () => ({
  getInteractionCounts: vi.fn().mockResolvedValue({ likes: 0, reposts: 0, replies: 0, quotes: 0 }),
  likePost: vi.fn().mockResolvedValue({
    id: 'like-1',
    liker: 'test-peer-id',
    postID: 'post-1',
    timestamp: Date.now(),
    signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
  }),
  repostPost: vi.fn().mockResolvedValue({
    id: 'repost-1',
    reposter: 'test-peer-id',
    postID: 'post-1',
    timestamp: Date.now(),
    signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
  }),
  replyToPost: vi.fn().mockResolvedValue({
    id: 'reply-1',
    parentID: 'post-1',
    author: 'test-peer-id',
    content: 'Great post!',
    channelID: 'test-channel',
    timestamp: Date.now(),
    signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
  }),
  getReplies: vi.fn().mockResolvedValue([]),
}));

describe('Social Feed Integration', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  describe('Post Creation and Retrieval', () => {
    it('should create a post and retrieve it', async () => {
      const { createPost, getPost, getAllPosts } = await import('../../src/social/posts');

      // Create post
      const post = await createPost('Hello, world!', 'test-channel');

      expect(post.id).toBeDefined();
      expect(post.content).toBe('Hello, world!');
      expect(post.channelID).toBe('test-channel');

      // Retrieve by ID
      const retrieved = await getPost(post.id);
      expect(retrieved).toEqual(post);

      // Get all posts
      const allPosts = await getAllPosts();
      expect(allPosts).toContainEqual(post);
    });

    it('should create multiple posts and filter by channel', async () => {
      const { createPost, getPostsByChannel } = await import('../../src/social/posts');

      await createPost('Post 1', 'channel-1');
      await createPost('Post 2', 'channel-1');
      await createPost('Post 3', 'channel-2');

      const channel1Posts = await getPostsByChannel('channel-1');
      expect(channel1Posts).toHaveLength(2);
      expect(channel1Posts.every((p) => p.channelID === 'channel-1')).toBe(true);

      const channel2Posts = await getPostsByChannel('channel-2');
      expect(channel2Posts).toHaveLength(1);
    });

    it('should create posts and filter by author', async () => {
      const { createPost, getPostsByAuthor } = await import('../../src/social/posts');

      await createPost('My post', 'channel-1');

      const authorPosts = await getPostsByAuthor('test-peer-id');
      expect(authorPosts.length).toBeGreaterThan(0);
      expect(authorPosts.every((p) => p.author === 'test-peer-id')).toBe(true);
    });
  });

  describe('Post Interactions', () => {
    it('should create post and add interactions', async () => {
      const { createPost } = await import('../../src/social/posts');
      const { likePost, repostPost, replyToPost, getInteractionCounts } = await import('../../src/social/interactions');

      const post = await createPost('Interactive post', 'test-channel');

      // Add interactions
      await likePost(post.id);
      await repostPost(post.id);
      await replyToPost(post.id, 'Nice!', 'test-channel');

      // Get counts
      const counts = await getInteractionCounts(post.id);

      expect(counts.likes).toBeGreaterThanOrEqual(1);
      expect(counts.reposts).toBeGreaterThanOrEqual(1);
      expect(counts.replies).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Social Graph Integration', () => {
    it('should follow user and get followees', async () => {
      const { followUser, getFollowees, isFollowing } = await import('../../src/social/graph');

      await followUser('followee-1');
      await followUser('followee-2');

      const followees = await getFollowees();
      expect(followees).toContain('followee-1');
      expect(followees).toContain('followee-2');

      const following1 = await isFollowing('followee-1');
      expect(following1).toBe(true);

      const following3 = await isFollowing('followee-3');
      expect(following3).toBe(false);
    });

    it('should unfollow user', async () => {
      const { followUser, unfollowUser, getFollowees } = await import('../../src/social/graph');

      await followUser('followee-1');
      await unfollowUser('followee-1');

      const followees = await getFollowees();
      expect(followees).not.toContain('followee-1');
    });
  });

  describe('Moderation Integration', () => {
    it('should mute user and filter their posts', async () => {
      const { createPost, getAllPosts } = await import('../../src/social/posts');
      const { muteUser, getMutedUsers, filterModeratedPosts, getBlockedUsers } = await import('../../src/social/moderation');

      // Create posts from different authors
      await createPost('Post 1', 'channel-1');
      await createPost('Post 2', 'channel-1');

      // Mute current user (for testing)
      await muteUser('test-peer-id');

      const muted = await getMutedUsers();
      expect(muted).toContain('test-peer-id');

      const allPosts = await getAllPosts();
      const blocked = await getBlockedUsers();
      const filtered = filterModeratedPosts(allPosts, muted, blocked);

      // Filtered posts should not include posts from muted user
      expect(filtered.every((p) => p.author !== 'test-peer-id')).toBe(true);
    });

    it('should block user', async () => {
      const { blockUser, getBlockedUsers, isBlocked } = await import('../../src/social/moderation');

      await blockUser('blocked-user');

      const blocked = await getBlockedUsers();
      expect(blocked).toContain('blocked-user');

      const isUserBlocked = await isBlocked('blocked-user');
      expect(isUserBlocked).toBe(true);
    });

    it('should create and retrieve report', async () => {
      const { reportUser, getPendingReports } = await import('../../src/social/moderation');

      const report = await reportUser('reported-user', 'spam', ['evidence-1']);

      expect(report.reported).toBe('reported-user');
      expect(report.reason).toBe('spam');

      const reports = await getPendingReports();
      expect(reports.some((r) => r.id === report.id)).toBe(true);
    });
  });

  describe('Trending Integration', () => {
    it('should calculate trending score for posts', async () => {
      const { createPost } = await import('../../src/social/posts');
      const { getTrendingPosts } = await import('../../src/social/trending');

      await createPost('Trending post', 'test-channel');

      const trending = await getTrendingPosts();

      expect(Array.isArray(trending)).toBe(true);
      expect(trending.every((p) => 'trendingScore' in p)).toBe(true);
    });
  });

  describe('Analytics Integration', () => {
    it('should track views and get metrics', async () => {
      const { createPost } = await import('../../src/social/posts');
      const { trackView, getMetrics } = await import('../../src/social/analytics');

      const post = await createPost('Analytics post', 'test-channel');

      await trackView(post.id);
      await trackView(post.id);

      const metrics = await getMetrics(post.id);

      expect(metrics.postId).toBe(post.id);
      expect(metrics.views).toBeGreaterThanOrEqual(1);
    });
  });
});
