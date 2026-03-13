/**
 * Similarity and Distance Algorithms
 */

import { cosineSimilarity } from '@isc/core';

/**
 * Compute similarity between embeddings
 */
export function computeSimilarity(embeddingA: number[], embeddingB: number[]): number {
  return cosineSimilarity(embeddingA, embeddingB);
}

/**
 * Check if similarity meets threshold
 */
export function meetsSimilarityThreshold(
  similarity: number,
  threshold: number
): boolean {
  return similarity >= threshold;
}

/**
 * Find similar items above threshold
 */
export function findSimilar<T extends { embedding: number[] }>(
  items: T[],
  targetEmbedding: number[],
  threshold: number
): Array<{ item: T; similarity: number }> {
  return items
    .map((item) => ({
      item,
      similarity: computeSimilarity(targetEmbedding, item.embedding),
    }))
    .filter(({ similarity }) => similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Rank items by similarity to target
 */
export function rankBySimilarity<T extends { embedding: number[] }>(
  items: T[],
  targetEmbedding: number[],
  limit?: number
): Array<{ item: T; similarity: number }> {
  const ranked = items
    .map((item) => ({
      item,
      similarity: computeSimilarity(targetEmbedding, item.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return limit ? ranked.slice(0, limit) : ranked;
}
