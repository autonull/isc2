/* eslint-disable */
/**
 * Force-Directed Layout Algorithm
 */

import type { Point2D } from '../types/semanticMap.ts';
import { LAYOUT_CONFIG, SEMANTIC_MAP_CONFIG } from '../config/semanticConfig.ts';
import { cosineSimilarity } from '@isc/core';

interface EmbeddingData {
  embedding: number[];
}

/**
 * Run force-directed layout on points
 */
export function forceDirectedLayout(
  points: Point2D[],
  iterations: number = SEMANTIC_MAP_CONFIG.layoutIterations
): Point2D[] {
  const velocities = points.map(() => ({ x: 0, y: 0 }));

  for (let iter = 0; iter < iterations; iter++) {
    applyForces(points, velocities);
    updatePositions(points, velocities);
  }

  normalizeToUnitCircle(points);
  return points;
}

/**
 * Apply repulsion and attraction forces
 */
function applyForces(points: Point2D[], velocities: { x: number; y: number }[]): void {
  for (let i = 0; i < points.length; i++) {
    let vx = 0;
    let vy = 0;

    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;

      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

      // Repulsion force
      const repulse = LAYOUT_CONFIG.repulsion / (dist * dist);
      vx += (dx / dist) * repulse;
      vy += (dy / dist) * repulse;

      // Attraction force for similar points
      const sim = computeEmbeddingSimilarity(points[i], points[j]);
      if (sim > SEMANTIC_MAP_CONFIG.similarityThreshold) {
        const attract = LAYOUT_CONFIG.attraction * (sim - SEMANTIC_MAP_CONFIG.similarityThreshold);
        vx -= (dx / dist) * attract;
        vy -= (dy / dist) * attract;
      }
    }

    // Apply damping to velocity
    velocities[i].x = (velocities[i].x + vx) * LAYOUT_CONFIG.damping;
    velocities[i].y = (velocities[i].y + vy) * LAYOUT_CONFIG.damping;
  }
}

/**
 * Update point positions based on velocities
 */
function updatePositions(
  points: Point2D[],
  velocities: { x: number; y: number }[]
): void {
  for (let i = 0; i < points.length; i++) {
    points[i].x += velocities[i].x;
    points[i].y += velocities[i].y;
  }
}

/**
 * Normalize points to fit within unit circle
 */
function normalizeToUnitCircle(points: Point2D[]): void {
  if (points.length === 0) return;

  const centroid = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  const centerX = centroid.x / points.length;
  const centerY = centroid.y / points.length;

  let maxDist = 0;
  for (const p of points) {
    const dist = Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2);
    maxDist = Math.max(maxDist, dist);
  }

  if (maxDist > 0) {
    const scale = LAYOUT_CONFIG.normalizationFactor / maxDist;
    for (const p of points) {
      p.x = centerX + (p.x - centerX) * scale;
      p.y = centerY + (p.y - centerY) * scale;
    }
  }
}

/**
 * Compute similarity between point embeddings
 */
function computeEmbeddingSimilarity(a: Point2D, b: Point2D): number {
  const aData = a.data as EmbeddingData;
  const bData = b.data as EmbeddingData;

  if (!aData?.embedding || !bData?.embedding) {
    return 0;
  }

  return cosineSimilarity(aData.embedding, bData.embedding);
}

/**
 * Initialize points on unit circle
 */
export function initializeOnUnitCircle(n: number): Point2D[] {
  return Array.from({ length: n }, (_, i) => ({
    x: Math.cos((i * 2 * Math.PI) / n),
    y: Math.sin((i * 2 * Math.PI) / n),
    data: null,
  }));
}
