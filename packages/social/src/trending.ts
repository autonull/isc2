/**
 * Trending Posts Module
 *
 * Sophisticated trending calculation with engagement scoring and time decay.
 */

import type { SignedPost } from './types.js';

export interface RankedPost extends SignedPost {
  trendingScore: number;
  engagementCount: number;
}

export interface TrendingTopic {
  preview: string;
  postCount: number;
  totalEngagement: number;
  postID: string;
  channelID: string;
}

export interface TrendingConfig {
  weights: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  };
  minEngagement: number;
}

export const DEFAULT_TRENDING_CONFIG: TrendingConfig = {
  weights: {
    likes: 1,
    reposts: 3,
    replies: 2,
    quotes: 2,
  },
  minEngagement: 0,
};

function calculateEngagement(
  interactions: {
    likes: number;
    reposts: number;
    replies: number;
    quotes: number;
  },
  config: TrendingConfig
): number {
  const { weights } = config;
  return (
    interactions.likes * weights.likes +
    interactions.reposts * weights.reposts +
    interactions.replies * weights.replies +
    interactions.quotes * weights.quotes
  );
}

export function calculateTrendingScore(
  post: SignedPost,
  interactions: { likes: number; reposts: number; replies: number; quotes: number },
  config: TrendingConfig = DEFAULT_TRENDING_CONFIG
): number {
  const ageHours = (Date.now() - post.timestamp) / (1000 * 60 * 60);
  const engagement = calculateEngagement(interactions, config);

  if (engagement < config.minEngagement) return 0;
  return engagement / Math.pow(ageHours + 2, 1.5);
}

export function scorePost(
  post: SignedPost,
  interactions: { likes: number; reposts: number; replies: number; quotes: number },
  config: TrendingConfig = DEFAULT_TRENDING_CONFIG
): RankedPost {
  const score = calculateTrendingScore(post, interactions, config);
  const engagementCount = interactions.likes + interactions.reposts + interactions.replies + interactions.quotes;

  return { ...post, trendingScore: score, engagementCount };
}

export function filterAndRankPosts(posts: RankedPost[], limit: number = 20): RankedPost[] {
  return posts
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

export function diversifyByChannel(posts: RankedPost[], limit: number = 30, maxPerChannel: number = -1): RankedPost[] {
  if (maxPerChannel < 0) {
    maxPerChannel = Math.ceil(limit / 3);
  }

  const channelCounts = new Map<string, number>();
  const diverse: RankedPost[] = [];

  for (const post of posts) {
    const count = channelCounts.get(post.channelID) ?? 0;
    if (count < maxPerChannel) {
      diverse.push(post);
      channelCounts.set(post.channelID, count + 1);
    }
  }

  return diverse.slice(0, limit);
}

export function applyChaosFactor(posts: RankedPost[], chaosLevel: number = 0.2): RankedPost[] {
  if (chaosLevel <= 0 || posts.length <= 5) return posts;

  const result = [...posts];
  const chaosCount = Math.floor(result.length * chaosLevel);
  const startIndex = Math.floor(Math.random() * (result.length - chaosCount));
  const toShuffle = result.slice(startIndex, startIndex + chaosCount);

  // Fisher-Yates shuffle
  for (let i = toShuffle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
  }

  for (let i = 0; i < chaosCount; i++) {
    result[startIndex + i] = toShuffle[i];
  }

  return result;
}

export function extractTrendingTopics(posts: RankedPost[], limit: number = 10): TrendingTopic[] {
  const topicMap = new Map<string, { posts: RankedPost[]; totalEngagement: number; preview: string }>();

  for (const post of posts) {
    const topicKey = post.content.slice(0, 50).toLowerCase().trim();
    if (topicKey.length < 10) continue;

    const existing = topicMap.get(topicKey);
    if (existing) {
      existing.posts.push(post);
      existing.totalEngagement += post.engagementCount;
    } else {
      topicMap.set(topicKey, {
        posts: [post],
        totalEngagement: post.engagementCount,
        preview: post.content.slice(0, 100),
      });
    }
  }

  return Array.from(topicMap.values())
    .filter((t) => t.posts.length >= 1)
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, limit)
    .map((t) => ({
      preview: t.preview + (t.posts.length > 1 ? '...' : ''),
      postCount: t.posts.length,
      totalEngagement: t.totalEngagement,
      postID: t.posts[0].id,
      channelID: t.posts[0].channelID,
    }));
}

export function filterRecentPosts(posts: RankedPost[], ageHours: number = 1): RankedPost[] {
  const cutoffTime = Date.now() - ageHours * 60 * 60 * 1000;
  return posts.filter((p) => p.timestamp > cutoffTime);
}
