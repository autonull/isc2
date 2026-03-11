/**
 * Trending & Global Explore Service
 * 
 * Handles engagement-weighted ranking and trending detection.
 * References: SOCIAL.md#trending--global-explore
 */

import { queryPostsByEmbedding } from './posts';
import { computeEngagementScore, getReplies } from './interactions';
import { getChannel } from '../channels/manager';
import type { RankedPost, SignedPost } from './types';

/** Decay factor for time-based scoring (half-life: 1 hour) */
const TIME_DECAY_HALF_LIFE = 3600 * 1000;

/** Minimum engagement threshold for trending */
const MIN_TRENDING_ENGAGEMENT = 5;

/**
 * Compute trending score for a post
 */
export async function computeTrendingScore(post: SignedPost): Promise<number> {
  const engagement = await computeEngagementScore(post.postID);
  const age = Date.now() - post.timestamp;
  const timeDecay = Math.exp(-age / TIME_DECAY_HALF_LIFE);
  
  // Trending = engagement * timeDecay
  return engagement * timeDecay;
}

/**
 * Get trending posts globally
 */
export async function getTrendingPosts(limit: number = 20): Promise<RankedPost[]> {
  const channelIDs = await getActiveChannelIDs();
  const allPosts: RankedPost[] = [];
  
  for (const channelID of channelIDs) {
    const channel = await getChannel(channelID);
    if (!channel) continue;
    
    const sample = channel.distributions[0]?.mu ?? [];
    if (sample.length === 0) continue;
    
    const posts = await queryPostsByEmbedding(sample, limit * 3);
    const scored = await Promise.all(
      posts.map(async (post) => ({
        post,
        score: await computeTrendingScore(post),
      }))
    );
    
    allPosts.push(
      ...scored
        .filter(s => s.score > 0)
        .map(s => ({
          ...s.post,
          similarityScore: s.score,
          matchedChannel: channelID,
        }))
    );
  }
  
  // Sort by trending score
  allPosts.sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0));
  return allPosts.slice(0, limit);
}

/**
 * Get trending topics (based on reply clusters)
 */
export async function getTrendingTopics(limit: number = 10): Promise<TrendingTopic[]> {
  const trending = await getTrendingPosts(limit * 5);
  const topicMap = new Map<string, { post: RankedPost; replyCount: number }>();
  
  for (const post of trending) {
    const replies = await getReplies(post.postID);
    if (replies.length >= 2) {
      const existing = topicMap.get(post.content.slice(0, 50));
      if (!existing || replies.length > existing.replyCount) {
        topicMap.set(post.content.slice(0, 50), { post, replyCount: replies.length });
      }
    }
  }
  
  const topics = Array.from(topicMap.values())
    .sort((a, b) => b.replyCount - a.replyCount)
    .slice(0, limit)
    .map(t => ({
      preview: t.post.content.slice(0, 100) + '...',
      replyCount: t.replyCount,
      postID: t.post.postID,
    }));
  
  return topics;
}

/**
 * Get explore feed with serendipity factor
 */
export async function getExploreFeed(
  channelID: string,
  chaosLevel: number = 0.2,
  limit: number = 20
): Promise<RankedPost[]> {
  const channel = await getChannel(channelID);
  if (!channel) return [];
  
  let sample = channel.distributions[0]?.mu ?? [];
  if (sample.length === 0) return [];
  
  // Apply chaos mode for serendipity
  if (chaosLevel > 0) {
    sample = applyChaosMode(sample, chaosLevel);
  }
  
  const posts = await queryPostsByEmbedding(sample, limit * 4);
  const scored = await Promise.all(
    posts.map(async (post) => ({
      post,
      similarity: cosineSimilarity(channel.distributions[0]?.mu ?? [], post.embedding),
      engagement: await computeEngagementScore(post.postID),
    }))
  );
  
  // Combine similarity and engagement
  const ranked = scored
    .filter(s => s.similarity > 0.5)
    .map(s => ({
      ...s.post,
      similarityScore: s.similarity * 0.7 + (s.engagement / 100) * 0.3,
      matchedChannel: channelID,
    }))
    .sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0))
    .slice(0, limit);
  
  return ranked;
}

/**
 * Get global explore (all channels)
 */
export async function getGlobalExplore(limit: number = 30): Promise<RankedPost[]> {
  const trending = await getTrendingPosts(limit);
  
  // Add diversity by ensuring variety of channels
  const channelCounts = new Map<string, number>();
  const diverse: RankedPost[] = [];
  
  for (const post of trending) {
    const channel = post.matchedChannel || 'default';
    const count = channelCounts.get(channel) || 0;
    if (count < limit / 5) { // Max 20% from same channel
      diverse.push(post);
      channelCounts.set(channel, count + 1);
    }
  }
  
  return diverse.slice(0, limit);
}

// Helpers
async function getActiveChannelIDs(): Promise<string[]> {
  // Placeholder - would query DHT for active channels
  return ['default'];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const dot = a.reduce((sum, va, i) => sum + va * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

function applyChaosMode(embedding: number[], chaosLevel: number): number[] {
  const noise = embedding.map(() => (Math.random() * 2 - 1) * chaosLevel);
  const perturbed = embedding.map((v, i) => v + noise[i]);
  const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? perturbed.map(v => v / norm) : embedding;
}

export interface TrendingTopic {
  preview: string;
  replyCount: number;
  postID: string;
}
