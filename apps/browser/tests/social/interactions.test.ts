/* eslint-disable */
/**
 * Interactions Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { likePost, unlikePost, getLikeCount, hasLiked, repostPost, replyToPost, getReplies, quotePost, getInteractionCounts } from '../../src/social/interactions';
import { browserStorageAdapter } from '../../src/social/adapters/storage';
import { browserIdentityAdapter } from '../../src/social/adapters/identity';
import { browserNetworkAdapter } from '../../src/social/adapters/network';
import { DelegationClient } from '@isc/delegation';

vi.mock('../../src/social/adapters/storage');
vi.mock('../../src/social/adapters/identity');
vi.mock('../../src/social/adapters/network');
vi.mock('@isc/delegation');

describe('Interactions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup identity mocks
    vi.spyOn(browserIdentityAdapter, 'getPeerId').mockResolvedValue('12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3');
    vi.spyOn(browserIdentityAdapter, 'getPublicKey').mockResolvedValue({} as CryptoKey);
    vi.spyOn(browserIdentityAdapter, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]));
    
    // Setup network mock
    vi.spyOn(browserNetworkAdapter, 'broadcastPost').mockResolvedValue(undefined);

    // Setup delegation mock
    vi.spyOn(DelegationClient, 'getInstance').mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    } as any);
    
    // Setup DB mocks
    vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([]);
    vi.spyOn(browserStorageAdapter, 'getAllInteractions').mockResolvedValue([]);
    vi.spyOn(browserStorageAdapter, 'saveInteraction').mockResolvedValue(undefined);
    vi.spyOn(browserStorageAdapter, 'deleteInteraction').mockResolvedValue(undefined);
  });

  describe('likePost', () => {
    it('should create a signed like event', async () => {
      const like = await likePost('post-123');

      expect(like.id).toBeDefined();
      expect(like.liker).toBe('12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3');
      expect(like.postID).toBe('post-123');
      expect(like.timestamp).toBeGreaterThan(0);
    });

    it('should throw error if identity not initialized', async () => {
      vi.spyOn(browserIdentityAdapter, 'getPeerId').mockRejectedValue(new Error('Identity not initialized'));

      await expect(likePost('post-123')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('unlikePost', () => {
    it('should remove like from storage', async () => {
      vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([
        { id: 'like-1', postID: 'post-123', type: 'like', peerID: '12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3', timestamp: 1, weight: 1 } as any
      ]);

      await unlikePost('post-123');

      expect(browserStorageAdapter.deleteInteraction).toHaveBeenCalled();
    });
  });

  describe('getLikeCount', () => {
    it('should return like count for a post', async () => {
      vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([
        { id: '1', peerID: 'post-123', type: 'like' } as any,
        { id: '2', peerID: 'post-123', type: 'like' } as any,
        { id: '3', peerID: 'post-123', type: 'like' } as any,
      ]);

      const count = await getLikeCount('post-123');
      expect(count).toBe(3);
    });

    it('should return 0 for post with no likes', async () => {
      vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([]);

      const count = await getLikeCount('post-123');
      expect(count).toBe(0);
    });
  });

  describe('hasLiked', () => {
    it('should return true if user liked the post', async () => {
      vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([
        { id: 'like-1', type: 'like', peerID: '12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3' } as any
      ]);

      const liked = await hasLiked('post-123');
      expect(liked).toBe(true);
    });

    it('should return false if user has not liked the post', async () => {
      vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([]);

      const liked = await hasLiked('post-123');
      expect(liked).toBe(false);
    });
  });

  describe('repostPost', () => {
    it('should create a signed repost event', async () => {
      const repost = await repostPost('post-123');

      expect(repost.id).toBeDefined();
      expect(repost.reposter).toBe('12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3');
      expect(repost.postID).toBe('post-123');
    });
  });

  describe('replyToPost', () => {
    it('should create a signed reply event', async () => {
      const reply = await replyToPost('parent-123', 'Great post!', 'test-channel');

      expect(reply.id).toBeDefined();
      expect(reply.parentID).toBe('parent-123');
      expect(reply.author).toBe('12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3');
      expect(reply.content).toBe('Great post!');
      expect(reply.channelID).toBe('test-channel');
    });
  });

  describe('getReplies', () => {
    it('should return replies for a post', async () => {
      vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([
        { id: 'reply-1', peerID: 'post-123', parentID: 'post-123', type: 'reply', content: 'test', channelID: 'test', author: 'a', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' } } as any,
        { id: 'reply-2', peerID: 'post-123', parentID: 'post-123', type: 'reply', content: 'test', channelID: 'test', author: 'a', timestamp: 1, signature: { data: new Uint8Array(), algorithm: 'Ed25519' } } as any,
      ]);

      const replies = await getReplies('post-123');
      expect(replies).toHaveLength(2);
      expect(replies.every((r) => r.parentID === 'post-123' || r.peerID === 'post-123')).toBe(true);
    });
  });

  describe('quotePost', () => {
    it('should create a signed quote event', async () => {
      const quote = await quotePost('post-123', 'I agree with this!', 'test-channel');

      expect(quote.id).toBeDefined();
      expect(quote.quoter).toBe('12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3');
      expect(quote.postID).toBe('post-123');
      expect(quote.content).toBe('I agree with this!');
    });
  });

  describe('getInteractionCounts', () => {
    it('should return all interaction counts for a post', async () => {
      vi.spyOn(browserStorageAdapter, 'getInteractions').mockImplementation(async (postID: string) => {
        return [
          { id: '1', peerID: postID, type: 'like' } as any,
          { id: '2', peerID: postID, type: 'like' } as any,
          { id: '3', peerID: postID, type: 'repost' } as any,
          { id: '4', peerID: postID, type: 'reply' } as any,
          { id: '5', peerID: postID, type: 'reply' } as any,
          { id: '6', peerID: postID, type: 'reply' } as any,
        ];
      });

      const counts = await getInteractionCounts('post-123');

      expect(counts.likes).toBe(2);
      expect(counts.reposts).toBe(1);
      expect(counts.replies).toBe(3);
      expect(counts.quotes).toBe(0);
    });
  });
});
