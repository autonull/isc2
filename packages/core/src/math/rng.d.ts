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
export declare function seededRng(seed: string): () => number;
/**
 * Generates a random integer in range [min, max] using the provided RNG.
 *
 * @param rng - Random number generator function
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random integer in range
 */
export declare function randomInt(rng: () => number, min: number, max: number): number;
/**
 * Shuffles an array in-place using Fisher-Yates algorithm.
 *
 * @param array - Array to shuffle
 * @param rng - Random number generator function
 * @returns The same array (shuffled)
 */
export declare function shuffle<T>(array: T[], rng: () => number): T[];
/**
 * Selects k random elements from an array.
 *
 * @param array - Source array
 * @param k - Number of elements to select
 * @param rng - Random number generator function
 * @returns Array of k randomly selected elements
 */
export declare function randomSample<T>(array: T[], k: number, rng: () => number): T[];
//# sourceMappingURL=rng.d.ts.map