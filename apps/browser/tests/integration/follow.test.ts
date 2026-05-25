/* eslint-disable */
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
vi.mock('@isc/delegation', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock window.crypto.subtle
Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    },
    getRandomValues: vi.fn().mockImplementation((arr) => {
      for (let i = 0; i < arr.length; i++) arr[i] = i;
      return arr;
    }),
    randomUUID: vi.fn().mockReturnValue('mock-uuid-1234'),
  },
});

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

vi.mock('../../src/social/adapters/storage', () => ({
  browserStorageAdapter: {
    getPosts: vi.fn().mockResolvedValue([]),
    getPostsByChannel: vi.fn().mockResolvedValue([]),
    getPostsByAuthor: vi.fn().mockResolvedValue([]),
    savePost: vi.fn().mockResolvedValue(undefined),
    deletePost: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    getChannels: vi.fn().mockResolvedValue([]),
    saveChannel: vi.fn().mockResolvedValue(undefined),
    deleteChannel: vi.fn().mockResolvedValue(undefined),
    getBlockedPeers: vi.fn().mockImplementation(async () => {
      const blocked = await mockDBHelpers.dbGet('blocked_peers', 'blocked');
      return new Set(blocked ?? []);
    }),
    saveBlockedPeers: vi.fn().mockImplementation(async (peers) => {
      await mockDBHelpers.dbPut('blocked_peers', { id: 'blocked', peers: Array.from(peers) });
    }),
    getFollowing: vi.fn().mockImplementation(async () => {
      const followingData = await mockDBHelpers.dbGet('following', 'following');
      const following = followingData?.peerIds ?? followingData ?? [];
      return new Set(following);
    }),
    saveFollowing: vi.fn().mockImplementation(async (peerIds) => {
      // Need to fetch current following and merge? Or just overwrite?
      // Wait, in real code saveFollowing overwrites, but graph.ts followUser might add to set and save.
      // If tests mock getFollowing poorly across imports, it might overwrite with single item.
      await mockDBHelpers.dbPut('following', { id: 'following', peerIds: Array.from(peerIds) });
    }),
    getInteractions: vi.fn().mockImplementation(async (peerID: string) => {
      return mockDBHelpers.dbFilter('interactions', (i: any) => i.peerID === peerID);
    }),
    getAllInteractions: vi.fn().mockImplementation(async () => {
      return mockDBHelpers.dbGetAll('interactions');
    }),
    saveInteraction: vi.fn().mockImplementation(async (interaction: any) => {
      await mockDBHelpers.dbPut('interactions', interaction);
    }),
    deleteInteraction: vi.fn().mockImplementation(async (interactionId: string) => {
      await mockDBHelpers.dbDelete('interactions', interactionId);
    }),
    getProfile: vi.fn().mockResolvedValue(null),
    saveProfile: vi.fn().mockResolvedValue(undefined),
    getCommunity: vi.fn().mockResolvedValue(null),
    getCommunities: vi.fn().mockResolvedValue([]),
    saveCommunity: vi.fn().mockResolvedValue(undefined),
    deleteCommunity: vi.fn().mockResolvedValue(undefined),
    getSettings: vi.fn().mockResolvedValue({}),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock network adapter
vi.mock('../../src/social/adapters/network', () => ({
  browserNetworkAdapter: {
    broadcastPost: vi.fn().mockResolvedValue(undefined),
    requestPosts: vi.fn().mockResolvedValue([]),
    deletePost: vi.fn().mockResolvedValue(undefined),
    announceFollow: vi.fn().mockResolvedValue(undefined),
    announceUnfollow: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock identity adapter
vi.mock('../../src/social/adapters/identity', () => ({
  browserIdentityAdapter: {
    getPeerId: vi.fn().mockResolvedValue('test-peer-id'),
    getPublicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    sign: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), algorithm: 'Ed25519' as const }),
    verify: vi.fn().mockResolvedValue(true),
  }
}));

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

      // Mock multiple followers by tracking interactions where we are the peerID
      mockDBHelpers.dbGetAll = vi.fn().mockImplementation(async (store: string) => {
        if (store === 'interactions') {
          return [
            { peerID: 'test-peer-id', type: 'follow', timestamp: Date.now() },
            { peerID: 'test-peer-id', type: 'follow', timestamp: Date.now() },
            { peerID: 'test-peer-id', type: 'follow', timestamp: Date.now() },
          ]
        }
        return Array.from(storage.get(store)?.values() || []);
      });

      // target-user needs to be our peer-id to fetch from local interactions
      const count = await getFollowerCount('test-peer-id');
      // For testing 'ourself' count logic, since getPeerID resolves to 'test-peer-id',
      // when passing 'test-peer-id' it checks local db interactions targeting 'test-peer-id' and filters by type 'follow'.
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
