/**
 * Post Service
 * 
 * Handles post creation, signing, and DHT announcement.
 * References: SOCIAL.md#posts--feeds
 */

import { generateUUID } from '@isc/core/encoding';
import { sign, encode } from '@isc/core/crypto';
import { lshHash } from '@isc/core/math';
import type { SignedPost, PostPayload } from './types';
import { getPeerID, getKeypair } from '../identity';
import { loadEmbeddingModel } from '../identity/embedding';

/** Default TTL for posts (24 hours) */
const DEFAULT_POST_TTL = 86400;

/** Embedding model hash for DHT key namespace */
const MODEL_HASH = 'default-384';

/**
 * Create and sign a new post
 */
export async function createPost(
  content: string,
  channelID: string
): Promise<SignedPost> {
  const model = await loadEmbeddingModel();
  const embedding = await model.embed(content);

  const payload: PostPayload = {
    type: 'post',
    postID: generateUUID(),
    author: await getPeerID(),
    content,
    channelID,
    embedding,
    timestamp: Date.now(),
    ttl: DEFAULT_POST_TTL,
  };

  const keypair = await getKeypair();
  const signature = await sign(encode(payload), keypair.privateKey);

  return { ...payload, signature };
}

/**
 * Announce a post to the DHT via supernode delegation
 */
export async function announcePost(post: SignedPost): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();

  const hashes = lshHash(post.embedding, MODEL_HASH, 3);
  const encoded = encode(post);
  
  for (const hash of hashes) {
    const key = `/isc/post/${MODEL_HASH}/${hash}`;
    await client.announce(key, encoded, post.ttl);
  }

  const authorKey = `/isc/posts/author/${post.author}`;
  await client.announce(authorKey, encoded, post.ttl);
}

/**
 * Query posts by embedding proximity
 */
export async function queryPostsByEmbedding(
  embedding: number[],
  limit: number = 50
): Promise<SignedPost[]> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();

  const hashes = lshHash(embedding, MODEL_HASH, 3);
  const seen = new Set<string>();
  const results: SignedPost[] = [];

  for (const hash of hashes) {
    const key = `/isc/post/${MODEL_HASH}/${hash}`;
    const encodedPosts = await client.query(key, Math.floor(limit / hashes.length));
    
    for (const encoded of encodedPosts) {
      if (!seen.has(encoded)) {
        seen.add(encoded);
        results.push(decode(encoded) as SignedPost);
      }
    }
  }

  return results.slice(0, limit);
}

/**
 * Get posts by author
 */
export async function getPostsByAuthor(
  authorID: string,
  limit: number = 50
): Promise<SignedPost[]> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();

  const key = `/isc/posts/author/${authorID}`;
  const encodedPosts = await client.query(key, limit);
  return encodedPosts.map(decode).slice(0, limit);
}

/**
 * Verify post signature
 */
export async function verifyPost(post: SignedPost): Promise<boolean> {
  try {
    const { verify } = await import('@isc/core/crypto');
    const payload: PostPayload = {
      type: post.type,
      postID: post.postID,
      author: post.author,
      content: post.content,
      channelID: post.channelID,
      embedding: post.embedding,
      timestamp: post.timestamp,
      ttl: post.ttl,
    };
    return verify(encode(payload), post.signature, post.author);
  } catch {
    return false;
  }
}

/**
 * Check if post is still valid (not expired)
 */
export function isPostValid(post: SignedPost): boolean {
  return Date.now() < post.timestamp + post.ttl * 1000;
}

function encode(data: SignedPost | PostPayload): string {
  return JSON.stringify(data);
}

function decode(data: string): SignedPost | PostPayload {
  return JSON.parse(data);
}
