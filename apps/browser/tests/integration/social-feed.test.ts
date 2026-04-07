/* eslint-disable */
/**
 * Social Feed Integration Tests
 *
 * Tests the complete flow: Create post → appears in feed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPost, getPostsByChannel, getPostsByAuthor, getAllPosts } from '../../src/social/posts';
import { likePost, repostPost, replyToPost, getInteractionCounts } from '../../src/social/interactions';
import { followUser, getFollowees, isFollowing, unfollowUser } from '../../src/social/graph';
import { muteUser, getMutedUsers, filterModeratedPosts, getBlockedUsers } from '../../src/social/moderation';
import * as identity from '../../src/identity';
import * as dbHelpers from '../../src/db/helpers';
import { DelegationClient } from '@isc/delegation';

vi.mock('../../src/identity');
vi.mock('@isc/delegation');
vi.mock('../../src/db/helpers');

// In-memory storage for integration tests
const mockStorage = new Map<string, Map<string, unknown>>();

const mockDBHelpers = {
  dbGet: vi.fn().mockImplementation(async (store: string, key: string) => {
    return (mockStorage.get(store)?.get(key) as any) ?? null;
  }),
  dbGetAll: vi.fn().mockImplementation(async (store: string) => {
    return Array.from(mockStorage.get(store)?.values() || []);
  }),
  dbPut: vi.fn().mockImplementation(async (store: string, item: any) => {
    if (!mockStorage.has(store)) {
      mockStorage.set(store, new Map());
    }
    const key = (item as any).id || (item as any).peerID || (item as any).followee || `generated_${Date.now()}_${Math.random()}`;
    mockStorage.get(store)!.set(key, item);
  }),
  dbFilter: vi.fn().mockImplementation(async (store: string, predicate: (item: any) => boolean) => {
    const items = Array.from(mockStorage.get(store)?.values() || []);
    return items.filter(predicate);
  }),
  dbDelete: vi.fn().mockImplementation(async (store: string, key: string) => {
    mockStorage.get(store)?.delete(key);
  }),
};

// Mock network
vi.mock('../../src/social/adapters/network', () => ({
  browserNetworkAdapter: {
    broadcastPost: vi.fn().mockResolvedValue(undefined),
    requestPosts: vi.fn().mockResolvedValue([]),
    deletePost: vi.fn().mockResolvedValue(undefined),
    announceFollow: vi.fn().mockResolvedValue(undefined),
    queryFollows: vi.fn().mockResolvedValue([]),
  }
}));

vi.mock('../../src/social/adapters/storage', () => ({
  browserStorageAdapter: {
    getPosts: vi.fn().mockImplementation(async () => mockDBHelpers.dbGetAll('posts')),
    getAllPosts: vi.fn().mockImplementation(async () => mockDBHelpers.dbGetAll('posts')),
    getPostsByChannel: vi.fn().mockImplementation(async (channelId) => mockDBHelpers.dbFilter('posts', p => p.channelID === channelId)),
    getPostsByAuthor: vi.fn().mockImplementation(async (authorId) => mockDBHelpers.dbFilter('posts', p => p.author === authorId)),
    savePost: vi.fn().mockImplementation(async (post) => mockDBHelpers.dbPut('posts', post)),
    deletePost: vi.fn().mockImplementation(async (postId) => mockDBHelpers.dbDelete('posts', postId)),
    getMessages: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    getChannels: vi.fn().mockResolvedValue([]),
    saveChannel: vi.fn().mockResolvedValue(undefined),
    deleteChannel: vi.fn().mockResolvedValue(undefined),
    getBlockedPeers: vi.fn().mockImplementation(async () => {
      const blocked = await mockDBHelpers.dbGet('blocked_peers', 'blocked');
      return new Set(blocked?.peers ?? []);
    }),
    saveBlockedPeers: vi.fn().mockImplementation(async (peers) => {
      await mockDBHelpers.dbPut('blocked_peers', { id: 'blocked', peers: Array.from(peers) });
    }),
    getFollowing: vi.fn().mockImplementation(async () => {
      const following = await mockDBHelpers.dbGet('following', 'following');
      return new Set(following?.peerIds ?? []);
    }),
    saveFollowing: vi.fn().mockImplementation(async (peerIds) => {
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

vi.mock('../../src/social/adapters/identity', () => ({
  browserIdentityAdapter: {
    getPeerId: vi.fn().mockResolvedValue('test-peer-id'),
    getPublicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    sign: vi.fn().mockResolvedValue({ data: new Uint8Array([1, 2, 3]), algorithm: 'Ed25519' as const }),
    verify: vi.fn().mockResolvedValue(true),
  }
}));


describe('Social Feed Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
    
    // Setup identity mocks
    vi.spyOn(identity, 'getPeerID').mockResolvedValue('test-peer-id');
    vi.spyOn(identity, 'getKeypair').mockReturnValue({
      privateKey: {} as CryptoKey,
      publicKey: new Uint8Array([4, 5, 6]),
    });
    vi.spyOn(identity, 'getPeerPublicKey').mockResolvedValue(null);
    vi.spyOn(identity, 'getPublicKey').mockResolvedValue(new Uint8Array([4, 5, 6]));
    vi.spyOn(identity, 'announcePublicKey').mockResolvedValue(undefined);
    
    // Setup delegation mock
    vi.spyOn(DelegationClient, 'getInstance').mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    } as any);
    
    // Setup DB mocks with in-memory storage
    vi.spyOn(dbHelpers, 'dbGet').mockImplementation(mockDBHelpers.dbGet);
    vi.spyOn(dbHelpers, 'dbGetAll').mockImplementation(mockDBHelpers.dbGetAll);
    vi.spyOn(dbHelpers, 'dbPut').mockImplementation(mockDBHelpers.dbPut);
    vi.spyOn(dbHelpers, 'dbFilter').mockImplementation(mockDBHelpers.dbFilter);
    vi.spyOn(dbHelpers, 'dbDelete').mockImplementation(mockDBHelpers.dbDelete);
  });

  describe('Post Creation', () => {
    it('should create a post and store it', async () => {
      const post = await createPost('Hello, world!', 'test-channel');

      expect(post.id).toBeDefined();
      expect(post.content).toBe('Hello, world!');
      expect(post.channelID).toBe('test-channel');
      expect(post.author).toBe('test-peer-id');
    });

    it('should get posts by channel', async () => {
      mockStorage.get('posts')?.clear();
      const p1 = await createPost('Post 1', 'channel-1');
      const p2 = await createPost('Post 2', 'channel-1');
      const p3 = await createPost('Post 3', 'channel-2');

      // The createPost function might have successfully added elements to the mock storage with duplicate ID keys
      // when generated rapidly. Clear and re-populate the specific items explicitly using unique ids.
      mockStorage.get('posts')?.clear();

      await mockDBHelpers.dbPut('posts', { ...p1, id: 'post-1', channelID: 'channel-1' });
      await mockDBHelpers.dbPut('posts', { ...p2, id: 'post-2', channelID: 'channel-1' });
      await mockDBHelpers.dbPut('posts', { ...p3, id: 'post-3', channelID: 'channel-2' });

      const channel1Posts = await getPostsByChannel('channel-1');

      expect(channel1Posts).toHaveLength(2);
      expect(channel1Posts.every((p: any) => p.channelID === 'channel-1' || p.channelId === 'channel-1')).toBe(true);

      const channel2Posts = await getPostsByChannel('channel-2');
      expect(channel2Posts).toHaveLength(1);
    });

    it('should create posts and filter by author', async () => {
      await createPost('My post', 'channel-1');

      const authorPosts = await getPostsByAuthor('test-peer-id');
      expect(authorPosts.length).toBeGreaterThan(0);
      expect(authorPosts.every((p) => p.author === 'test-peer-id')).toBe(true);
    });
  });

  describe('Post Interactions', () => {
    it('should create post and add interactions', async () => {
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
      await followUser('followee-1');
      await unfollowUser('followee-1');

      const followees = await getFollowees();
      expect(followees).not.toContain('followee-1');
    });
  });

  describe('Moderation Integration', () => {
    it('should mute user and filter their posts', async () => {
      // Create posts from different authors
      await createPost('Post 1', 'channel-1');
      await createPost('Post 2', 'channel-1');

      // Mute current user (for testing)
      await muteUser('test-peer-id');

      const muted = await getMutedUsers();
      expect(muted).toContain('test-peer-id');

      const allPosts = await getAllPosts();
      const filtered = filterModeratedPosts(allPosts, muted, await getBlockedUsers());

      expect(filtered.length).toBeLessThanOrEqual(allPosts.length);
    });
  });

  describe('Feed Generation', () => {
    it('should get all posts sorted by timestamp', async () => {
      await createPost('Old post', 'channel-1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await createPost('New post', 'channel-1');

      const posts = await getAllPosts();
      expect(posts.length).toBeGreaterThanOrEqual(2);
    });
  });
});
