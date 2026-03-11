/**
 * Locality-Sensitive Hashing (LSH) using random projections.
 *
 * LSH hashes similar vectors to the same buckets with high probability,
 * enabling efficient approximate nearest neighbor search in the DHT.
 *
 * @param vec - Input vector (typically 384-dimensional embedding)
 * @param seed - Seed string for deterministic hash generation
 * @param numHashes - Number of independent hash functions to apply
 * @param hashLen - Length of each binary hash string (bits)
 * @returns Array of binary hash strings (e.g., ["101100...", "011010..."])
 *
 * @example
 * ```typescript
 * const vec = [0.1, -0.2, 0.3, ...]; // 384-dim vector
 * const hashes = lshHash(vec, 'model-sha256', 10, 32);
 * // hashes = ["10110010...", "01101001...", ...] (10 hashes of 32 bits each)
 * ```
 */
export declare function lshHash(vec: number[], seed: string, numHashes?: number, hashLen?: number): string[];
/**
 * Computes the collision rate between two sets of LSH hashes.
 *
 * @param hashesA - First set of hashes
 * @param hashesB - Second set of hashes
 * @returns Collision rate in range [0, 1]
 */
export declare function collisionRate(hashesA: string[], hashesB: string[]): number;
/**
 * Computes Hamming distance between two binary hash strings.
 *
 * @param hashA - First binary hash string
 * @param hashB - Second binary hash string
 * @returns Number of differing bits
 */
export declare function hammingDistance(hashA: string, hashB: string): number;
//# sourceMappingURL=lsh.d.ts.map