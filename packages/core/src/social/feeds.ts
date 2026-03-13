/**
 * Social Feeds - Environment-agnostic feed ranking
 *
 * Provides semantic feed ranking, trending, and discovery algorithms.
 */

import { cosineSimilarity, type Distribution } from '../index.js';
import type { SignedPost, RankedPost } from './types.js';

/**
 * Post scoring result
 */
interface ScoredPost {
  post: SignedPost;
  score: number;
  similarityScore?: number;
  matchedChannel?: string;
}

/**
 * Feed provider interface
 */
export interface FeedProvider {
  getAllPosts(): Promise<SignedPost[]>;
  getPostsByChannel(channelID: string): Promise<SignedPost[]>;
  getFollowees?(): Promise<string[]>;
  getActiveChannel?(): Promise<{ id: string; distributions?: Distribution[] } | null>;
}

/**
 * Get "For You" feed ranked by semantic similarity to active channel
 */
export async function getForYouFeed(
  provider: FeedProvider,
  limit: number = 50
): Promise<RankedPost[]> {
  const allPosts = await provider.getAllPosts();
  const activeChannel = provider.getActiveChannel
    ? await provider.getActiveChannel()
    : null;

  if (!activeChannel || !activeChannel.distributions || activeChannel.distributions.length === 0) {
    const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, limit).map(post => toRankedPost(post));
  }

  const scoredPosts: ScoredPost[] = allPosts.map(post => {
    const score = computePostScore(post, activeChannel.distributions!, activeChannel.id);
    return {
      post,
      score: score.total,
      similarityScore: score.similarity,
      matchedChannel: score.matchedChannel,
    };
  });

  const sorted = scoredPosts
    .sort((a, b) => b.score - a.score)
    .map(s => toRankedPost(s.post, s.score, s.similarityScore, s.matchedChannel));

  return sorted.slice(0, limit);
}

/**
 * Get "Following" feed - posts from followed users
 */
export async function getFollowingFeed(
  provider: FeedProvider,
  limit: number = 50
): Promise<SignedPost[]> {
  if (!provider.getFollowees) {
    return [];
  }

  const followees = await provider.getFollowees();
  const allPosts = await provider.getAllPosts();
  const followingPosts = allPosts.filter((post) => followees.includes(post.author));
  const sorted = followingPosts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

/**
 * Get "Explore" feed - recent posts for discovery
 */
export async function getExploreFeed(
  provider: FeedProvider,
  limit: number = 50
): Promise<SignedPost[]> {
  const allPosts = await provider.getAllPosts();
  const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

/**
 * Get feed for specific channel
 */
export async function getChannelFeed(
  provider: FeedProvider,
  channelID: string,
  limit: number = 50
): Promise<SignedPost[]> {
  const posts = await provider.getPostsByChannel(channelID);
  const sorted = posts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

/**
 * Get trending posts by engagement velocity
 */
export async function getTrendingPosts(
  provider: FeedProvider,
  channelID?: string,
  timeWindow: number = 3600000,
  limit: number = 20
): Promise<RankedPost[]> {
  const allPosts = channelID
    ? await provider.getPostsByChannel(channelID)
    : await provider.getAllPosts();

  const now = Date.now();
  const windowStart = now - timeWindow;

  const recentPosts = allPosts.filter(post => post.timestamp >= windowStart);

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

  return scoredPosts
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

/**
 * Get semantic matches for a post (similar posts)
 */
export async function getSimilarPosts(
  post: SignedPost,
  provider: FeedProvider,
  limit: number = 10
): Promise<SignedPost[]> {
  if (!post.embedding) {
    return [];
  }

  const allPosts = await provider.getAllPosts();
  const otherPosts = allPosts.filter(p => p.id !== post.id && p.embedding);

  const scored = otherPosts
    .map(p => ({
      post: p,
      similarity: cosineSimilarity(post.embedding!, p.embedding!),
    }))
    .filter(s => s.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity);

  return scored.slice(0, limit).map(s => s.post);
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

  if (post.embedding && distributions.length > 0) {
    for (const dist of distributions) {
      const similarity = cosineSimilarity(post.embedding, dist.mu);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        matchedChannel = dist.tag || 'root';
      }
    }
  }

  const similarityScore = maxSimilarity * 10;
  const channelBoost = post.channelID === activeChannelId ? 5 : 0;
  const ageHours = (Date.now() - post.timestamp) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 5 - ageHours);

  return {
    total: similarityScore + channelBoost + recencyScore,
    similarity: maxSimilarity,
    matchedChannel,
  };
}

/**
 * Convert SignedPost to RankedPost
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
 * Get engagement count (placeholder for future engagement system)
 */
function getEngagementCount(_post: SignedPost): number {
  return 0;
}

/**
 * Feed service class for convenience
 */
export class FeedService {
  constructor(private provider: FeedProvider) {}

  async getForYou(limit?: number): Promise<RankedPost[]> {
    return getForYouFeed(this.provider, limit);
  }

  async getFollowing(limit?: number): Promise<SignedPost[]> {
    return getFollowingFeed(this.provider, limit);
  }

  async getExplore(limit?: number): Promise<SignedPost[]> {
    return getExploreFeed(this.provider, limit);
  }

  async getByChannel(channelID: string, limit?: number): Promise<SignedPost[]> {
    return getChannelFeed(this.provider, channelID, limit);
  }

  async getTrending(channelID?: string, timeWindow?: number, limit?: number): Promise<RankedPost[]> {
    return getTrendingPosts(this.provider, channelID, timeWindow, limit);
  }

  async getSimilar(post: SignedPost, limit?: number): Promise<SignedPost[]> {
    return getSimilarPosts(post, this.provider, limit);
  }
}
