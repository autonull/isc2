/**
 * Post Service
 * 
 * Business logic layer for post operations.
 * Handles creation, signing, storage, and retrieval of posts.
 */

import type { Post } from '../types/extended.js';
import { getDB } from '../db/factory.js';
import { getIdentity } from '../identity/index.js';
import { encode } from '@isc/core';

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

async function getDBInstance(): Promise<IDBDatabase> {
  return getDB(DB_NAME, DB_VERSION, [POST_STORE]);
}

async function storePost(post: Post): Promise<void> {
  const db = await getDBInstance();
  const tx = db.transaction(POST_STORE, 'readwrite');
  const store = tx.objectStore(POST_STORE);
  await new Promise<void>((resolve, reject) => {
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

      const identity = getIdentity();
      if (!identity.keypair) {
        // For demo purposes, create unsigned post
        const post: Post = {
          id: crypto.randomUUID(),
          author: 'anonymous',
          content: input.content.trim(),
          channelID: input.channelId,
          timestamp: Date.now(),
          signature: new Uint8Array(0),
        };
        await storePost(post);
        return post;
      }

      // Create post object
      const post: Post = {
        id: crypto.randomUUID(),
        author: identity.publicKeyFingerprint || 'anonymous',
        content: input.content.trim(),
        channelID: input.channelId,
        timestamp: Date.now(),
        signature: new Uint8Array(0),
      };

      // Sign the post (simplified - full implementation would use crypto)
      try {
        const encoded = encode(post);
        // Signature handling simplified for demo
        post.signature = new Uint8Array(0);
      } catch (e) {
        console.warn('Signing failed, using empty signature:', e);
      }

      // Store locally
      await storePost(post);

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

      // Create a repost
      const repost: Post = {
        id: crypto.randomUUID(),
        author: post.author,
        content: post.content,
        channelID: post.channelID,
        timestamp: Date.now(),
        signature: new Uint8Array(0),
      };
      (repost as any).repostedFrom = postId;
      await storePost(repost);
    },

    async replyToPost(postId: string, content: string): Promise<Post> {
      const parentPost = await this.getPost(postId);
      if (!parentPost) throw new Error('Parent post not found');

      // Create reply post
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

/**
 * Compute engagement score for a post
 */
export function computeEngagementScore(post: Post): number {
  const likes = (post as any).likeCount || 0;
  const reposts = (post as any).repostCount || 0;
  const replies = (post as any).replyCount || 0;
  
  // Weighted score
  return likes + (reposts * 2) + (replies * 3);
}

/**
 * Format timestamp for display
 */
export function formatPostTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString();
}
