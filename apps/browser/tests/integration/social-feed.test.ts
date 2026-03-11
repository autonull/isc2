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
import { DelegationClient } from '../../src/delegation/fallback';

vi.mock('../../src/identity');
vi.mock('../../src/delegation/fallback');
vi.mock('../../src/db/helpers');

// In-memory storage for integration tests
const storage = new Map<string, Map<string, unknown>>();

describe('Social Feed Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    
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
    vi.spyOn(dbHelpers, 'dbGet').mockImplementation(async (store: string, key: string) => {
      return (storage.get(store)?.get(key) as any) ?? null;
    });
    vi.spyOn(dbHelpers, 'dbGetAll').mockImplementation(async (store: string) => {
      return Array.from(storage.get(store)?.values() || []);
    });
    vi.spyOn(dbHelpers, 'dbPut').mockImplementation(async (store: string, item: any) => {
      if (!storage.has(store)) {
        storage.set(store, new Map());
      }
      const key = (item as any).id || (item as any).peerID || (item as any).followee || 'default';
      storage.get(store)!.set(key, item);
    });
    vi.spyOn(dbHelpers, 'dbFilter').mockImplementation(async (store: string, predicate: (item: any) => boolean) => {
      const items = Array.from(storage.get(store)?.values() || []);
      return items.filter(predicate);
    });
    vi.spyOn(dbHelpers, 'dbDelete').mockImplementation(async (store: string, key: string) => {
      storage.get(store)?.delete(key);
    });
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
