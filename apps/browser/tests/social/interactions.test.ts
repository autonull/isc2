/**
 * Interactions Service Tests
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

// Mock DB helpers
const mockDBHelpers = {
  dbGet: vi.fn().mockResolvedValue(null),
  dbGetAll: vi.fn().mockResolvedValue([]),
  dbPut: vi.fn().mockResolvedValue(undefined),
  dbFilter: vi.fn().mockResolvedValue([]),
  dbDelete: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/db/helpers', () => mockDBHelpers);

describe('Interactions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('likePost', () => {
    it('should create a signed like event', async () => {
      const { likePost } = await import('../../src/social/interactions');

      const like = await likePost('post-123');

      expect(like.id).toBeDefined();
      expect(like.liker).toBe('test-peer-id');
      expect(like.postID).toBe('post-123');
      expect(like.timestamp).toBeGreaterThan(0);
      expect(like.signature).toBeDefined();
    });

    it('should throw error if identity not initialized', async () => {
      vi.mocked(await import('../../src/identity')).getKeypair.mockReturnValue(null);

      const { likePost } = await import('../../src/social/interactions');

      await expect(likePost('post-123')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('unlikePost', () => {
    it('should remove like from storage', async () => {
      const { unlikePost } = await import('../../src/social/interactions');
      const { dbFilter, dbDelete } = await import('../../src/db/helpers');

      vi.mocked(dbFilter).mockResolvedValue([
        { id: 'like-1', postID: 'post-123', liker: 'test-peer-id' },
      ]);

      await unlikePost('post-123');

      expect(dbFilter).toHaveBeenCalled();
      expect(dbDelete).toHaveBeenCalled();
    });
  });

  describe('getLikeCount', () => {
    it('should return like count for a post', async () => {
      const { getLikeCount } = await import('../../src/social/interactions');
      const { dbFilter } = await import('../../src/db/helpers');

      vi.mocked(dbFilter).mockResolvedValue([
        { id: '1', postID: 'post-123' },
        { id: '2', postID: 'post-123' },
        { id: '3', postID: 'post-123' },
      ]);

      const count = await getLikeCount('post-123');
      expect(count).toBe(3);
    });

    it('should return 0 for post with no likes', async () => {
      const { getLikeCount } = await import('../../src/social/interactions');
      const { dbFilter } = await import('../../src/db/helpers');

      vi.mocked(dbFilter).mockResolvedValue([]);

      const count = await getLikeCount('post-123');
      expect(count).toBe(0);
    });
  });

  describe('hasLiked', () => {
    it('should return true if user liked the post', async () => {
      const { hasLiked } = await import('../../src/social/interactions');
      const { dbFilter } = await import('../../src/db/helpers');

      vi.mocked(dbFilter).mockResolvedValue([{ id: 'like-1', postID: 'post-123', liker: 'test-peer-id' }]);

      const liked = await hasLiked('post-123');
      expect(liked).toBe(true);
    });

    it('should return false if user has not liked the post', async () => {
      const { hasLiked } = await import('../../src/social/interactions');
      const { dbFilter } = await import('../../src/db/helpers');

      vi.mocked(dbFilter).mockResolvedValue([]);

      const liked = await hasLiked('post-123');
      expect(liked).toBe(false);
    });
  });

  describe('repostPost', () => {
    it('should create a signed repost event', async () => {
      const { repostPost } = await import('../../src/social/interactions');

      const repost = await repostPost('post-123');

      expect(repost.id).toBeDefined();
      expect(repost.reposter).toBe('test-peer-id');
      expect(repost.postID).toBe('post-123');
      expect(repost.signature).toBeDefined();
    });
  });

  describe('replyToPost', () => {
    it('should create a signed reply event', async () => {
      const { replyToPost } = await import('../../src/social/interactions');

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
      const { getReplies } = await import('../../src/social/interactions');
      const { dbFilter } = await import('../../src/db/helpers');

      vi.mocked(dbFilter).mockResolvedValue([
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
      const { quotePost } = await import('../../src/social/interactions');

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
      const { getInteractionCounts } = await import('../../src/social/interactions');
      const { dbFilter } = await import('../../src/db/helpers');

      // Mock different interaction stores
      vi.mocked(dbFilter).mockImplementation(async (store: string) => {
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
