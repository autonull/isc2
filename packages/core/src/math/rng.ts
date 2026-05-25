/* eslint-disable */
/**
 * Creates a seeded pseudo-random number generator using mulberry32 algorithm.
 *
 * This PRNG produces deterministic sequences from the same seed, making it
 * ideal for reproducible tests and deterministic LSH hashing.
 *
 * @param seed - Seed string (will be hashed to 32-bit integer)
 * @returns Function that returns random numbers in range [0, 1)
 *
 * @example
 * ```typescript
 * const rng = seededRng('my-seed');
 * rng(); // 0.123456...
 * rng(); // 0.789012...
 *
 * const rng2 = seededRng('my-seed');
 * rng2(); // Same as first rng() call
 * ```
 */
export function seededRng(seed: string): () => number {
  let state = fnv1aHash(seed);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a hash function for strings to 32-bit integer.
 *
 * @param str - Input string
 * @returns 32-bit hash value
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  const len = str.length;

  for (let i = 0; i < len; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }

  return hash >>> 0;
}

/**
 * Generates a random integer in range [min, max] using the provided RNG.
 *
 * @param rng - Random number generator function
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random integer in range
 */
export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Shuffles an array in-place using Fisher-Yates algorithm.
 *
 * @param array - Array to shuffle
 * @param rng - Random number generator function
 * @returns The same array (shuffled)
 */
export function shuffle<T>(array: T[], rng: () => number): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Selects k random elements from an array.
 *
 * @param array - Source array
 * @param k - Number of elements to select
 * @param rng - Random number generator function
 * @returns Array of k randomly selected elements
 */
export function randomSample<T>(array: T[], k: number, rng: () => number): T[] {
  const copy = [...array];
  shuffle(copy, rng);
  return copy.slice(0, k);
}
