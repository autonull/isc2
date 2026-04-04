/* eslint-disable */
import { cosineSimilarity } from '../math/cosine.js';
import type { ChannelDistribution } from '../channels/manager.js';
import type { SignedPost } from './types.js';

export interface CoherenceResult {
  score: number;
  isCoherent: boolean;
  threshold: number;
}

export const DEFAULT_COHERENCE_THRESHOLD = 0.3;

export function checkPostCoherence(
  post: SignedPost,
  channelDistributions: ChannelDistribution[],
  threshold: number = DEFAULT_COHERENCE_THRESHOLD
): CoherenceResult {
  if (!channelDistributions || channelDistributions.length === 0) {
    return {
      score: 0,
      isCoherent: false,
      threshold,
    };
  }

  if (!post.embedding || post.embedding.length === 0) {
    return {
      score: 0,
      isCoherent: false,
      threshold,
    };
  }

  const channelEmbedding = channelDistributions[0].mu;
  const score = cosineSimilarity(channelEmbedding, post.embedding);

  return {
    score,
    isCoherent: score >= threshold,
    threshold,
  };
}

export function checkPostCoherenceMultiChannel(
  post: SignedPost,
  channels: Map<string, ChannelDistribution[]>
): { channelID: string; result: CoherenceResult }[] {
  const results: { channelID: string; result: CoherenceResult }[] = [];

  for (const [channelID, distributions] of channels.entries()) {
    const result = checkPostCoherence(post, distributions);
    results.push({ channelID, result });
  }

  return results.sort((a, b) => b.result.score - a.result.score);
}

export function getMostCoherentChannel(
  post: SignedPost,
  channels: Map<string, ChannelDistribution[]>
): { channelID: string; score: number } | null {
  const results = checkPostCoherenceMultiChannel(post, channels);
  
  if (results.length === 0 || results[0].result.score <= 0) {
    return null;
  }

  return {
    channelID: results[0].channelID,
    score: results[0].result.score,
  };
}

export function filterCoherentPosts(
  posts: SignedPost[],
  channelDistributions: ChannelDistribution[],
  threshold: number = DEFAULT_COHERENCE_THRESHOLD
): SignedPost[] {
  return posts.filter(post => {
    const result = checkPostCoherence(post, channelDistributions, threshold);
    return result.isCoherent;
  });
}

export function rankByCoherence(
  posts: SignedPost[],
  channelDistributions: ChannelDistribution[]
): { post: SignedPost; coherenceScore: number }[] {
  return posts
    .map(post => ({
      post,
      coherenceScore: checkPostCoherence(post, channelDistributions).score,
    }))
    .sort((a, b) => b.coherenceScore - a.coherenceScore);
}
