/* eslint-disable */
// Re-export trending utilities from @isc/social for backward compatibility
export {
  calculateTrendingScore,
  scorePost,
  filterAndRankPosts,
  diversifyByChannel,
  applyChaosFactor,
  extractTrendingTopics,
  filterRecentPosts,
  type RankedPost,
  type TrendingTopic,
  type TrendingConfig,
  DEFAULT_TRENDING_CONFIG,
} from '@isc/social/trending';

import type { RankedPost, TrendingTopic } from '@isc/social/trending';
import { getInteractionCounts } from './interactions.ts';
import { getAllPosts, getPostsByChannel } from './posts.ts';

export async function getTrendingPosts(limit: number = 20): Promise<RankedPost[]> {
  const allPosts = await getAllPosts();
  // Score posts with local interactions data
  const scored = await Promise.all(
    allPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const { scorePost } = await import('@isc/social/trending');
      return scorePost(post, interactions);
    })
  );

  const { filterAndRankPosts } = await import('@isc/social/trending');
  return filterAndRankPosts(scored, limit);
}

export async function getTrendingPostsForChannel(channelID: string, limit: number = 20): Promise<RankedPost[]> {
  const channelPosts = await getPostsByChannel(channelID);
  const scored = await Promise.all(
    channelPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const { scorePost } = await import('@isc/social/trending');
      return scorePost(post, interactions);
    })
  );

  const { filterAndRankPosts } = await import('@isc/social/trending');
  return filterAndRankPosts(scored, limit);
}

export async function getHotPosts(limit: number = 20): Promise<RankedPost[]> {
  const allPosts = await getAllPosts();
  const oneHourAgo = Date.now() - 3600 * 1000;
  const recentPosts = allPosts.filter((p) => p.timestamp > oneHourAgo);

  const scored = await Promise.all(
    recentPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const { scorePost } = await import('@isc/social/trending');
      const ranked = scorePost(post, interactions);
      return { ...ranked, trendingScore: ranked.trendingScore * 2 };
    })
  );

  const { filterAndRankPosts } = await import('@isc/social/trending');
  return filterAndRankPosts(scored, limit);
}

export async function getExploreFeed(chaosLevel: number = 0.2, limit: number = 30): Promise<RankedPost[]> {
  const trending = await getTrendingPosts(limit * 2);
  if (chaosLevel <= 0) return trending.slice(0, limit);

  const { diversifyByChannel, applyChaosFactor } = await import('@isc/social/trending');
  let diverse = diversifyByChannel(trending, limit);
  diverse = applyChaosFactor(diverse, chaosLevel);
  return diverse.slice(0, limit);
}

export async function getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
  const trending = await getTrendingPosts(limit * 3);
  const { extractTrendingTopics } = await import('@isc/social/trending');
  return extractTrendingTopics(trending, limit);
}

export async function getFollowingFeed(limit: number = 50): Promise<RankedPost[]> {
  const { getFollowees } = await import('./graph.ts');
  const followees = await getFollowees();

  if (followees.length === 0) return getTrendingPosts(limit);

  const allPosts = await getAllPosts();
  const followingPosts = allPosts.filter((p) => followees.includes(p.author));
  const scored = await Promise.all(
    followingPosts.map(async (post) => {
      const interactions = await getInteractionCounts(post.id);
      const { scorePost } = await import('@isc/social/trending');
      return scorePost(post, interactions);
    })
  );

  const { filterAndRankPosts } = await import('@isc/social/trending');
  return filterAndRankPosts(scored, limit);
}
