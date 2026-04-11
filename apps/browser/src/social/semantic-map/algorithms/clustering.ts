/* eslint-disable */
/**
 * Clustering Algorithms
 */

import type { Point2D } from '../types/semanticMap.ts';
import { CLUSTERING_CONFIG } from '../config/semanticConfig.ts';
import { squaredDistance } from '../utils/vectorMath.ts';

/**
 * K-means clustering algorithm
 */
export function kmeansClusters(
  points: Point2D[],
  k: number,
  maxIterations: number = CLUSTERING_CONFIG.maxIterations
): Point2D[] {
  if (points.length <= k) return points;

  const centroids: Point2D[] = initializeCentroids(points, k);

  for (let iter = 0; iter < maxIterations; iter++) {
    const clusters = assignPointsToClusters(points, centroids);
    const newCentroids = updateCentroids(clusters, points);

    if (hasConverged(centroids, newCentroids, CLUSTERING_CONFIG.convergenceThreshold)) {
      break;
    }

    centroids.splice(0, centroids.length, ...newCentroids);
  }

  return centroids;
}

/**
 * Initialize centroids using random selection
 */
function initializeCentroids(points: Point2D[], k: number): Point2D[] {
  const centroids: Point2D[] = [];
  const used = new Set<number>();

  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * points.length);
    if (!used.has(idx)) {
      used.add(idx);
      centroids.push({ ...points[idx] });
    }
  }

  return centroids;
}

/**
 * Assign points to nearest centroid
 */
function assignPointsToClusters(
  points: Point2D[],
  centroids: Point2D[]
): number[] {
  return points.map((point) => {
    let minDist = Infinity;
    let clusterIdx = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = squaredDistance(point, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        clusterIdx = i;
      }
    }

    return clusterIdx;
  });
}

/**
 * Update centroids based on cluster assignments
 */
function updateCentroids(assignments: number[], points: Point2D[]): Point2D[] {
  const k = Math.max(...assignments) + 1;
  const clusters = Array.from({ length: k }, () => [] as Point2D[]);

  assignments.forEach((clusterIdx, pointIdx) => {
    clusters[clusterIdx].push(points[pointIdx]);
  });

  return clusters.map((clusterPoints) => {
    if (clusterPoints.length === 0) {
      return { x: 0, y: 0, data: null };
    }

    const centroid = clusterPoints.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 }
    );

    return {
      x: centroid.x / clusterPoints.length,
      y: centroid.y / clusterPoints.length,
      data: clusterPoints[0]?.data ?? null,
    };
  });
}

/**
 * Check if centroids have converged
 */
function hasConverged(
  oldCentroids: Point2D[],
  newCentroids: Point2D[],
  threshold: number
): boolean {
  for (let i = 0; i < oldCentroids.length; i++) {
    const dx = newCentroids[i].x - oldCentroids[i].x;
    const dy = newCentroids[i].y - oldCentroids[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > threshold) {
      return false;
    }
  }

  return true;
}

/**
 * Hierarchical clustering (agglomerative)
 */
export function hierarchicalClusters(
  points: Point2D[],
  maxClusters: number
): number[] {
  const n = points.length;
  const clusters = Array.from({ length: n }, (_, i) => [i]);
  const distances = computeDistanceMatrix(points);

  while (clusters.length > maxClusters) {
    const { clusterA, clusterB, minDist } = findClosestClusters(clusters, distances);
    if (minDist === Infinity) break;

    clusters[clusterA] = [...clusters[clusterA], ...clusters[clusterB]];
    clusters.splice(clusterB, 1);

    for (let i = clusterB; i < distances.length; i++) {
      distances.splice(i, 1);
    }
    distances.splice(clusterB, 1);
  }

  const assignments = new Array(n).fill(0);
  clusters.forEach((cluster, clusterIdx) => {
    cluster.forEach((pointIdx) => {
      assignments[pointIdx] = clusterIdx;
    });
  });

  return assignments;
}

/**
 * Compute pairwise distance matrix
 */
function computeDistanceMatrix(points: Point2D[]): number[][] {
  const n = points.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i];
      } else {
        matrix[i][j] = squaredDistance(points[i], points[j]);
      }
    }
  }

  return matrix;
}

/**
 * Find closest pair of clusters
 */
function findClosestClusters(
  clusters: number[][],
  distances: number[][]
): { clusterA: number; clusterB: number; minDist: number } {
  let minDist = Infinity;
  let clusterA = 0;
  let clusterB = 1;

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const dist = averageLinkageDistance(clusters[i], clusters[j], distances);
      if (dist < minDist) {
        minDist = dist;
        clusterA = i;
        clusterB = j;
      }
    }
  }

  return { clusterA, clusterB, minDist };
}

/**
 * Compute average linkage distance between clusters
 */
function averageLinkageDistance(
  clusterA: number[],
  clusterB: number[],
  distances: number[][]
): number {
  let totalDist = 0;
  let count = 0;

  for (const i of clusterA) {
    for (const j of clusterB) {
      totalDist += distances[i][j];
      count++;
    }
  }

  return count > 0 ? totalDist / count : Infinity;
}
