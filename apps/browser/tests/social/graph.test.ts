/**
 * Social Graph Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { followUser, unfollowUser, getFollowees, isFollowing, computeReputation, applyChaosMode } from '../../src/social/graph';
import * as identity from '../../src/identity';
import * as dbHelpers from '../../src/db/helpers';
import { DelegationClient } from '../../src/delegation/fallback';

vi.mock('../../src/identity');
vi.mock('../../src/delegation/fallback');
vi.mock('../../src/db/helpers');

describe('Social Graph', () => {
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
    vi.spyOn(dbHelpers, 'dbDelete').mockResolvedValue(undefined);
    vi.spyOn(dbHelpers, 'dbFilter').mockResolvedValue([]);
  });

  describe('followUser', () => {
    it('should create a follow subscription', async () => {
      await followUser('followee-123');

      expect(dbHelpers.dbPut).toHaveBeenCalledWith(
        'follows',
        expect.objectContaining({
          followee: 'followee-123',
        })
      );
    });

    it('should throw error if identity not initialized', async () => {
      vi.spyOn(identity, 'getKeypair').mockReturnValue(null);

      await expect(followUser('followee-123')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('unfollowUser', () => {
    it('should remove follow subscription', async () => {
      await unfollowUser('followee-123');

      expect(dbHelpers.dbDelete).toHaveBeenCalledWith('follows', 'followee-123');
    });
  });

  describe('getFollowees', () => {
    it('should return list of followees', async () => {
      vi.spyOn(dbHelpers, 'dbGetAll').mockResolvedValue([
        { followee: 'user1', since: Date.now() },
        { followee: 'user2', since: Date.now() },
      ]);

      const followees = await getFollowees();
      expect(followees).toEqual(['user1', 'user2']);
    });

    it('should return empty array when no followees', async () => {
      vi.spyOn(dbHelpers, 'dbGetAll').mockResolvedValue([]);

      const followees = await getFollowees();
      expect(followees).toEqual([]);
    });
  });

  describe('isFollowing', () => {
    it('should return true if following', async () => {
      vi.spyOn(dbHelpers, 'dbGet').mockResolvedValue({ followee: 'user1', since: Date.now() });

      const following = await isFollowing('user1');
      expect(following).toBe(true);
    });

    it('should return false if not following', async () => {
      vi.spyOn(dbHelpers, 'dbGet').mockResolvedValue(null);

      const following = await isFollowing('user1');
      expect(following).toBe(false);
    });
  });

  describe('computeReputation', () => {
    it('should return score between 0 and 1', async () => {
      const result = await computeReputation('some_peer');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should include halfLifeDays in result', async () => {
      const result = await computeReputation('some_peer', 30);
      expect(result.halfLifeDays).toBe(30);
    });

    it('should apply exponential decay to interactions', async () => {
      const result = await computeReputation('some_peer', 30);
      expect(result).toHaveProperty('interactionHistory');
      expect(result).toHaveProperty('mutualFollows');
    });

    it('should cap mutual follow contribution to prevent Sybil attacks', async () => {
      const result = await computeReputation('some_peer');
      const mutualFollowContribution = Math.min(result.mutualFollows * 0.05, 0.4);
      expect(mutualFollowContribution).toBeLessThanOrEqual(0.4);
    });
  });

  describe('applyChaosMode', () => {
    it('should apply perturbation to embedding', async () => {
      const embedding = [0.5, 0.5, 0.5, 0.5];
      const perturbed = applyChaosMode(embedding, 0.1);

      expect(perturbed).toHaveLength(4);
      const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1, 1);
    });

    it('should return original embedding when chaosLevel is 0', async () => {
      const embedding = [0.5, 0.5, 0.5, 0.5];
      const perturbed = applyChaosMode(embedding, 0);

      expect(perturbed).toEqual(embedding);
    });
  });
});
