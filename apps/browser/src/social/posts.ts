import { sign, encode, verify, decode, Config, Validators, cosineSimilarity } from '@isc/core';
import { getEmbeddingService, type EmbeddingService } from '@isc/network';
import type { SignedPost } from './types.js';
import { getPeerID, getKeypair, getPeerPublicKey, announcePublicKey } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbFilter } from '../db/helpers.js';
import { signContent, verifyContent, announceToDHT, queryFromDHT } from './signing.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.social;
const POSTS_STORE = 'posts';

// Singleton embedding service for semantic feed
let embeddingService: EmbeddingService | null = null;

function getEmbedding(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = getEmbeddingService();
  }
  return embeddingService;
}

export async function createPost(
  content: string,
  channelID: string
): Promise<SignedPost> {
  const peerID = await getPeerID();
  const keypair = getKeypair();
  Validators.keypair(keypair);

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

  await dbPut(POSTS_STORE, signedPost);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/post/${channelID}/${signedPost.id}`;
    await client.announce(key, encode(signedPost), Config.social.posts.defaultTtlSeconds);
  }

  await announcePublicKey();
  return signedPost;
}

export async function getPost(id: string): Promise<SignedPost | null> {
  return dbGet<SignedPost>(POSTS_STORE, id);
}

export async function getAllPosts(): Promise<SignedPost[]> {
  return dbGetAll<SignedPost>(POSTS_STORE);
}

export async function getPostsByChannel(channelID: string): Promise<SignedPost[]> {
  return dbFilter<SignedPost>(POSTS_STORE, (post) => post.channelID === channelID);
}

export async function getPostsByAuthor(author: string): Promise<SignedPost[]> {
  return dbFilter<SignedPost>(POSTS_STORE, (post) => post.author === author);
}

export async function verifyPost(post: SignedPost): Promise<boolean> {
  try {
    const { signature, ...postWithoutSig } = post;
    const payload = encode(postWithoutSig);

    const publicKey = await getPeerPublicKey(post.author);
    if (!publicKey) {
      logger.warn('Public key not found for post verification', { author: post.author, postId: post.id });
      return false;
    }

    return verify(payload, signature, publicKey);
  } catch (error) {
    logger.error('Post verification failed', error as Error, { postId: post.id });
    return false;
  }
}

export async function discoverPosts(channelID: string, limit: number = 50): Promise<SignedPost[]> {
  const client = DelegationClient.getInstance();
  if (!client) {
    return getPostsByChannel(channelID);
  }

  const posts = await queryFromDHT<SignedPost>(`/isc/post/${channelID}`, limit);

  for (const post of posts) {
    await dbPut(POSTS_STORE, post);
  }

  return posts;
}

/**
 * Get posts ranked by semantic similarity to channel
 */
export async function getSemanticFeed(
  channelID: string,
  queryEmbedding: number[],
  limit: number = 20
): Promise<Array<SignedPost & { similarity: number }>> {
  const posts = await discoverPosts(channelID, limit * 2);

  // Calculate similarity for each post
  const postsWithSimilarity = await Promise.all(
    posts.map(async post => {
      const similarity = await calculateContentSimilarity(post.content, queryEmbedding);
      return { ...post, similarity };
    })
  );

  // Rank by similarity and return top N
  return postsWithSimilarity
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Get trending posts in time window
 */
export async function getTrendingPosts(
  channelID: string,
  timeWindow: number = 3600000, // 1 hour
  limit: number = 10
): Promise<SignedPost[]> {
  const posts = await discoverPosts(channelID, 100);
  const now = Date.now();
  
  // Filter to recent posts
  const recentPosts = posts.filter(post => 
    post.timestamp > now - timeWindow
  );

  // Rank by engagement (likes, reposts, replies - would need to fetch these)
  // For now, just return most recent
  return recentPosts
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Simple content similarity calculation
 * Uses real transformer embeddings with cosine similarity
 */
async function calculateContentSimilarity(content: string, queryEmbedding: number[]): Promise<number> {
  try {
    const embedding = await getEmbedding().compute(content);
    return cosineSimilarity(embedding, queryEmbedding);
  } catch (err) {
    logger.warn('Similarity calculation failed, using fallback', err as Error);
    // Fallback: word-based similarity
    return fallbackSimilarity(content, queryEmbedding);
  }
}

/**
 * Fallback similarity using simple word matching
 * Used when embedding service is unavailable
 */
function fallbackSimilarity(content: string, _queryEmbedding: number[]): number {
  // Simple keyword-based relevance score
  const keywords = ['ai', 'distributed', 'consensus', 'p2p', 'social', 'chat', 'privacy', 'security'];
  const words = content.toLowerCase().match(/\w+/g) || [];
  const matches = words.filter(w => keywords.includes(w)).length;
  return Math.min(matches / 3, 1); // Normalize to 0-1 range
}

export async function deletePost(id: string): Promise<void> {
  const post = await getPost(id);
  if (post) {
    const client = DelegationClient.getInstance();
    if (client) {
      const key = `/isc/post/${post.channelID}/${id}`;
      await client.announce(key, new Uint8Array(), 0);
    }
  }
}
