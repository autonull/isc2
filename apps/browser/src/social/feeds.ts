/**
 * Feeds Service
 * 
 * Handles feed generation: For You, Following, Explore.
 */

import type { SignedPost } from './types.js';
import { getAllPosts, getPostsByChannel } from './posts.js';
import { getFollowees } from './graph.js';
import { getChannel } from '../channels/manager.js';

/**
 * Get "For You" feed - posts from channels user is in
 */
export async function getForYouFeed(limit: number = 50): Promise<SignedPost[]> {
  const allPosts = await getAllPosts();
  
  // Sort by timestamp (newest first)
  const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
  
  return sorted.slice(0, limit);
}

/**
 * Get "Following" feed - posts from followed users
 */
export async function getFollowingFeed(limit: number = 50): Promise<SignedPost[]> {
  const followees = await getFollowees();
  const allPosts = await getAllPosts();
  
  // Filter to posts from followees
  const followingPosts = allPosts.filter((post) =>
    followees.includes(post.author)
  );
  
  // Sort by timestamp (newest first)
  const sorted = followingPosts.sort((a, b) => b.timestamp - a.timestamp);
  
  return sorted.slice(0, limit);
}

/**
 * Get "Explore" feed - posts from all channels, ranked by engagement
 * Note: Simple implementation without real engagement metrics
 */
export async function getExploreFeed(limit: number = 50): Promise<SignedPost[]> {
  const allPosts = await getAllPosts();
  
  // Sort by timestamp (newest first) - would use engagement ranking in real implementation
  const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
  
  return sorted.slice(0, limit);
}

/**
 * Get channel feed - posts from a specific channel
 */
export async function getChannelFeed(channelID: string, limit: number = 50): Promise<SignedPost[]> {
  const posts = await getPostsByChannel(channelID);
  
  // Sort by timestamp (newest first)
  const sorted = posts.sort((a, b) => b.timestamp - a.timestamp);
  
  return sorted.slice(0, limit);
}

/**
 * Refresh feed by fetching new posts from DHT
 * Note: Placeholder for DHT integration
 */
export async function refreshFeed(channelID?: string): Promise<void> {
  // Would query DHT for new posts here
  console.log('[Feeds] Refreshing feed...', channelID ? `channel: ${channelID}` : 'all channels');
}
