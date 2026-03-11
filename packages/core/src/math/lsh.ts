import { seededRng } from './rng.js';

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
export function lshHash(
  vec: number[],
  seed: string,
  numHashes: number = 10,
  hashLen: number = 32
): string[] {
  const rng = seededRng(seed);
  const dim = vec.length;

  return Array.from({ length: numHashes }, () => {
    const projection = generateRandomProjection(dim, rng);
    return Array.from({ length: hashLen }, () => (dot(vec, projection) >= 0 ? '1' : '0')).join('');
  });
}

/**
 * Generates a random projection vector with normal distribution.
 *
 * @param dimensions - Number of dimensions
 * @param rng - Random number generator
 * @returns Random projection vector (unit length)
 */
function generateRandomProjection(dimensions: number, rng: () => number): number[] {
  const vec = Array.from({ length: dimensions }, () => {
    const u1 = rng() || 1e-10;
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  });

  const norm = Math.sqrt(vec.reduce((sum, z) => sum + z * z, 0));
  return vec.map((z) => z / norm);
}

/**
 * Computes dot product of two vectors.
 */
const dot = (a: number[], b: number[]): number => a.reduce((sum, ai, i) => sum + ai * b[i], 0);

/**
 * Computes the collision rate between two sets of LSH hashes.
 *
 * @param hashesA - First set of hashes
 * @param hashesB - Second set of hashes
 * @returns Collision rate in range [0, 1]
 */
export function collisionRate(hashesA: string[], hashesB: string[]): number {
  if (hashesA.length !== hashesB.length) {
    throw new Error('Hash arrays must have same length');
  }

  if (hashesA.length === 0) {
    return 0;
  }

  const collisions = hashesA.filter((h, i) => h === hashesB[i]).length;
  return collisions / hashesA.length;
}

/**
 * Computes Hamming distance between two binary hash strings.
 *
 * @param hashA - First binary hash string
 * @param hashB - Second binary hash string
 * @returns Number of differing bits
 */
export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) {
    throw new Error('Hash strings must have same length');
  }

  return hashA.split('').reduce((dist, bit, i) => dist + (bit !== hashB[i] ? 1 : 0), 0);
}
