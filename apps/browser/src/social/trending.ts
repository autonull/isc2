/**
 * Trending & Global Explore Service
 *
 * Handles engagement-weighted post ranking with time decay.
 * References: SOCIAL.md#trending--global-explore
 */

import type { SignedPost } from './types.js';
import { getInteractionCounts } from './interactions.js';
import { getAllPosts, getPostsByChannel } from './posts.js';

/** Time decay half-life in milliseconds (1 hour) */
const TIME_DECAY_HALF_LIFE = 3600 * 1000;

/** Minimum engagement threshold for trending consideration */
const MIN_ENGAGEMENT = 3;

/** Engagement weights */
const ENGAGEMENT_WEIGHTS = {
  likes: 1,
  reposts: 2,
  replies: 3,
  quotes: 2,
};

/**
 * Ranked post with trending score
 */
export interface RankedPost extends SignedPost {
  trendingScore: number;
  engagementCount: number;
}

/**
 * Calculate trending score for a post using Gravity-style ranking
 *
 * Formula: engagement / (ageHours + 2)^1.5
 * Similar to Hacker News ranking algorithm
 */
export function calculateTrendingScore(
  post: SignedPost,
  interactions: { likes: number; reposts: number; replies: number; quotes: number }
): number {
  const age = Date.now() - post.timestamp;
  const ageHours = age / (1000 * 60 * 60);

  // Weighted engagement
  const engagement =
    interactions.likes * ENGAGEMENT_WEIGHTS.likes +
    interactions.reposts * ENGAGEMENT_WEIGHTS.reposts +
    interactions.replies * ENGAGEMENT_WEIGHTS.replies +
    interactions.quotes * ENGAGEMENT_WEIGHTS.quotes;

  // Skip posts with insufficient engagement
  if (engagement < MIN_ENGAGEMENT) {
    return 0;
  }

  // Gravity-style ranking with time decay
  const score = engagement / Math.pow(ageHours + 2, 1.5);

  return score;
}

/**
 * Get trending posts across all channels
 */
export async function getTrendingPosts(limit: number = 20): Promise<RankedPost[]> {
  const allPosts = await getAllPosts();

  const scored = await Promise.all(
    allPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const score = calculateTrendingScore(post, interactions);

      return {
        ...post,
        trendingScore: score,
        engagementCount: interactions.likes + interactions.reposts + interactions.replies + interactions.quotes,
      };
    })
  );

  // Filter and sort by trending score
  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

/**
 * Get trending posts for a specific channel
 */
export async function getTrendingPostsForChannel(
  channelID: string,
  limit: number = 20
): Promise<RankedPost[]> {
  const channelPosts = await getPostsByChannel(channelID);

  const scored = await Promise.all(
    channelPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const score = calculateTrendingScore(post, interactions);

      return {
        ...post,
        trendingScore: score,
        engagementCount: interactions.likes + interactions.reposts + interactions.replies + interactions.quotes,
      };
    })
  );

  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

/**
 * Get hot posts (recent with high engagement)
 * Uses shorter time window for "hot" vs "trending"
 */
export async function getHotPosts(limit: number = 20): Promise<RankedPost[]> {
  const allPosts = await getAllPosts();
  const now = Date.now();
  const oneHourAgo = now - 3600 * 1000; // 1 hour

  // Filter to recent posts
  const recentPosts = allPosts.filter((p) => p.timestamp > oneHourAgo);

  const scored = await Promise.all(
    recentPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const score = calculateTrendingScore(post, interactions);

      return {
        ...post,
        trendingScore: score * 2, // Boost recent posts
        engagementCount: interactions.likes + interactions.reposts + interactions.replies + interactions.quotes,
      };
    })
  );

  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

/**
 * Get explore feed with diversity and serendipity
 * Mixes trending posts with some random high-quality posts
 */
export async function getExploreFeed(
  chaosLevel: number = 0.2,
  limit: number = 30
): Promise<RankedPost[]> {
  const trending = await getTrendingPosts(limit * 2);

  if (chaosLevel <= 0) {
    return trending.slice(0, limit);
  }

  // Ensure channel diversity
  const channelCounts = new Map<string, number>();
  const diverse: RankedPost[] = [];
  const maxPerChannel = Math.ceil(limit / 3); // Max ~33% from same channel

  for (const post of trending) {
    const count = channelCounts.get(post.channelID) || 0;
    if (count < maxPerChannel) {
      diverse.push(post);
      channelCounts.set(post.channelID, count + 1);
    }
  }

  // Add chaos/serendipity by shuffling some posts
  if (chaosLevel > 0 && diverse.length > 5) {
    const chaosCount = Math.floor(diverse.length * chaosLevel);
    const startIndex = Math.floor(Math.random() * (diverse.length - chaosCount));
    const toShuffle = diverse.slice(startIndex, startIndex + chaosCount);

    // Fisher-Yates shuffle
    for (let i = toShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
    }

    // Put shuffled posts back
    for (let i = 0; i < chaosCount; i++) {
      diverse[startIndex + i] = toShuffle[i];
    }
  }

  return diverse.slice(0, limit);
}

/**
 * Get trending topics based on reply clusters
 * Groups posts by content similarity and counts engagement
 */
export async function getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
  const trending = await getTrendingPosts(limit * 3);

  // Group by content prefix (simple clustering)
  const topicMap = new Map<
    string,
    {
      posts: RankedPost[];
      totalEngagement: number;
      preview: string;
    }
  >();

  for (const post of trending) {
    // Use first 50 chars as topic key
    const topicKey = post.content.slice(0, 50).toLowerCase().trim();
    if (topicKey.length < 10) continue; // Skip very short content

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

  // Convert to topics and sort by engagement
  const topics = Array.from(topicMap.values())
    .filter((t) => t.posts.length >= 1) // At least 1 post
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, limit)
    .map((t) => ({
      preview: t.preview + (t.posts.length > 1 ? '...' : ''),
      postCount: t.posts.length,
      totalEngagement: t.totalEngagement,
      postID: t.posts[0].id,
      channelID: t.posts[0].channelID,
    }));

  return topics;
}

/**
 * Get personalized feed based on followed users
 */
export async function getFollowingFeed(limit: number = 50): Promise<RankedPost[]> {
  const { getFollowees } = await import('./graph.js');
  const followees = await getFollowees();

  if (followees.length === 0) {
    return getTrendingPosts(limit);
  }

  const allPosts = await getAllPosts();
  const followingPosts = allPosts.filter((p) => followees.includes(p.author));

  const scored = await Promise.all(
    followingPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const score = calculateTrendingScore(post, interactions);

      return {
        ...post,
        trendingScore: score,
        engagementCount: interactions.likes + interactions.reposts + interactions.replies + interactions.quotes,
      };
    })
  );

  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

/**
 * Trending topic summary
 */
export interface TrendingTopic {
  preview: string;
  postCount: number;
  totalEngagement: number;
  postID: string;
  channelID: string;
}
