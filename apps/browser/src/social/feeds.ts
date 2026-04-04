/* eslint-disable */
import type { SignedPost } from '@isc/social';
import type { RankedPost } from './types.ts';
import { getAllPosts, getPostsByChannel } from './posts.ts';
import { getFollowees } from './graph.ts';
import { cosineSimilarity, type Distribution } from '@isc/core';
import { getActiveChannel } from '../channels/manager.ts';
import { loggers } from '../utils/logger.ts';

const logger = loggers.app;

interface ScoredPost {
  post: SignedPost;
  score: number;
  similarityScore?: number;
  matchedChannel?: string;
}

/**
 * Get "For You" feed ranked by semantic similarity to active channel
 */
export async function getForYouFeed(limit: number = 50): Promise<RankedPost[]> {
  const allPosts = await getAllPosts();
  const activeCh = await getActiveChannel();

  if (!activeCh || !activeCh.distributions || activeCh.distributions.length === 0) {
    logger.warn('No active channel distributions, using chronological fallback');
    const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, limit).map(post => toRankedPost(post));
  }

  // Rank posts by semantic similarity to active channel distributions
  const scoredPosts: ScoredPost[] = allPosts.map(post => {
    const score = computePostScore(post, activeCh.distributions!, activeCh.id);
    return {
      post,
      score: score.total,
      similarityScore: score.similarity,
      matchedChannel: score.matchedChannel,
    };
  });

  // Sort by score descending
  const sorted = scoredPosts
    .sort((a, b) => b.score - a.score)
    .map(s => toRankedPost(s.post, s.score, s.similarityScore, s.matchedChannel));

  return sorted.slice(0, limit);
}

/**
 * Compute semantic score for a post against channel distributions
 */
function computePostScore(
  post: SignedPost,
  distributions: Distribution[],
  activeChannelId?: string
): { total: number; similarity: number; matchedChannel?: string } {
  let maxSimilarity = 0;
  let matchedChannel: string | undefined;

  // Compare post embedding against all channel distributions
  if (post.embedding && distributions.length > 0) {
    for (const dist of distributions) {
      const similarity = cosineSimilarity(post.embedding, dist.mu);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedChannel = dist.tag || 'root';
      }
    }
  }

  // Base score from similarity (0-1 range mapped to 0-10)
  const similarityScore = maxSimilarity * 10;

  // Channel match boost
  const channelBoost = post.channelID === activeChannelId ? 5 : 0;

  // Recency decay (posts lose 1 point per hour, max 5 points)
  const ageHours = (Date.now() - post.timestamp) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 5 - ageHours);

  return {
    total: similarityScore + channelBoost + recencyScore,
    similarity: maxSimilarity,
    matchedChannel,
  };
}

/**
 * Convert SignedPost to RankedPost with engagement metrics
 */
function toRankedPost(
  post: SignedPost,
  score?: number,
  similarityScore?: number,
  matchedChannel?: string
): RankedPost {
  return {
    ...post,
    trendingScore: score || 0,
    engagementCount: 0,
    similarityScore,
    matchedChannel,
  };
}

/**
 * Get "Following" feed - posts from followed users
 */
export async function getFollowingFeed(limit: number = 50): Promise<SignedPost[]> {
  const followees = await getFollowees();
  const allPosts = await getAllPosts();
  const followingPosts = allPosts.filter((post) => followees.includes(post.author));
  const sorted = followingPosts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

/**
 * Get "Explore" feed - trending/high-engagement posts
 */
export async function getExploreFeed(limit: number = 50): Promise<SignedPost[]> {
  const allPosts = await getAllPosts();
  // Could add engagement scoring here
  const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

/**
 * Get feed for specific channel
 */
export async function getChannelFeed(channelID: string, limit: number = 50): Promise<SignedPost[]> {
  const posts = await getPostsByChannel(channelID);
  const sorted = posts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

/**
 * Refresh feed (trigger re-fetch from network)
 */
export async function refreshFeed(channelID?: string): Promise<void> {
  logger.info('Refreshing feed', { channelID: channelID || 'all channels' });
}

/**
 * Get trending posts by engagement and recency
 */
export async function getTrendingPosts(
  channelID?: string,
  timeWindow: number = 3600000, // 1 hour default
  limit: number = 20
): Promise<RankedPost[]> {
  const allPosts = channelID
    ? await getPostsByChannel(channelID)
    : await getAllPosts();

  const now = Date.now();
  const windowStart = now - timeWindow;

  // Filter to recent posts
  const recentPosts = allPosts.filter(p => p.timestamp >= windowStart);

  // Score by engagement velocity (likes + reposts + replies per hour)
  const scoredPosts = recentPosts.map(post => {
    const ageHours = Math.max(1, (now - post.timestamp) / (1000 * 60 * 60));
    const engagementCount = getEngagementCount(post);
    const velocity = engagementCount / ageHours;

    return {
      ...post,
      trendingScore: velocity,
      engagementCount,
    };
  });

  // Sort by trending score descending
  return scoredPosts
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

/**
 * Get engagement count for a post
 */
function getEngagementCount(_post: SignedPost): number {
  // In production, would fetch from DHT or engagement store
  // For now, return 0 (would need likes/reposts/replies integration)
  return 0;
}

/**
 * Get semantic matches for a post (similar posts)
 */
export async function getSimilarPosts(post: SignedPost, limit: number = 10): Promise<SignedPost[]> {
  if (!post.embedding) {
    return [];
  }

  const allPosts = await getAllPosts();
  const otherPosts = allPosts.filter(p => p.id !== post.id && p.embedding);

  const scored = otherPosts
    .map(p => ({
      post: p,
      similarity: cosineSimilarity(post.embedding!, p.embedding!),
    }))
    .filter(s => s.similarity > 0.5) // Minimum similarity threshold
    .sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, limit).map(s => s.post);
}
