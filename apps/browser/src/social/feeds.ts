import type { SignedPost } from './types.js';
import { getAllPosts, getPostsByChannel } from './posts.js';
import { getFollowees } from './graph.js';
import { cosineSimilarity } from '@isc/core';
import { getActiveChannel } from '../channels/manager.js';

/**
 * Get "For You" feed ranked by semantic similarity to active channel
 */
export async function getForYouFeed(limit: number = 50): Promise<SignedPost[]> {
  const allPosts = await getAllPosts();
  const activeChannel = await getActiveChannel();
  
  if (!activeChannel || !activeChannel.distributions || activeChannel.distributions.length === 0) {
    // Fallback to chronological if no active channel
    const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
    return sorted.slice(0, limit);
  }
  
  // Rank posts by semantic similarity to active channel
  const scoredPosts = allPosts.map(post => {
    // Simple scoring: boost posts from same channel, then by recency
    let score = 0;
    
    // Channel match boost
    if (post.channelID === activeChannel.id) {
      score += 10;
    }
    
    // Recency decay (posts lose 1 point per hour)
    const ageHours = (Date.now() - post.timestamp) / (1000 * 60 * 60);
    score += Math.max(0, 5 - ageHours);
    
    return { post, score };
  });
  
  // Sort by score descending
  const sorted = scoredPosts
    .sort((a, b) => b.score - a.score)
    .map(({ post }) => post);
  
  return sorted.slice(0, limit);
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
  console.log('[Feeds] Refreshing feed...', channelID ? `channel: ${channelID}` : 'all channels');
}
