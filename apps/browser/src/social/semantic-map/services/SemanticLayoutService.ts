/* eslint-disable */
/**
 * Semantic Layout Service
 *
 * Handles layout calculations for semantic maps.
 */

import type { Channel } from '@isc/core/types';
import type { Point2D } from '../types/semanticMap.ts';
import { SEMANTIC_MAP_CONFIG } from '../config/semanticConfig.ts';
import { forceDirectedLayout } from '../algorithms/layout.ts';
import { distance } from '../utils/vectorMath.ts';

/**
 * Compute 2D positions for channels
 */
export async function computeChannelPositions(
  channels: Channel[]
): Promise<Point2D[]> {
  if (channels.length === 0) return [];

  // Initialize with positions on unit circle
  const positions: Point2D[] = channels.map((channel, i) => ({
    x: Math.cos((i * 2 * Math.PI) / channels.length),
    y: Math.sin((i * 2 * Math.PI) / channels.length),
    data: { embedding: channel.distributions?.[0]?.mu ?? [] },
  }));

  // Run force-directed layout
  return forceDirectedLayout(positions, SEMANTIC_MAP_CONFIG.layoutIterations);
}

/**
 * Find semantic neighbors in 2D space
 */
export function findNeighbors(
  point: Point2D,
  allPoints: Point2D[],
  radius: number = SEMANTIC_MAP_CONFIG.neighborRadius
): Point2D[] {
  return allPoints.filter((p) => {
    if (p === point) return false;
    return distance(p, point) < radius;
  });
}

/**
 * Project high-dimensional embedding to 2D
 */
export function projectTo2D(
  embedding: number[],
  referencePoints: Point2D[]
): Point2D {
  if (referencePoints.length === 0) {
    return { x: 0, y: 0, data: null };
  }

  const similarities = referencePoints.map((p) => {
    const pointData = p.data as { embedding: number[] };
    return computeCosineSimilarity(embedding, pointData.embedding);
  });

  // Barycentric-like projection
  let x = 0;
  let y = 0;
  let totalWeight = 0;

  for (let i = 0; i < referencePoints.length; i++) {
    const weight = Math.max(similarities[i], 0);
    x += referencePoints[i].x * weight;
    y += referencePoints[i].y * weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    x /= totalWeight;
    y /= totalWeight;
  }

  return { x, y, data: { embedding } };
}

/**
 * Compute cosine similarity (fallback if not available from core)
 */
function computeCosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
