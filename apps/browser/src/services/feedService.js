/* eslint-disable */
/**
 * Feed Service
 *
 * Feed generation and management with scoring algorithms.
 */

import { networkService } from './network.ts';
import { postService } from './postService.js';
import { channelService } from './channelService.js';
import { getEmbeddingService } from '@isc/network';
import { logger } from '../logger.js';
import { getState } from '../state.js';

const HOURS_24 = 86400000;

function calculatePostScore(post, matches) {
  const postTime = post.createdAt ?? post.timestamp ?? Date.now();
  const age = Date.now() - postTime;
  const recencyBoost = Math.max(0.1, 1 - age / HOURS_24);

  let score = recencyBoost;

  if (matches?.length) {
    const avgSimilarity = matches.reduce((sum, m) => sum + (m.similarity || 0), 0) / matches.length;
    score *= 1 + avgSimilarity;
  }

  score *= 1 + (post.likes?.length || 0) * 0.1;
  score *= 1 + (post.replies?.length || 0) * 0.05;

  return score;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : Math.max(0, dot / denom);
}

export const feedService = {
  getForYou(limit = 50) {
    const allPosts = networkService.getPosts();
    const { matches } = getState();

    const scored = allPosts.map(post => ({
      ...post,
      timestamp: post.timestamp ?? post.createdAt,
      score: calculatePostScore(post, matches),
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  },

  getByChannel(channelId, limit = 50) {
    return postService.getByChannel(channelId).slice(-limit);
  },

  async computeChannelPostScores(channelId) {
    const posts = this.getByChannel(channelId);
    const { channels } = getState();
    const channel = channels?.find(c => c.id === channelId);

    if (!channel || !posts.length) return {};

    const scores = {};
    for (const post of posts) {
      const similarityScore = await this._computePostChannelSimilarity(post, channel);
      scores[post.id] = { similarityScore, matchedChannelName: channel.name };
    }
    return scores;
  },

  async _computePostChannelSimilarity(post, channel) {
    try {
      const embeddingService = getEmbeddingService?.();
      if (!embeddingService || !embeddingService.isLoaded()) return null;

      const postEmbedding = await embeddingService.compute(post.content || '');
      const channelText = `${channel.name} ${channel.description || ''}`;
      const channelEmbedding = await embeddingService.compute(channelText);

      return cosineSimilarity(postEmbedding, channelEmbedding);
    } catch (err) {
      logger.warn('Failed to compute similarity score', { error: err.message });
      return null;
    }
  },

  getFollowing(limit = 50) {
    return postService.getAll().slice(-limit);
  },
};
