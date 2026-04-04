/* eslint-disable */
/**
 * Social Scoring Utilities
 *
 * Shared utilities for computing engagement scores and relevance.
 */

export interface EngagementMetrics {
  likes?: number;
  reposts?: number;
  replies?: number;
  quotes?: number;
}

/**
 * Compute engagement score from metrics
 * Weights: likes=1, reposts=2, replies=3, quotes=2.5
 */
export function computeEngagementScore(metrics: EngagementMetrics): number {
  const likes = metrics.likes ?? 0;
  const reposts = metrics.reposts ?? 0;
  const replies = metrics.replies ?? 0;
  const quotes = metrics.quotes ?? 0;

  return likes + reposts * 2 + replies * 3 + quotes * 2.5;
}

/**
 * Compute content relevance score based on keyword matching
 */
export function computeContentRelevance(content: string, keywords: string[]): number {
  const contentLower = content.toLowerCase();
  const words = contentLower.match(/\w+/g) ?? [];
  const wordSet = new Set(words);

  const matches = keywords.filter(k => wordSet.has(k.toLowerCase())).length;
  return Math.min(matches / Math.max(keywords.length, 1), 1);
}
