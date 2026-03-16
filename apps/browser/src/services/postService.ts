/**
 * Post Service
 *
 * Business logic layer for post operations.
 * All posts MUST be signed - unsigned posts are rejected.
 */

import type { Post } from '../types/extended.js';
import { getDB } from '../db/factory.js';
import { getIdentity, ensureIdentityInitialized } from '../identity/index.js';
import { encode, sign, computeEngagementScore } from '@isc/core';
import { formatRelativeTime as formatPostTimestamp } from '@isc/core';
import { loggers } from '../utils/logger.js';

const logger = loggers.social;
const DB_NAME = 'isc-posts';
const DB_VERSION = 1;
const POST_STORE = 'posts';

export interface CreatePostInput {
  content: string;
  channelId: string;
}

export interface PostService {
  createPost(input: CreatePostInput): Promise<Post>;
  getPost(id: string): Promise<Post | null>;
  getAllPosts(channelId?: string): Promise<Post[]>;
  getPostsByChannel(channelId: string): Promise<Post[]>;
  getPostsByAuthor(author: string): Promise<Post[]>;
  deletePost(id: string): Promise<void>;
  likePost(postId: string): Promise<void>;
  repostPost(postId: string): Promise<void>;
  replyToPost(postId: string, content: string): Promise<Post>;
}

/**
 * Error thrown when identity is required but not available
 */
export class IdentityRequiredError extends Error {
  constructor(message: string = 'Identity required for this operation') {
    super(message);
    this.name = 'IdentityRequiredError';
  }
}

async function getDBInstance(): Promise<IDBDatabase> {
  return getDB(DB_NAME, DB_VERSION, [POST_STORE]);
}

async function storePost(post: Post): Promise<void> {
  const db = await getDBInstance();
  const tx = db.transaction(POST_STORE, 'readwrite');
  const store = tx.objectStore(POST_STORE);
  return new Promise<void>((resolve, reject) => {
    const request = store.put(post, post.id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getAllPostsFromDB(): Promise<Post[]> {
  const db = await getDBInstance();
  const tx = db.transaction(POST_STORE, 'readonly');
  const store = tx.objectStore(POST_STORE);
  return new Promise<Post[]>((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sign post content with user's keypair
 */
async function signPost(post: Omit<Post, 'signature'>): Promise<Uint8Array> {
  const identity = getIdentity();
  
  if (!identity.keypair) {
    throw new IdentityRequiredError('Cannot sign post: identity not initialized. Please complete onboarding.');
  }

  const encoded = encode(post);
  const signature = await sign(encoded, identity.keypair.privateKey);
  return signature;
}

export function createPostService(): PostService {
  return {
    async createPost(input: CreatePostInput): Promise<Post> {
      // Validate input
      if (!input.content || input.content.trim().length < 1) {
        throw new Error('Post content cannot be empty');
      }

      if (input.content.length > 500) {
        throw new Error('Post content must be less than 500 characters');
      }

      // Ensure identity is initialized BEFORE creating post
      try {
        await ensureIdentityInitialized();
      } catch (err) {
        logger.error('Identity not available for post creation', err as Error);
        throw new IdentityRequiredError('Please complete onboarding to create posts');
      }

      const identity = getIdentity();
      if (!identity.keypair) {
        throw new IdentityRequiredError('Identity not initialized');
      }

      // Create post object (without signature)
      const postWithoutSig: Omit<Post, 'signature'> = {
        id: crypto.randomUUID(),
        author: identity.publicKeyFingerprint || 'anonymous',
        content: input.content.trim(),
        channelID: input.channelId,
        timestamp: Date.now(),
      };

      // Sign the post
      let signature: Uint8Array;
      try {
        signature = await signPost(postWithoutSig);
      } catch (err) {
        logger.error('Failed to sign post', err as Error);
        throw new IdentityRequiredError('Failed to sign post: ' + (err as Error).message);
      }

      // Create signed post
      const post: Post = {
        ...postWithoutSig,
        signature,
      };

      // Store locally
      await storePost(post);
      logger.info('Post created and signed', { postId: post.id, author: post.author });

      return post;
    },

    async getPost(id: string): Promise<Post | null> {
      const db = await getDBInstance();
      const tx = db.transaction(POST_STORE, 'readonly');
      const store = tx.objectStore(POST_STORE);
      return new Promise<Post | null>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    },

    async getAllPosts(channelId?: string): Promise<Post[]> {
      let posts = await getAllPostsFromDB();

      // Filter by channel if specified
      if (channelId) {
        posts = posts.filter(p => p.channelID === channelId);
      }

      // Sort by timestamp (newest first)
      return posts.sort((a, b) => b.timestamp - a.timestamp);
    },

    async getPostsByChannel(channelId: string): Promise<Post[]> {
      return this.getAllPosts(channelId);
    },

    async getPostsByAuthor(author: string): Promise<Post[]> {
      const posts = await getAllPostsFromDB();
      return posts.filter(p => p.author === author)
        .sort((a, b) => b.timestamp - a.timestamp);
    },

    async deletePost(id: string): Promise<void> {
      const db = await getDBInstance();
      const tx = db.transaction(POST_STORE, 'readwrite');
      const store = tx.objectStore(POST_STORE);
      return new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    async likePost(postId: string): Promise<void> {
      const post = await this.getPost(postId);
      if (!post) throw new Error('Post not found');

      // Update like count
      const updated = {
        ...post,
        likeCount: (post.likeCount || 0) + 1,
      };
      await storePost(updated);
    },

    async repostPost(postId: string): Promise<void> {
      const post = await this.getPost(postId);
      if (!post) throw new Error('Post not found');

      // Create a repost (requires identity)
      const repost = await this.createPost({
        content: post.content,
        channelId: post.channelID,
      });
      (repost as any).repostedFrom = postId;
    },

    async replyToPost(postId: string, content: string): Promise<Post> {
      const parentPost = await this.getPost(postId);
      if (!parentPost) throw new Error('Parent post not found');

      // Create reply post (requires identity)
      const reply = await this.createPost({
        content,
        channelId: parentPost.channelID,
      });

      // Mark as reply
      (reply as any).replyTo = postId;
      await storePost(reply);

      return reply;
    },
  };
}

/**
 * Validate post input
 */
export function validatePostInput(input: CreatePostInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.content || input.content.trim().length < 1) {
    errors.push('Post content cannot be empty');
  }

  if (input.content.length > 500) {
    errors.push('Post content must be less than 500 characters');
  }

  if (!input.channelId) {
    errors.push('Channel ID is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Note: computeEngagementScore and formatPostTimestamp are imported from @isc/core