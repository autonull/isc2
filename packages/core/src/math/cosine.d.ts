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
export declare function cosineSimilarity(a: number[], b: number[]): number;
/**
 * Computes the squared Euclidean distance between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Squared Euclidean distance (always >= 0)
 */
export declare function squaredEuclideanDistance(a: number[], b: number[]): number;
/**
 * Normalizes a vector to unit length.
 *
 * @param vector - Input vector
 * @returns Unit vector (same direction, length = 1)
 *
 * @throws Error if vector has zero norm
 */
export declare function normalize(vector: number[]): number[];
//# sourceMappingURL=cosine.d.ts.map