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
export function cosineSimilarity(a, b) {
    if (a.length !== b.length) {
        throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`);
    }
    const length = a.length;
    // Handle empty vectors
    if (length === 0) {
        return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    // Single pass for efficiency (SIMD-friendly)
    for (let i = 0; i < length; i++) {
        const ai = a[i];
        const bi = b[i];
        dotProduct += ai * bi;
        normA += ai * ai;
        normB += bi * bi;
    }
    // Handle zero vectors gracefully
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
export function squaredEuclideanDistance(a, b) {
    if (a.length !== b.length) {
        throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`);
    }
    let distance = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        distance += diff * diff;
    }
    return distance;
}
/**
 * Normalizes a vector to unit length.
 *
 * @param vector - Input vector
 * @returns Unit vector (same direction, length = 1)
 *
 * @throws Error if vector has zero norm
 */
export function normalize(vector) {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
        norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);
    if (norm === 0) {
        throw new Error('Cannot normalize a zero vector');
    }
    const result = new Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
        result[i] = vector[i] / norm;
    }
    return result;
}
//# sourceMappingURL=cosine.js.map