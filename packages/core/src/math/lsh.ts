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
  const hashes: string[] = [];

  // Generate projection vectors and compute hashes
  for (let h = 0; h < numHashes; h++) {
    let hashBits = '';

    // Generate random projection vector for this hash
    const projection = generateRandomProjection(vec.length, rng);

    // Project vector and threshold at 0
    for (let i = 0; i < hashLen; i++) {
      const dotProduct = dot(vec, projection);
      hashBits += dotProduct >= 0 ? '1' : '0';
    }

    hashes.push(hashBits);
  }

  return hashes;
}

/**
 * Generates a random projection vector with normal distribution.
 * 
 * @param dimensions - Number of dimensions
 * @param rng - Random number generator
 * @returns Random projection vector (unit length)
 */
function generateRandomProjection(dimensions: number, rng: () => number): number[] {
  const vec = new Array(dimensions);
  let norm = 0;

  // Box-Muller transform for normal distribution
  for (let i = 0; i < dimensions; i++) {
    const u1 = rng() || 1e-10; // Avoid log(0)
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    vec[i] = z;
    norm += z * z;
  }

  // Normalize to unit length
  norm = Math.sqrt(norm);
  for (let i = 0; i < dimensions; i++) {
    vec[i] /= norm;
  }

  return vec;
}

/**
 * Computes dot product of two vectors.
 */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

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

  let collisions = 0;
  for (let i = 0; i < hashesA.length; i++) {
    if (hashesA[i] === hashesB[i]) {
      collisions++;
    }
  }

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

  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) {
      distance++;
    }
  }

  return distance;
}
