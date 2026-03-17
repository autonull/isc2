/**
 * Feed Service
 *
 * Business logic layer for feed generation.
 * Handles For You, Following, and Channel feeds with scoring.
 */

import type { Post } from '../types/extended.js';
import type { Channel } from '@isc/core';
import { cosineSimilarity, computeEngagementScore as coreComputeEngagementScore } from '@isc/core';
import { formatRelativeTime } from '@isc/core';
import { getEmbeddingService } from '@isc/network';

const FOLLOWING_KEY = 'isc-following';

export interface FeedService {
  getForYouFeed(channelId?: string): Promise<Post[]>;
  getFollowingFeed(): Promise<Post[]>;
  getChannelFeed(channelId: string): Promise<Post[]>;
  getExploreFeed(): Promise<Post[]>;
  refresh(): Promise<void>;
  followUser(authorId: string): void;
  unfollowUser(authorId: string): void;
  getFollowingList(): string[];
}

// In-memory cache for feeds
const feedCache = new Map<string, { posts: Post[]; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

function getFollowingList(): string[] {
  try {
    const stored = localStorage.getItem(FOLLOWING_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveFollowingList(following: string[]): void {
  localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following));
}

export function createFeedService(
  postService: any,
  channelManager: any
): FeedService {
  return {
    async getForYouFeed(channelId?: string): Promise<Post[]> {
      const cacheKey = channelId ? `foryou-${channelId}` : 'foryou';

      // Check cache
      const cached = feedCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.posts;
      }

      // Get all posts
      let posts = await postService.getAllPosts(channelId);

      // Score and sort posts
      const scored = await scorePosts(posts, channelManager);

      // Cache result
      feedCache.set(cacheKey, {
        posts: scored,
        timestamp: Date.now(),
      });

      return scored;
    },

    async getFollowingFeed(): Promise<Post[]> {
      const following = getFollowingList();
      
      if (following.length === 0) {
        return [];
      }

      const cacheKey = `following-${following.join(',')}`;

      const cached = feedCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.posts;
      }

      const allPosts = await postService.getAllPosts();
      const followingSet = new Set(following);
      const followedPosts = allPosts.filter(post => 
        followingSet.has(post.author)
      );

      const sorted = followedPosts.sort((a: Post, b: Post) => b.timestamp - a.timestamp);

      feedCache.set(cacheKey, {
        posts: sorted,
        timestamp: Date.now(),
      });

      return sorted;
    },

    async getChannelFeed(channelId: string): Promise<Post[]> {
      const cacheKey = `channel-${channelId}`;

      // Check cache
      const cached = feedCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.posts;
      }

      const posts = await postService.getPostsByChannel(channelId);

      // Sort by timestamp (newest first)
      const sorted = posts.sort((a: Post, b: Post) => b.timestamp - a.timestamp);

      // Cache result
      feedCache.set(cacheKey, {
        posts: sorted,
        timestamp: Date.now(),
      });

      return sorted;
    },

    async getExploreFeed(): Promise<Post[]> {
      // Get all posts and sort by engagement
      const posts = await postService.getAllPosts();

      return posts.sort((a: Post, b: Post) => {
        const scoreA = computeEngagementScore(a);
        const scoreB = computeEngagementScore(b);
        return scoreB - scoreA;
      });
    },

    async refresh(): Promise<void> {
      // Clear all caches
      feedCache.clear();
    },

    followUser(authorId: string): void {
      const following = getFollowingList();
      if (!following.includes(authorId)) {
        following.push(authorId);
        saveFollowingList(following);
        this.refresh();
      }
    },

    unfollowUser(authorId: string): void {
      const following = getFollowingList();
      const index = following.indexOf(authorId);
      if (index >= 0) {
        following.splice(index, 1);
        saveFollowingList(following);
        this.refresh();
      }
    },

    getFollowingList(): string[] {
      return getFollowingList();
    },
  };
}

/**
 * Score posts based on relevance and engagement
 */
async function scorePosts(posts: Post[], channelManager: any): Promise<Post[]> {
  // Get active channels for context
  const channels: Channel[] = await channelManager.getAllChannels();
  const activeChannels = channels.filter((c: Channel) => channelManager.isActive(c.id));

  // If no active channels, sort by engagement
  if (activeChannels.length === 0) {
    return posts.sort((a, b) => coreComputeEngagementScore(b) - coreComputeEngagementScore(a));
  }

  // Score each post based on channel similarity
  const scored = posts.map(post => {
    const score = computeRelevanceScore(post, activeChannels);
    return { ...post, _score: score };
  });

  // Sort by score (highest first)
  return scored.sort((a, b) => (b._score || 0) - (a._score || 0));
}

/**
 * Compute relevance score for a post
 */
function computeRelevanceScore(post: Post, channels: Channel[]): number {
  // Base score from engagement
  const engagementScore = coreComputeEngagementScore(post);
  
  // Check if post matches any active channel
  let channelMatchScore = 0;
  for (const channel of channels) {
    if (post.channelID === channel.id) {
      channelMatchScore = 10; // Boost for matching channel
      break;
    }
  }

  // Recency bonus (newer posts get higher score)
  const age = Date.now() - post.timestamp;
  const recencyScore = Math.max(0, 1 - (age / (7 * 24 * 60 * 60 * 1000))); // 7 days half-life

  // Combined score
  return engagementScore + channelMatchScore + (recencyScore * 5);
}

/**
 * Compute semantic similarity between text and channel
 */
export async function computeTextChannelSimilarity(
  text: string,
  channel: Channel
): Promise<number> {
  const embeddingService = getEmbeddingService();
  if (embeddingService.isLoaded()) {
    try {
      const textEmbedding = await embeddingService.embed(text);
      const channelText = `${channel.name} ${channel.description}`;
      const channelEmbedding = await embeddingService.embed(channelText);
      return Math.max(0, cosineSimilarity(textEmbedding, channelEmbedding));
    } catch (e) {
      console.warn('Failed to embed text or channel for similarity', e);
    }
  }

  // Fallback if embedding is not loaded
  const textLower = text.toLowerCase();
  const channelLower = channel.name.toLowerCase();
  const descLower = channel.description.toLowerCase();
  
  let score = 0;
  
  // Check if channel name appears in text
  if (textLower.includes(channelLower)) {
    score += 0.5;
  }
  
  // Check for keyword matches in description
  const keywords = channel.description.split(/\s+/).filter(w => w.length > 4);
  for (const keyword of keywords.slice(0, 10)) {
    if (textLower.includes(keyword.toLowerCase())) {
      score += 0.1;
    }
  }
  
  return Math.min(1, score);
}
