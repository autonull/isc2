/**
 * Feed Service
 * 
 * Implements For You, Following, and Explore feeds.
 * References: SOCIAL.md#posts--feeds
 */

import { cosineSimilarity } from '@isc/core/math';
import type { RankedPost, SignedPost, FeedQuery, FollowSubscription } from './types';
import { queryPostsByEmbedding, getPostsByAuthor, isPostValid } from './posts';
import { getChannel } from '../channels/manager';

/** Minimum similarity threshold for For You feed */
const MIN_SIMILARITY = 0.6;

/**
 * Get "For You" feed - semantic proximity ranking
 */
export async function getForYouFeed(
  channelID: string,
  limit: number = 50
): Promise<RankedPost[]> {
  const channel = await getChannel(channelID);
  if (!channel) {
    return [];
  }

  // Sample from channel distribution for query vector
  const sample = channel.distributions[0]?.mu ?? [];
  if (sample.length === 0) {
    return [];
  }

  const candidates = await queryPostsByEmbedding(sample, limit * 4);
  
  // Score and rank by similarity
  const scored = candidates
    .filter(isPostValid)
    .map(post => ({
      post,
      score: cosineSimilarity(sample, post.embedding),
    }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter(s => s.score > MIN_SIMILARITY)
    .slice(0, limit)
    .map(s => ({
      ...s.post,
      similarityScore: s.score,
      matchedChannel: channelID,
    }));
}

/**
 * Get "Following" feed - posts from followed peers
 */
export async function getFollowingFeed(
  subscriptions: FollowSubscription[],
  limit: number = 50
): Promise<SignedPost[]> {
  const allPosts: SignedPost[] = [];

  for (const sub of subscriptions) {
    const authorPosts = await getPostsByAuthor(sub.followee, limit);
    allPosts.push(...authorPosts.filter(isPostValid));
  }

  // Sort by timestamp descending
  allPosts.sort((a, b) => b.timestamp - a.timestamp);
  return allPosts.slice(0, limit);
}

/**
 * Get "Explore" feed - trending posts
 */
export async function getExploreFeed(
  limit: number = 50
): Promise<RankedPost[]> {
  // For now, return high-engagement posts
  // TODO: Implement trending detection based on likes/reposts
  const channelIDs = await getActiveChannelIDs();
  const allPosts: RankedPost[] = [];

  for (const channelID of channelIDs.slice(0, 5)) {
    const channel = await getChannel(channelID);
    if (!channel) continue;

    const sample = channel.distributions[0]?.mu ?? [];
    if (sample.length === 0) continue;

    const posts = await queryPostsByEmbedding(sample, limit / 5);
    const scored = posts
      .filter(isPostValid)
      .map(post => ({
        post,
        score: cosineSimilarity(sample, post.embedding),
      }))
      .filter(s => s.score > MIN_SIMILARITY)
      .map(s => ({
        ...s.post,
        similarityScore: s.score,
        matchedChannel: channelID,
      }));

    allPosts.push(...scored);
  }

  allPosts.sort((a, b) => (b.similarityScore ?? 0) - (a.similarityScore ?? 0));
  return allPosts.slice(0, limit);
}

/**
 * Get channel-specific feed
 */
export async function getChannelFeed(
  channelID: string,
  limit: number = 50
): Promise<RankedPost[]> {
  const channel = await getChannel(channelID);
  if (!channel) {
    return [];
  }

  const sample = channel.distributions[0]?.mu ?? [];
  if (sample.length === 0) {
    return [];
  }

  const candidates = await queryPostsByEmbedding(sample, limit * 3);
  
  const scored = candidates
    .filter(isPostValid)
    .map(post => ({
      post,
      score: cosineSimilarity(sample, post.embedding),
    }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter(s => s.score > MIN_SIMILARITY)
    .slice(0, limit)
    .map(s => ({
      ...s.post,
      similarityScore: s.score,
      matchedChannel: channelID,
    }));
}

/**
 * Get feed based on query type
 */
export async function getFeed(query: FeedQuery): Promise<RankedPost[]> {
  const { type, channelID, limit = 50 } = query;

  switch (type) {
    case 'forYou':
      if (!channelID) return [];
      return getForYouFeed(channelID, limit);
    case 'following':
      // Requires subscriptions - return empty for now
      return [];
    case 'explore':
      return getExploreFeed(limit);
    case 'channel':
      if (!channelID) return [];
      return getChannelFeed(channelID, limit);
    default:
      return [];
  }
}

/**
 * Get list of active channel IDs
 * TODO: Implement proper channel discovery
 */
async function getActiveChannelIDs(): Promise<string[]> {
  // Placeholder - would query DHT for active channels
  return ['default'];
}
