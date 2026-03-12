import type { SignedPost } from './types.js';
import { getInteractionCounts } from './interactions.js';
import { getAllPosts, getPostsByChannel } from './posts.js';
import { Config } from '@isc/core';

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

function calculateEngagement(interactions: {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
}): number {
  const { weights } = Config.social.trending;
  return (
    interactions.likes * weights.likes +
    interactions.reposts * weights.reposts +
    interactions.replies * weights.replies +
    interactions.quotes * weights.quotes
  );
}

export function calculateTrendingScore(
  post: SignedPost,
  interactions: { likes: number; reposts: number; replies: number; quotes: number }
): number {
  const ageHours = (Date.now() - post.timestamp) / (1000 * 60 * 60);
  const engagement = calculateEngagement(interactions);

  if (engagement < Config.social.trending.minEngagement) return 0;
  return engagement / Math.pow(ageHours + 2, 1.5);
}

async function scorePost(post: SignedPost): Promise<RankedPost> {
  const interactions = await getInteractionCounts(post.id);
  const score = calculateTrendingScore(post, interactions);
  const engagementCount = interactions.likes + interactions.reposts + interactions.replies + interactions.quotes;

  return { ...post, trendingScore: score, engagementCount };
}

export async function getTrendingPosts(limit: number = 20): Promise<RankedPost[]> {
  const allPosts = await getAllPosts();
  const scored = await Promise.all(allPosts.map(scorePost));

  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

export async function getTrendingPostsForChannel(channelID: string, limit: number = 20): Promise<RankedPost[]> {
  const channelPosts = await getPostsByChannel(channelID);
  const scored = await Promise.all(channelPosts.map(scorePost));

  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

export async function getHotPosts(limit: number = 20): Promise<RankedPost[]> {
  const allPosts = await getAllPosts();
  const oneHourAgo = Date.now() - 3600 * 1000;
  const recentPosts = allPosts.filter((p) => p.timestamp > oneHourAgo);

  const scored = await Promise.all(
    recentPosts.map(async (post) => {
      const ranked = await scorePost(post);
      return { ...ranked, trendingScore: ranked.trendingScore * 2 };
    })
  );

  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}

export async function getExploreFeed(chaosLevel: number = 0.2, limit: number = 30): Promise<RankedPost[]> {
  const trending = await getTrendingPosts(limit * 2);
  if (chaosLevel <= 0) return trending.slice(0, limit);

  const channelCounts = new Map<string, number>();
  const diverse: RankedPost[] = [];
  const maxPerChannel = Math.ceil(limit / 3);

  for (const post of trending) {
    const count = channelCounts.get(post.channelID) ?? 0;
    if (count < maxPerChannel) {
      diverse.push(post);
      channelCounts.set(post.channelID, count + 1);
    }
  }

  if (chaosLevel > 0 && diverse.length > 5) {
    const chaosCount = Math.floor(diverse.length * chaosLevel);
    const startIndex = Math.floor(Math.random() * (diverse.length - chaosCount));
    const toShuffle = diverse.slice(startIndex, startIndex + chaosCount);

    for (let i = toShuffle.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
    }

    for (let i = 0; i < chaosCount; i++) {
      diverse[startIndex + i] = toShuffle[i];
    }
  }

  return diverse.slice(0, limit);
}

export async function getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
  const trending = await getTrendingPosts(limit * 3);
  const topicMap = new Map<string, { posts: RankedPost[]; totalEngagement: number; preview: string }>();

  for (const post of trending) {
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

export async function getFollowingFeed(limit: number = 50): Promise<RankedPost[]> {
  const { getFollowees } = await import('./graph.js');
  const followees = await getFollowees();

  if (followees.length === 0) return getTrendingPosts(limit);

  const allPosts = await getAllPosts();
  const followingPosts = allPosts.filter((p) => followees.includes(p.author));
  const scored = await Promise.all(followingPosts.map(scorePost));

  return scored
    .filter((p) => p.trendingScore > 0)
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
}
