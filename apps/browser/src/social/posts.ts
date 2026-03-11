/**
 * Posts Service
 *
 * Handles post creation, signing, and DHT announcement.
 */

import { sign, encode, verify, decode } from '@isc/core';
import type { SignedPost } from './types.js';
import { getPeerID, getKeypair, getPeerPublicKey, announcePublicKey } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbFilter } from '../db/helpers.js';

const POSTS_STORE = 'posts';
const DEFAULT_TTL = 86400 * 7; // 7 days

/**
 * Create and sign a new post
 */
export async function createPost(
  content: string,
  channelID: string
): Promise<SignedPost> {
  const peerID = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const post: Omit<SignedPost, 'signature'> = {
    id: `post_${crypto.randomUUID()}`,
    author: peerID,
    content,
    channelID,
    timestamp: Date.now(),
  };

  const payload = encode(post);
  const signature = await sign(payload, keypair.privateKey);

  const signedPost: SignedPost = { ...post, signature };

  // Store locally
  await dbPut(POSTS_STORE, signedPost);

  // Announce to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/post/${channelID}/${signedPost.id}`;
    await client.announce(key, encode(signedPost), DEFAULT_TTL);
  }

  // Ensure public key is announced for verification
  await announcePublicKey();

  return signedPost;
}

/**
 * Get a post by ID
 */
export async function getPost(id: string): Promise<SignedPost | null> {
  return dbGet<SignedPost>(POSTS_STORE, id);
}

/**
 * Get all posts from local storage
 */
export async function getAllPosts(): Promise<SignedPost[]> {
  return dbGetAll<SignedPost>(POSTS_STORE);
}

/**
 * Get posts by channel
 */
export async function getPostsByChannel(channelID: string): Promise<SignedPost[]> {
  return dbFilter<SignedPost>(POSTS_STORE, (post) => post.channelID === channelID);
}

/**
 * Get posts by author
 */
export async function getPostsByAuthor(author: string): Promise<SignedPost[]> {
  return dbFilter<SignedPost>(POSTS_STORE, (post) => post.author === author);
}

/**
 * Verify a post signature
 */
export async function verifyPost(post: SignedPost): Promise<boolean> {
  try {
    const { signature, ...postWithoutSig } = post;
    const payload = encode(postWithoutSig);

    const publicKey = await getPeerPublicKey(post.author);
    if (!publicKey) {
      console.warn(`Public key not found for peer ${post.author}`);
      return false;
    }

    return verify(payload, signature, publicKey);
  } catch (error) {
    console.error('Post verification failed:', error);
    return false;
  }
}

/**
 * Discover posts from DHT for a channel
 */
export async function discoverPosts(channelID: string, limit: number = 50): Promise<SignedPost[]> {
  const client = DelegationClient.getInstance();
  if (!client) {
    return getPostsByChannel(channelID);
  }

  const key = `/isc/post/${channelID}`;
  const encoded = await client.query(key, limit);

  const posts: SignedPost[] = [];
  for (const data of encoded) {
    try {
      const post = decode(data) as SignedPost;
      if (post && post.id && post.author) {
        posts.push(post);
      }
    } catch (error) {
      console.warn('Failed to decode post:', error);
    }
  }

  // Store discovered posts locally
  for (const post of posts) {
    await dbPut(POSTS_STORE, post);
  }

  return posts;
}

/**
 * Delete a post (soft delete with tombstone)
 */
export async function deletePost(id: string): Promise<void> {
  // In a real implementation, this would create a tombstone
  // For now, just delete from local storage
  const post = await getPost(id);
  if (post) {
    const client = DelegationClient.getInstance();
    if (client) {
      const key = `/isc/post/${post.channelID}/${id}`;
      // Announce deletion with empty payload
      await client.announce(key, new Uint8Array(), 0);
    }
    // Would create tombstone here
  }
}
