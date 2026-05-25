/* eslint-disable */
/**
 * Post Service
 *
 * Post/message management operations with optimistic updates.
 * Broadcasts posts to DHT network and fetches from network on demand.
 */

import { networkService } from './network.ts';
import { logger } from '../utils/logger.ts';
import { actions, getState } from '../state.js';
const LIKED_POSTS_KEY = 'isc:liked-posts';

function getLikedPosts() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_POSTS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveLikedPosts(liked) {
  localStorage.setItem(LIKED_POSTS_KEY, JSON.stringify([...liked]));
}

export const postService = {
  async create(channelId, content) {
    const { ensureIdentityInitialized } = await import('../identity/index.ts');
    try {
      await ensureIdentityInitialized();
    } catch (e) {
      logger.warn('Identity not fully initialized, proceeding with defaults:', e.message);
    }
    const identity = networkService.getIdentity();
    const peerId = identity?.peerId ?? identity?.pubkey ?? 'unknown';

    const optimisticPost = {
      id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channelId,
      content,
      author: identity?.name ?? 'Anonymous',
      identity: { peerId, name: identity?.name ?? 'Anonymous' },
      timestamp: Date.now(),
      likes: [],
      replies: [],
      optimistic: true,
      pending: true,
    };

    try {
      let posts = getState('posts') ?? [];
      if (!Array.isArray(posts)) posts = Array.from(Object.values(posts));
      posts.unshift(optimisticPost);
      actions.setPosts(posts);
    } catch {
      // Ignore state update errors
    }

    try {
      const post = await networkService.createPost(channelId, content);

      // Broadcast to DHT network via social layer adapter
      try {
        const { getKeypair } = await import('../identity/index.ts');
        const keypair = getKeypair();
        let signature = new Uint8Array();
        if (keypair) {
          const postForSigning = {
            id: post.id,
            author: peerId,
            content: post.content ?? content,
            channelID: channelId,
            timestamp: post.timestamp ?? Date.now(),
            likes: [],
            replies: [],
          };
          const payload = new TextEncoder().encode(JSON.stringify(postForSigning));
          const { sign } = await import('@isc/core');
          const sig = await sign(payload, keypair.privateKey);
          signature = sig.data;
        }

        const signedPost = {
          id: post.id,
          author: peerId,
          content: post.content ?? content,
          channelID: channelId,
          timestamp: post.timestamp ?? Date.now(),
          likes: [],
          replies: [],
          signature,
        };
        const mod = await import('../social/adapters/network.ts');
        if (mod.browserNetworkAdapter && mod.browserNetworkAdapter.broadcastPost) {
           await mod.browserNetworkAdapter.broadcastPost(signedPost);
        } else if (mod.default && mod.default.broadcastPost) {
           await mod.default.broadcastPost(signedPost);
        }
      } catch (broadcastErr) {
        logger.warn('Post broadcast failed, post still created locally', {
          error: broadcastErr.message,
        });
      }

      let posts = getState('posts') ?? [];
      if (!Array.isArray(posts)) posts = Array.from(Object.values(posts));
      const idx = posts.findIndex(p => p.id === optimisticPost.id);
      if (idx >= 0) {
        posts[idx] = { ...post, optimistic: false, pending: false };
        actions.setPosts(posts);
      }
      logger.debug('Post created', { id: post.id, channelId });
      return post;
    } catch (err) {
      logger.error('Post creation failed, rolling back', { error: err.message });
      let posts = getState('posts') ?? [];
      if (!Array.isArray(posts)) posts = Array.from(Object.values(posts));
      const filtered = posts.filter(p => p.id !== optimisticPost.id);
      actions.setPosts(filtered);
      throw err;
    }
  },

  getByChannel(channelId) {
    return networkService.getPosts(channelId);
  },

  async discoverFromNetwork(channelId, limit = 50) {
    try {
      const { browserNetworkAdapter } = await import('../social/adapters/network.ts');
      const posts = await browserNetworkAdapter.requestPosts(channelId);
      // Merge into ClientNetworkService's local cache (where feedService reads from)
      const netPosts = networkService.getPosts(channelId);
      const existingIds = new Set(netPosts.map(p => p.id));
      const newPosts = posts
        .filter(p => !existingIds.has(p.id))
        .map(p => ({
          id: p.id,
          channelId: p.channelID,
          content: p.content,
          author: p.author,
          authorId: p.author,
          createdAt: p.timestamp,
          timestamp: p.timestamp,
          likes: p.likes || [],
          replies: p.replies || [],
        }))
        .slice(0, limit);

      if (newPosts.length > 0) {
        // Also store in app state for cross-channel feeds
        const existingState = getState('posts') ?? [];
        const stateIds = new Set(existingState.map(p => p.id));
        const forState = posts.filter(p => !stateIds.has(p.id)).slice(0, limit);
        if (forState.length > 0) {
          actions.setPosts([...forState, ...existingState]);
        }

        logger.info('Discovered posts from network', { channelId, count: newPosts.length });
      }
      return newPosts;
    } catch (err) {
      logger.debug('Post discovery failed', { error: err.message, channelId });
      return [];
    }
  },

  getAll() {
    return networkService.getPosts();
  },

  getById(postId) {
    return this.getAll().find(p => p.id === postId);
  },

  async like(postId) {
    try {
      if (!networkService.service?.likePost) {
        const liked = getLikedPosts();
        liked.add(postId);
        saveLikedPosts(liked);
        return;
      }
      await networkService.service.likePost(postId);
      logger.debug('Post liked', { postId });
    } catch (err) {
      logger.error('Like failed', { error: err.message });
    }
  },

  getLikedPosts,

  toggleLike(postId, isLiked) {
    const liked = getLikedPosts();
    if (isLiked) {
      liked.add(postId);
    } else {
      liked.delete(postId);
    }
    saveLikedPosts(liked);
  },

  isPostLiked(postId) {
    return getLikedPosts().has(postId);
  },

  async repost(channelId, originalId) {
    const post = await this.create(channelId, `[Repost of ${originalId}]`);
    post.repostedFrom = originalId;
    return post;
  },

  async reply(channelId, postId, content) {
    try {
      const reply = await networkService.service?.replyToPost?.(postId, content) || { replyTo: postId };
      logger.debug('Reply created', { postId, replyId: reply?.id });
      return reply;
    } catch (err) {
      logger.error('Reply failed', { error: err.message });
      throw err;
    }
  },

  async delete(postId) {
    try {
      // Remove from local state immediately
      const posts = getState('posts') ?? [];
      const filtered = Array.isArray(posts) ? posts.filter((p) => p.id !== postId) : Array.from(Object.values(posts)).filter((p) => p.id !== postId);
      actions.setPosts(filtered);

      // Also remove from liked posts if present
      const liked = getLikedPosts();
      liked.delete(postId);
      saveLikedPosts(liked);

      // Propagate deletion via social layer (handles local + network)
      const { deletePost } = await import('../social/posts.ts');
      await deletePost(postId);

      logger.info('Post deleted', { postId });
    } catch (err) {
      logger.error('Post deletion failed', { error: err.message });
      throw err;
    }
  },
};
