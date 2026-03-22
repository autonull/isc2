/**
 * Feed Service
 *
 * Feed generation and ranking.
 */

import type { ScoredPost } from '../types';
import type { PostService } from './posts.js';

export interface FeedService {
  getForYou(limit?: number): Promise<ScoredPost[]>;
  getByChannel(channelId: string, limit?: number): Promise<ScoredPost[]>;
  getFollowing(limit?: number): Promise<ScoredPost[]>;
  getExplore(limit?: number): Promise<ScoredPost[]>;
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

    async getFollowing(limit = 50): Promise<ScoredPost[]> {
      // TODO: Filter by followed authors
      const allPosts = await postService.getAll();
      return allPosts.slice(-limit);
    },

    async getExplore(limit = 50): Promise<ScoredPost[]> {
      // TODO: Implement explore feed with diversity
      const allPosts = await postService.getAll();
      return allPosts
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
