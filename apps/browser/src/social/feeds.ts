import type { SignedPost } from './types.js';
import { getAllPosts, getPostsByChannel } from './posts.js';
import { getFollowees } from './graph.js';

export async function getForYouFeed(limit: number = 50): Promise<SignedPost[]> {
  const allPosts = await getAllPosts();
  const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

export async function getFollowingFeed(limit: number = 50): Promise<SignedPost[]> {
  const followees = await getFollowees();
  const allPosts = await getAllPosts();
  const followingPosts = allPosts.filter((post) => followees.includes(post.author));
  const sorted = followingPosts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

export async function getExploreFeed(limit: number = 50): Promise<SignedPost[]> {
  const allPosts = await getAllPosts();
  const sorted = allPosts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

export async function getChannelFeed(channelID: string, limit: number = 50): Promise<SignedPost[]> {
  const posts = await getPostsByChannel(channelID);
  const sorted = posts.sort((a, b) => b.timestamp - a.timestamp);
  return sorted.slice(0, limit);
}

export async function refreshFeed(channelID?: string): Promise<void> {
  console.log('[Feeds] Refreshing feed...', channelID ? `channel: ${channelID}` : 'all channels');
}
