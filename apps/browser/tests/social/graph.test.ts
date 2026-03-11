/**
 * Social Graph Tests
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
  dbDelete: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../src/db/helpers', () => mockDBHelpers);

describe('Social Graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('followUser', () => {
    it('should create a follow subscription', async () => {
      const { followUser } = await import('../../src/social/graph');

      await followUser('followee-123');

      const { dbPut } = await import('../../src/db/helpers');
      expect(dbPut).toHaveBeenCalledWith(
        'follows',
        expect.objectContaining({
          followee: 'followee-123',
          since: expect.any(Number),
        })
      );
    });
  });

  describe('unfollowUser', () => {
    it('should remove follow subscription', async () => {
      const { unfollowUser } = await import('../../src/social/graph');
      const { dbDelete } = await import('../../src/db/helpers');

      await unfollowUser('followee-123');

      expect(dbDelete).toHaveBeenCalledWith('follows', 'followee-123');
    });
  });

  describe('getFollowees', () => {
    it('should return list of followed users', async () => {
      const { getFollowees } = await import('../../src/social/graph');
      const { dbGetAll } = await import('../../src/db/helpers');

      vi.mocked(dbGetAll).mockResolvedValue([
        { followee: 'user-1', since: Date.now() },
        { followee: 'user-2', since: Date.now() },
        { followee: 'user-3', since: Date.now() },
      ]);

      const followees = await getFollowees();
      expect(followees).toHaveLength(3);
      expect(followees).toEqual(['user-1', 'user-2', 'user-3']);
    });

    it('should return empty array if no followees', async () => {
      const { getFollowees } = await import('../../src/social/graph');
      const { dbGetAll } = await import('../../src/db/helpers');

      vi.mocked(dbGetAll).mockResolvedValue([]);

      const followees = await getFollowees();
      expect(followees).toEqual([]);
    });
  });

  describe('isFollowing', () => {
    it('should return true if following user', async () => {
      const { isFollowing } = await import('../../src/social/graph');
      const { dbGet } = await import('../../src/db/helpers');

      vi.mocked(dbGet).mockResolvedValue({ followee: 'user-123', since: Date.now() });

      const following = await isFollowing('user-123');
      expect(following).toBe(true);
    });

    it('should return false if not following user', async () => {
      const { isFollowing } = await import('../../src/social/graph');
      const { dbGet } = await import('../../src/db/helpers');

      vi.mocked(dbGet).mockResolvedValue(null);

      const following = await isFollowing('user-123');
      expect(following).toBe(false);
    });
  });

  describe('getFollowerCount', () => {
    it('should count followers for a user', async () => {
      const { getFollowerCount } = await import('../../src/social/graph');
      const { dbGetAll } = await import('../../src/db/helpers');

      vi.mocked(dbGetAll).mockResolvedValue([
        { followee: 'target-user' },
        { followee: 'target-user' },
        { followee: 'other-user' },
      ]);

      const count = await getFollowerCount('target-user');
      expect(count).toBe(2);
    });
  });

  describe('computeReputation', () => {
    it('should compute reputation based on follower count', async () => {
      const { computeReputation } = await import('../../src/social/graph');
      const { dbGetAll } = await import('../../src/db/helpers');

      // Mock 100 followers
      vi.mocked(dbGetAll).mockResolvedValue(Array(100).fill({ followee: 'target-user' }));

      const reputation = await computeReputation('target-user');

      // log2(100 + 1) ≈ 6.66
      expect(reputation).toBeCloseTo(Math.log2(101), 1);
    });

    it('should return 0 for user with no followers', async () => {
      const { computeReputation } = await import('../../src/social/graph');
      const { dbGetAll } = await import('../../src/db/helpers');

      vi.mocked(dbGetAll).mockResolvedValue([]);

      const reputation = await computeReputation('target-user');
      expect(reputation).toBe(0);
    });
  });

  describe('getSuggestedFollows', () => {
    it('should return suggested follows', async () => {
      const { getSuggestedFollows } = await import('../../src/social/graph');

      // Currently returns empty array (placeholder implementation)
      const suggestions = await getSuggestedFollows();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});
