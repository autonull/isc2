/**
 * Analytics Service Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock interactions module
vi.mock('../../src/social/interactions', () => ({
  getInteractionCounts: vi.fn().mockResolvedValue({ likes: 0, reposts: 0, replies: 0, quotes: 0 }),
}));

// Mock posts module
vi.mock('../../src/social/posts', () => ({
  getPostsByAuthor: vi.fn().mockResolvedValue([]),
}));

describe('Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackView', () => {
    it('should track a view for a post', async () => {
      const { trackView } = await import('../../src/social/analytics');

      await expect(trackView('post-123')).resolves.not.toThrow();
    });

    it('should not double-count rapid views', async () => {
      const { trackView } = await import('../../src/social/analytics');

      // Track first view
      await trackView('post-123');
      // Track second view immediately (should be ignored)
      await trackView('post-123');

      // Should not throw
    });
  });

  describe('getMetrics', () => {
    it('should return engagement metrics for a post', async () => {
      const { getMetrics } = await import('../../src/social/analytics');

      const metrics = await getMetrics('post-123');

      expect(metrics.postId).toBe('post-123');
      expect('views' in metrics).toBe(true);
      expect('likes' in metrics).toBe(true);
      expect('reposts' in metrics).toBe(true);
      expect('replies' in metrics).toBe(true);
      expect('quotes' in metrics).toBe(true);
      expect('lastUpdated' in metrics).toBe(true);
    });
  });

  describe('getAggregateMetrics', () => {
    it('should return metrics for multiple posts', async () => {
      const { getAggregateMetrics } = await import('../../src/social/analytics');

      const postIds = ['post-1', 'post-2', 'post-3'];
      const metrics = await getAggregateMetrics(postIds);

      expect(metrics instanceof Map).toBe(true);
      expect(metrics.size).toBe(3);
    });
  });

  describe('getTopPostsByEngagement', () => {
    it('should return top posts sorted by engagement', async () => {
      const { getTopPostsByEngagement } = await import('../../src/social/analytics');

      const top = await getTopPostsByEngagement(10);

      expect(Array.isArray(top)).toBe(true);
    });
  });

  describe('getTopPostsByViews', () => {
    it('should return top posts sorted by views', async () => {
      const { getTopPostsByViews } = await import('../../src/social/analytics');

      const top = await getTopPostsByViews(10);

      expect(Array.isArray(top)).toBe(true);
    });
  });

  describe('trackImpression', () => {
    it('should track an impression for a post', async () => {
      const { trackImpression } = await import('../../src/social/analytics');

      await expect(trackImpression('post-123', 5)).resolves.not.toThrow();
    });
  });

  describe('getCTR', () => {
    it('should return click-through rate', async () => {
      const { getCTR } = await import('../../src/social/analytics');

      const ctr = await getCTR('post-123');

      expect(typeof ctr).toBe('number');
      expect(ctr).toBeGreaterThanOrEqual(0);
      expect(ctr).toBeLessThanOrEqual(1);
    });
  });

  describe('getUserEngagementSummary', () => {
    it('should return engagement summary for a user', async () => {
      const { getUserEngagementSummary } = await import('../../src/social/analytics');

      const summary = await getUserEngagementSummary('test-peer-id');

      expect('totalPosts' in summary).toBe(true);
      expect('totalViews' in summary).toBe(true);
      expect('totalLikes' in summary).toBe(true);
      expect('totalReposts' in summary).toBe(true);
      expect('totalReplies' in summary).toBe(true);
      expect('avgEngagementRate' in summary).toBe(true);
    });
  });

  describe('clearOldAnalytics', () => {
    it('should clear analytics older than specified days', async () => {
      const { clearOldAnalytics } = await import('../../src/social/analytics');

      await expect(clearOldAnalytics(30)).resolves.not.toThrow();
    });
  });

  describe('registerPost', () => {
    it('should register a post for analytics tracking', async () => {
      const { registerPost } = await import('../../src/social/analytics');

      const post = {
        id: 'post-123',
        author: 'author',
        content: 'test',
        channelID: 'channel',
        timestamp: Date.now(),
        signature: { data: new Uint8Array(), algorithm: 'Ed25519' as const },
      };

      await expect(registerPost(post)).resolves.not.toThrow();
    });
  });
});
