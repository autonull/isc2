/**
 * Semantic Analysis Algorithms
 *
 * Pure mathematical functions for clustering, layout, similarity, and vector operations.
 */

export interface Point2D {
  x: number;
  y: number;
  data?: any;
}

export namespace VectorMath {
  export function magnitude(vec: Point2D): number {
    return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
  }

  export function normalize(vec: Point2D): Point2D {
    const mag = magnitude(vec);
    if (mag === 0) return { x: 0, y: 0 };
    return { x: vec.x / mag, y: vec.y / mag };
  }

  export function distance(a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  export function squaredDistance(a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return dx * dx + dy * dy;
  }

  export function scale(vec: Point2D, factor: number): Point2D {
    return { x: vec.x * factor, y: vec.y * factor };
  }

  export function add(a: Point2D, b: Point2D): Point2D {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  export function subtract(a: Point2D, b: Point2D): Point2D {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  export function dot(a: Point2D, b: Point2D): number {
    return a.x * b.x + a.y * b.y;
  }

  export function centroid(points: Point2D[]): Point2D {
    if (points.length === 0) return { x: 0, y: 0 };
    const sum = points.reduce((acc, p) => add(acc, p), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
}

export namespace Similarity {
  export function meetsSimilarityThreshold(similarity: number, threshold: number): boolean {
    return similarity >= threshold;
  }

  export function findSimilar<T extends { embedding: number[] }>(
    items: T[],
    targetEmbedding: number[],
    threshold: number,
    similarityFn?: (a: number[], b: number[]) => number
  ): Array<{ item: T; similarity: number }> {
    const sim = similarityFn || defaultCosineSimilarity;
    const ranked = items
      .map((item) => ({
        item,
        similarity: sim(targetEmbedding, item.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return ranked.filter(({ similarity }) => similarity >= threshold);
  }

  export function rankBySimilarity<T extends { embedding: number[] }>(
    items: T[],
    targetEmbedding: number[],
    limit?: number,
    similarityFn?: (a: number[], b: number[]) => number
  ): Array<{ item: T; similarity: number }> {
    const sim = similarityFn || defaultCosineSimilarity;
    const ranked = items
      .map((item) => ({
        item,
        similarity: sim(targetEmbedding, item.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return limit ? ranked.slice(0, limit) : ranked;
  }
}

/**
 * Clustering algorithms
 */
export namespace Clustering {
  const DEFAULT_MAX_ITERATIONS = 100;
  const DEFAULT_CONVERGENCE_THRESHOLD = 0.001;

  /**
   * K-means clustering algorithm
   */
  export function kmeans(
    points: Point2D[],
    k: number,
    maxIterations: number = DEFAULT_MAX_ITERATIONS
  ): Point2D[] {
    if (points.length <= k) return points;

    const centroids = initializeCentroids(points, k);

    for (let iter = 0; iter < maxIterations; iter++) {
      const clusters = assignPointsToClusters(points, centroids);
      const newCentroids = updateCentroids(clusters, points);

      if (hasConverged(centroids, newCentroids, DEFAULT_CONVERGENCE_THRESHOLD)) {
        break;
      }

      centroids.splice(0, centroids.length, ...newCentroids);
    }

    return centroids;
  }

  /**
   * Hierarchical clustering (agglomerative)
   */
  export function hierarchical(points: Point2D[], maxClusters: number): number[] {
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

  // Private helper functions
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

  function assignPointsToClusters(points: Point2D[], centroids: Point2D[]): number[] {
    return points.map((point) => {
      let minDist = Infinity;
      let clusterIdx = 0;

      for (let i = 0; i < centroids.length; i++) {
        const dist = VectorMath.squaredDistance(point, centroids[i]);
        if (dist < minDist) {
          minDist = dist;
          clusterIdx = i;
        }
      }

      return clusterIdx;
    });
  }

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

      const sumX = clusterPoints.reduce((acc, p) => acc + p.x, 0);
      const sumY = clusterPoints.reduce((acc, p) => acc + p.y, 0);

      return {
        x: sumX / clusterPoints.length,
        y: sumY / clusterPoints.length,
        data: clusterPoints[0]?.data ?? null,
      };
    });
  }

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
          matrix[i][j] = VectorMath.squaredDistance(points[i], points[j]);
        }
      }
    }

    return matrix;
  }

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

  function averageLinkageDistance(clusterA: number[], clusterB: number[], distances: number[][]): number {
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
}

/**
 * Layout algorithms
 */
export namespace Layout {
  const DEFAULT_ITERATIONS = 50;
  const DEFAULT_REPULSION = 1.0;
  const DEFAULT_ATTRACTION = 0.1;
  const DEFAULT_DAMPING = 0.95;
  const DEFAULT_NORMALIZATION = 1.0;

  /**
   * Run force-directed layout on points
   */
  export function forceDirected(
    points: Point2D[],
    iterations: number = DEFAULT_ITERATIONS,
    config?: {
      repulsion?: number;
      attraction?: number;
      damping?: number;
      normalization?: number;
    }
  ): Point2D[] {
    const velocities = points.map(() => ({ x: 0, y: 0 }));
    const repulsion = config?.repulsion ?? DEFAULT_REPULSION;
    const attraction = config?.attraction ?? DEFAULT_ATTRACTION;
    const damping = config?.damping ?? DEFAULT_DAMPING;

    for (let iter = 0; iter < iterations; iter++) {
      applyForces(points, velocities, repulsion, attraction, damping);
      updatePositions(points, velocities);
    }

    normalizeToUnitCircle(points, config?.normalization ?? DEFAULT_NORMALIZATION);
    return points;
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

  // Private helper functions
  function applyForces(
    points: Point2D[],
    velocities: { x: number; y: number }[],
    repulsion: number,
    attraction: number,
    damping: number
  ): void {
    for (let i = 0; i < points.length; i++) {
      let vx = 0;
      let vy = 0;

      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;

        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;

        // Repulsion force
        const repulse = repulsion / (dist * dist);
        vx += (dx / dist) * repulse;
        vy += (dy / dist) * repulse;
      }

      // Apply damping to velocity
      velocities[i].x = (velocities[i].x + vx) * damping;
      velocities[i].y = (velocities[i].y + vy) * damping;
    }
  }

  function updatePositions(points: Point2D[], velocities: { x: number; y: number }[]): void {
    for (let i = 0; i < points.length; i++) {
      points[i].x += velocities[i].x;
      points[i].y += velocities[i].y;
    }
  }

  function normalizeToUnitCircle(points: Point2D[], normalizationFactor: number): void {
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

    let maxDist = 0;
    for (const p of points) {
      const dist = Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2);
      maxDist = Math.max(maxDist, dist);
    }

    if (maxDist > 0) {
      const scale = normalizationFactor / maxDist;
      for (const p of points) {
        p.x = centerX + (p.x - centerX) * scale;
        p.y = centerY + (p.y - centerY) * scale;
      }
    }
  }
}

/**
 * Default cosine similarity implementation
 */
function defaultCosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}
