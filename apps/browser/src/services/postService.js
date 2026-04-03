/**
 * Post Service
 *
 * Post/message management operations with optimistic updates.
 */

import { networkService } from './network.ts';
import { logger } from '../logger.js';
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
      const posts = getState().posts ?? [];
      posts.unshift(optimisticPost);
      actions.setPosts(posts);
    } catch {
      // Ignore state update errors
    }

    try {
      const post = await networkService.createPost(channelId, content);
      const posts = getState().posts ?? [];
      const idx = posts.findIndex(p => p.id === optimisticPost.id);
      if (idx >= 0) {
        posts[idx] = { ...post, optimistic: false, pending: false };
        actions.setPosts(posts);
      }
      logger.debug('Post created', { id: post.id, channelId });
      return post;
    } catch (err) {
      logger.error('Post creation failed, rolling back', { error: err.message });
      const posts = getState().posts ?? [];
      const filtered = posts.filter(p => p.id !== optimisticPost.id);
      actions.setPosts(filtered);
      throw err;
    }
  },

  getByChannel(channelId) {
    return networkService.getPosts(channelId);
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

  async reply(postId, content) {
    try {
      const reply = await networkService.service?.replyToPost?.(postId, content);
      logger.debug('Reply created', { postId, replyId: reply?.id });
      return reply;
    } catch (err) {
      logger.error('Reply failed', { error: err.message });
      throw err;
    }
  },

  async delete(postId) {
    try {
      if (!networkService.service?.deletePost) {
        logger.warn('postService.delete: deletePost not implemented in network layer');
        return;
      }
      await networkService.service.deletePost(postId);
      logger.info('Post deleted', { postId });
    } catch (err) {
      logger.error('Post deletion failed', { error: err.message });
      throw err;
    }
  },
};
