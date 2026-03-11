/**
 * Interactions Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { likePost, unlikePost, getLikeCount, hasLiked, repostPost, replyToPost, getReplies, quotePost, getInteractionCounts } from '../../src/social/interactions';
import * as identity from '../../src/identity';
import * as dbHelpers from '../../src/db/helpers';
import { DelegationClient } from '../../src/delegation/fallback';

vi.mock('../../src/identity');
vi.mock('../../src/delegation/fallback');
vi.mock('../../src/db/helpers');

describe('Interactions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup identity mocks
    vi.spyOn(identity, 'getPeerID').mockResolvedValue('test-peer-id');
    vi.spyOn(identity, 'getKeypair').mockReturnValue({
      privateKey: {} as CryptoKey,
      publicKey: new Uint8Array([4, 5, 6]),
    });
    
    // Setup delegation mock
    vi.spyOn(DelegationClient, 'getInstance').mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    } as any);
    
    // Setup DB mocks
    vi.spyOn(dbHelpers, 'dbGet').mockResolvedValue(null);
    vi.spyOn(dbHelpers, 'dbGetAll').mockResolvedValue([]);
    vi.spyOn(dbHelpers, 'dbPut').mockResolvedValue(undefined);
    vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([]);
    vi.spyOn(dbHelpers, 'dbDelete').mockResolvedValue(undefined);
  });

  describe('likePost', () => {
    it('should create a signed like event', async () => {
      const like = await likePost('post-123');

      expect(like.id).toBeDefined();
      expect(like.liker).toBe('test-peer-id');
      expect(like.postID).toBe('post-123');
      expect(like.timestamp).toBeGreaterThan(0);
      expect(like.signature).toBeDefined();
    });

    it('should throw error if identity not initialized', async () => {
      vi.spyOn(identity, 'getKeypair').mockReturnValue(null);

      await expect(likePost('post-123')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('unlikePost', () => {
    it('should remove like from storage', async () => {
      vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([
        { id: 'like-1', postID: 'post-123', liker: 'test-peer-id' },
      ]);

      await unlikePost('post-123');

      expect(dbHelpers.dbFilter).toHaveBeenCalled();
      expect(dbHelpers.dbDelete).toHaveBeenCalled();
    });
  });

  describe('getLikeCount', () => {
    it('should return like count for a post', async () => {
      vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([
        { id: '1', postID: 'post-123' },
        { id: '2', postID: 'post-123' },
        { id: '3', postID: 'post-123' },
      ]);

      const count = await getLikeCount('post-123');
      expect(count).toBe(3);
    });

    it('should return 0 for post with no likes', async () => {
      vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([]);

      const count = await getLikeCount('post-123');
      expect(count).toBe(0);
    });
  });

  describe('hasLiked', () => {
    it('should return true if user liked the post', async () => {
      vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([{ id: 'like-1', postID: 'post-123', liker: 'test-peer-id' }]);

      const liked = await hasLiked('post-123');
      expect(liked).toBe(true);
    });

    it('should return false if user has not liked the post', async () => {
      vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([]);

      const liked = await hasLiked('post-123');
      expect(liked).toBe(false);
    });
  });

  describe('repostPost', () => {
    it('should create a signed repost event', async () => {
      const repost = await repostPost('post-123');

      expect(repost.id).toBeDefined();
      expect(repost.reposter).toBe('test-peer-id');
      expect(repost.postID).toBe('post-123');
      expect(repost.signature).toBeDefined();
    });
  });

  describe('replyToPost', () => {
    it('should create a signed reply event', async () => {
      const reply = await replyToPost('parent-123', 'Great post!', 'test-channel');

      expect(reply.id).toBeDefined();
      expect(reply.parentID).toBe('parent-123');
      expect(reply.author).toBe('test-peer-id');
      expect(reply.content).toBe('Great post!');
      expect(reply.channelID).toBe('test-channel');
      expect(reply.signature).toBeDefined();
    });
  });

  describe('getReplies', () => {
    it('should return replies for a post', async () => {
      vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([
        { id: 'reply-1', parentID: 'post-123' },
        { id: 'reply-2', parentID: 'post-123' },
      ]);

      const replies = await getReplies('post-123');
      expect(replies).toHaveLength(2);
      expect(replies.every((r) => r.parentID === 'post-123')).toBe(true);
    });
  });

  describe('quotePost', () => {
    it('should create a signed quote event', async () => {
      const quote = await quotePost('post-123', 'I agree with this!', 'test-channel');

      expect(quote.id).toBeDefined();
      expect(quote.quoter).toBe('test-peer-id');
      expect(quote.postID).toBe('post-123');
      expect(quote.content).toBe('I agree with this!');
      expect(quote.signature).toBeDefined();
    });
  });

  describe('getInteractionCounts', () => {
    it('should return all interaction counts for a post', async () => {
      vi.spyOn(dbHelpers, 'dbFilter').mockImplementation(async (store: string) => {
        switch (store) {
          case 'likes':
            return [{ id: '1' }, { id: '2' }];
          case 'reposts':
            return [{ id: '1' }];
          case 'replies':
            return [{ id: '1' }, { id: '2' }, { id: '3' }];
          case 'quotes':
            return [];
          default:
            return [];
        }
      });

      const counts = await getInteractionCounts('post-123');

      expect(counts.likes).toBe(2);
      expect(counts.reposts).toBe(1);
      expect(counts.replies).toBe(3);
      expect(counts.quotes).toBe(0);
    });
  });
});
