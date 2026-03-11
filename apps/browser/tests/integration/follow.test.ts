/**
 * Follow Integration Tests
 *
 * Tests the complete flow: Follow → posts appear in Following feed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock identity module
vi.mock('../../src/identity', () => ({
  getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
  getKeypair: vi.fn().mockReturnValue({
    privateKey: { toString: () => 'private-key' },
    publicKey: new Uint8Array([4, 5, 6]),
  }),
}));

// Mock delegation client
vi.mock('../../src/delegation/fallback', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
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

// Mock posts
vi.mock('../../src/social/posts', () => ({
  getAllPosts: vi.fn().mockResolvedValue([]),
  getPostsByChannel: vi.fn().mockResolvedValue([]),
  createPost: vi.fn().mockImplementation(async (content: string, channelID: string) => ({
    id: `post-${Date.now()}`,
    author: 'test-peer-id',
    content,
    channelID,
    timestamp: Date.now(),
    signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
  })),
}));

// Mock interactions
vi.mock('../../src/social/interactions', () => ({
  getInteractionCounts: vi.fn().mockResolvedValue({ likes: 0, reposts: 0, replies: 0, quotes: 0 }),
}));

describe('Follow Integration', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  describe('Follow Flow', () => {
    it('should follow a user', async () => {
      const { followUser, getFollowees, isFollowing } = await import('../../src/social/graph');

      await followUser('followee-123');

      const followees = await getFollowees();
      expect(followees).toContain('followee-123');

      const following = await isFollowing('followee-123');
      expect(following).toBe(true);
    });

    it('should unfollow a user', async () => {
      const { followUser, unfollowUser, getFollowees, isFollowing } = await import('../../src/social/graph');

      await followUser('followee-123');
      await unfollowUser('followee-123');

      const followees = await getFollowees();
      expect(followees).not.toContain('followee-123');

      const following = await isFollowing('followee-123');
      expect(following).toBe(false);
    });

    it('should follow multiple users', async () => {
      const { followUser, getFollowees } = await import('../../src/social/graph');

      await followUser('user-1');
      await followUser('user-2');
      await followUser('user-3');

      const followees = await getFollowees();
      expect(followees).toHaveLength(3);
      expect(followees).toEqual(expect.arrayContaining(['user-1', 'user-2', 'user-3']));
    });
  });

  describe('Follower Count', () => {
    it('should calculate follower count', async () => {
      const { getFollowerCount } = await import('../../src/social/graph');

      // Mock multiple followers
      storage.set('follows', new Map());
      storage.get('follows')!.set('follower-1', { followee: 'target-user', since: Date.now() });
      storage.get('follows')!.set('follower-2', { followee: 'target-user', since: Date.now() });
      storage.get('follows')!.set('follower-3', { followee: 'target-user', since: Date.now() });

      const count = await getFollowerCount('target-user');
      expect(count).toBe(3);
    });
  });

  describe('Reputation Calculation', () => {
    it('should compute reputation based on interactions', async () => {
      const { computeReputation, recordInteraction } = await import('../../src/social/graph');

      // Record 100 interactions for target-user
      for (let i = 0; i < 100; i++) {
        await recordInteraction('target-user', 'like', 1);
      }

      const reputation = await computeReputation('target-user');

      // With 100 interactions, score should be > 0
      expect(reputation.score).toBeGreaterThan(0);
      expect(reputation.score).toBeLessThanOrEqual(1);
      expect(reputation.halfLifeDays).toBe(30);
    });

    it('should return 0 for user with no followers', async () => {
      const { computeReputation } = await import('../../src/social/graph');

      const reputation = await computeReputation('target-user');
      expect(reputation.score).toBe(0);
    });
  });

  describe('Following Feed', () => {
    it('should get posts from followed users', async () => {
      const { followUser } = await import('../../src/social/graph');
      const { getFollowingFeed } = await import('../../src/social/trending');
      const { getAllPosts } = await import('../../src/social/posts');
      const { getInteractionCounts } = await import('../../src/social/interactions');

      // Follow users
      await followUser('followee-1');
      await followUser('followee-2');

      // Mock posts from followees and strangers
      const mockPosts = [
        { id: 'post-1', author: 'followee-1', content: 'Post from followee 1', channelID: 'ch', timestamp: Date.now(), signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: 'post-2', author: 'followee-2', content: 'Post from followee 2', channelID: 'ch', timestamp: Date.now(), signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
        { id: 'post-3', author: 'stranger', content: 'Post from stranger', channelID: 'ch', timestamp: Date.now(), signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const } },
      ];

      vi.mocked(getAllPosts).mockResolvedValue(mockPosts);
      vi.mocked(getInteractionCounts).mockResolvedValue({ likes: 10, reposts: 5, replies: 3, quotes: 2 });

      const feed = await getFollowingFeed();

      // Feed should only contain posts from followees
      expect(feed.every((p) => p.author !== 'stranger')).toBe(true);
    });
  });

  describe('Suggested Follows', () => {
    it('should return suggested follows', async () => {
      const { getSuggestedFollows } = await import('../../src/social/graph');

      const suggestions = await getSuggestedFollows();

      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});
