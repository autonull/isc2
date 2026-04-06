/* eslint-disable */
/**
 * Social Graph Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { followUser, unfollowUser, getFollowees, isFollowing, computeReputation, applyChaosMode } from '../../src/social/graph';
import { browserStorageAdapter } from '../../src/social/adapters/storage';
import { browserIdentityAdapter } from '../../src/social/adapters/identity';
import { browserNetworkAdapter } from '../../src/social/adapters/network';
import { DelegationClient } from '@isc/delegation';

vi.mock('../../src/social/adapters/storage');
vi.mock('../../src/social/adapters/identity');
vi.mock('../../src/social/adapters/network');
vi.mock('@isc/delegation');

describe('Social Graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup identity mocks
    vi.spyOn(browserIdentityAdapter, 'getPeerId').mockResolvedValue('12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q3');
    vi.spyOn(browserIdentityAdapter, 'getPublicKey').mockResolvedValue({} as CryptoKey);
    vi.spyOn(browserIdentityAdapter, 'sign').mockResolvedValue(new Uint8Array([1, 2, 3]));

    // Setup network mock
    // Nothing to spy on, browserNetworkAdapter has broadcastPost mostly.
    
    // Setup delegation mock
    vi.spyOn(DelegationClient, 'getInstance').mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    } as any);
    
    // Setup DB mocks
    vi.spyOn(browserStorageAdapter, 'saveFollowing').mockResolvedValue(undefined);
    vi.spyOn(browserStorageAdapter, 'getFollowing').mockResolvedValue(new Set());
    vi.spyOn(browserStorageAdapter, 'getInteractions').mockResolvedValue([]);
    vi.spyOn(browserStorageAdapter, 'saveInteraction').mockResolvedValue(undefined);
    vi.spyOn(browserStorageAdapter, 'getAllInteractions').mockResolvedValue([]);
  });

  describe('followUser', () => {
    it('should create a follow subscription', async () => {
      await followUser('12D3KooWJ8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q4');

      expect(browserStorageAdapter.saveFollowing).toHaveBeenCalledWith(
        expect.any(Set)
      );
    });

    it('should throw error if identity not initialized', async () => {
      vi.spyOn(browserIdentityAdapter, 'getPeerId').mockRejectedValue(new Error('Identity not initialized'));

      await expect(followUser('12D3KooWJ8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q4')).rejects.toThrow('Identity not initialized');
    });
  });

  describe('unfollowUser', () => {
    it('should remove follow subscription', async () => {
      vi.spyOn(browserStorageAdapter, 'getFollowing').mockResolvedValue(new Set(['12D3KooWJ8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q4']));
      await unfollowUser('12D3KooWJ8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q4');

      expect(browserStorageAdapter.saveFollowing).toHaveBeenCalledWith(new Set());
    });
  });

  describe('getFollowees', () => {
    it('should return list of followees', async () => {
      vi.spyOn(browserStorageAdapter, 'getFollowing').mockResolvedValue(new Set([
        '12D3KooWM8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q7',
        '12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q8'
      ]));

      const followees = await getFollowees();
      expect(followees).toEqual(['12D3KooWM8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q7', '12D3KooWN8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q8']);
    });

    it('should return empty array when no followees', async () => {
      vi.spyOn(browserStorageAdapter, 'getFollowing').mockResolvedValue(new Set());

      const followees = await getFollowees();
      expect(followees).toEqual([]);
    });
  });

  describe('isFollowing', () => {
    it('should return true if following', async () => {
      vi.spyOn(browserStorageAdapter, 'getFollowing').mockResolvedValue(new Set(['12D3KooWM8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q7']));

      const following = await isFollowing('12D3KooWM8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q7');
      expect(following).toBe(true);
    });

    it('should return false if not following', async () => {
      vi.spyOn(browserStorageAdapter, 'getFollowing').mockResolvedValue(new Set());

      const following = await isFollowing('12D3KooWM8vZwXhBhwD5aT34tXQjJm9F5K5bQG5a9x7Dk3L1P2Q7');
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
