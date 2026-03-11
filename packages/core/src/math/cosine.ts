/**
 * Computes the cosine similarity between two vectors.
 *
 * @param a - First vector (typically 384-dimensional)
 * @param b - Second vector (typically 384-dimensional)
 * @returns Similarity score in range [-1, 1], where 1 = identical, 0 = orthogonal, -1 = opposite
 *
 * @throws Error if vectors have different lengths
 *
 * @example
 * ```typescript
 * const a = [1, 0, 0];
 * const b = [1, 0, 0];
 * cosineSimilarity(a, b); // returns 1.0
 *
 * const c = [0, 1, 0];
 * cosineSimilarity(a, c); // returns 0.0 (orthogonal)
 *
 * const d = [-1, 0, 0];
 * cosineSimilarity(a, d); // returns -1.0 (opposite)
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`);
  }

  if (a.length === 0) {
    return 0;
  }

  const { dotProduct, normA, normB } = a.reduce(
    (acc, ai, i) => {
      const bi = b[i];
      return {
        dotProduct: acc.dotProduct + ai * bi,
        normA: acc.normA + ai * ai,
        normB: acc.normB + bi * bi,
      };
    },
    { dotProduct: 0, normA: 0, normB: 0 }
  );

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Computes the squared Euclidean distance between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Squared Euclidean distance (always >= 0)
 */
export function squaredEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`);
  }

  return a.reduce((sum, ai, i) => {
    const diff = ai - b[i];
    return sum + diff * diff;
  }, 0);
}

/**
 * Normalizes a vector to unit length.
 *
 * @param vector - Input vector
 * @returns Unit vector (same direction, length = 1)
 *
 * @throws Error if vector has zero norm
 */
export function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

  if (norm === 0) {
    throw new Error('Cannot normalize a zero vector');
  }

  return vector.map((v) => v / norm);
}
