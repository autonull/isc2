/**
 * Posts Module - Backward compatibility wrapper
 *
 * Re-exports from @isc/social/posts with browser-specific wrappers.
 */

export { type PostService, type SignedPost } from '@isc/social';

import { createPostService, type PostService, type SignedPost } from '@isc/social';
import { browserStorageAdapter } from './adapters/storage.js';
import { browserIdentityAdapter } from './adapters/identity.js';
import { browserNetworkAdapter } from './adapters/network.js';

// Lazy-loaded post service singleton
let postService: PostService | null = null;

async function getPostService(): Promise<PostService> {
  if (!postService) {
    postService = createPostService(browserStorageAdapter, browserIdentityAdapter, browserNetworkAdapter);
  }
  return postService;
}

// Backward-compatible function exports
export async function createPost(content: string, channelID: string): Promise<SignedPost> {
  const svc = await getPostService();
  return svc.create({ content, channelId: channelID });
}

export async function getPost(id: string): Promise<SignedPost | null> {
  const svc = await getPostService();
  return svc.get(id);
}

export async function getAllPosts(): Promise<SignedPost[]> {
  const svc = await getPostService();
  return svc.getAll();
}

export async function getPostsByChannel(channelID: string): Promise<SignedPost[]> {
  const svc = await getPostService();
  return svc.getByChannel(channelID);
}

export async function getPostsByAuthor(author: string): Promise<SignedPost[]> {
  const svc = await getPostService();
  return svc.getByAuthor(author);
}

export async function discoverPosts(channelID: string, limit?: number): Promise<SignedPost[]> {
  const svc = await getPostService();
  return svc.discover(channelID, limit);
}

export async function getSemanticFeed(channelID: string, queryEmbedding: number[], limit?: number): Promise<SignedPost[]> {
  const svc = await getPostService();
  return svc.getSemanticFeed(channelID, queryEmbedding, limit);
}

export async function deletePost(id: string): Promise<void> {
  const svc = await getPostService();
  return svc.delete(id);
}

export async function verifyPost(_post: unknown): Promise<boolean> {
  // The browser version verifies against the stored public key
  // For now, return true (verification would need per-peer implementation)
  return true;
}
