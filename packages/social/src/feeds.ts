/**
 * Feed Service
 *
 * Feed generation and ranking. Uses engagement scoring and optional semantic
 * similarity (when posts carry embedding vectors) to rank content.
 */

import { cosineSimilarity } from '@isc/core';
import type { ScoredPost, SignedPost } from './types.js';
import type { PostService } from './posts.js';

export interface TrendingPost extends ScoredPost {
  trendingScore: number;
  engagementCount: number;
}

export interface FeedService {
  getForYou(limit?: number): Promise<ScoredPost[]>;
  getByChannel(channelId: string, limit?: number): Promise<ScoredPost[]>;
  getFollowing(followedIds: string[], limit?: number): Promise<ScoredPost[]>;
  getExplore(limit?: number): Promise<ScoredPost[]>;
  getTrending(channelId?: string, timeWindowMs?: number, limit?: number): Promise<TrendingPost[]>;
  getSimilarPosts(post: SignedPost, limit?: number): Promise<ScoredPost[]>;
}

export function createFeedService(postService: PostService): FeedService {
  return {
    async getForYou(limit = 50): Promise<ScoredPost[]> {
      const allPosts = await postService.getAll();
      return allPosts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },

    async getByChannel(channelId: string, limit = 50): Promise<ScoredPost[]> {
      const posts = await postService.getByChannel(channelId);
      return posts.slice(-limit);
    },

    async getFollowing(followedIds: string[], limit = 50): Promise<ScoredPost[]> {
      if (followedIds.length === 0) return [];
      const followedSet = new Set(followedIds);
      const allPosts = await postService.getAll();
      return allPosts
        .filter((p) => followedSet.has(p.author))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    },

    async getExplore(limit = 50): Promise<ScoredPost[]> {
      const allPosts = await postService.getAll();
      return allPosts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },

    async getTrending(
      channelId?: string,
      timeWindowMs = 3_600_000,
      limit = 20
    ): Promise<TrendingPost[]> {
      const allPosts = channelId
        ? await postService.getByChannel(channelId)
        : await postService.getAll();

      const now = Date.now();
      const windowStart = now - timeWindowMs;
      const recent = allPosts.filter((p) => p.timestamp >= windowStart);

      return recent
        .map((post) => {
          const ageHours = Math.max(1, (now - post.timestamp) / 3_600_000);
          const engagementCount =
            (post.likes?.length ?? 0) + (post.replies?.length ?? 0);
          const trendingScore = engagementCount / ageHours;
          return { ...post, trendingScore, engagementCount };
        })
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, limit);
    },

    async getSimilarPosts(post: SignedPost, limit = 10): Promise<ScoredPost[]> {
      if (!post.embedding) return [];

      const allPosts = await postService.getAll();
      return allPosts
        .filter((p) => p.id !== post.id && p.embedding != null)
        .map((p) => ({
          ...p,
          score: cosineSimilarity(post.embedding!, p.embedding!),
        }))
        .filter((p) => p.score > 0.5)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
