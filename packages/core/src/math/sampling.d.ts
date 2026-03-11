/**
 * Samples n vectors from a multivariate normal distribution N(μ, σ²I).
 *
 * Each dimension is sampled independently from N(μᵢ, σ), then the
 * resulting vector is normalized to unit length.
 *
 * @param mu - Mean vector (μ)
 * @param sigma - Standard deviation (σ) for all dimensions
 * @param n - Number of samples to generate
 * @param rng - Optional custom RNG function (for deterministic tests)
 * @returns Array of n normalized sample vectors
 *
 * @example
 * ```typescript
 * const mu = [0.1, -0.2, 0.3, ...]; // 384-dim mean
 * const samples = sampleFromDistribution(mu, 0.1, 100);
 * // samples = [[...], [...], ...] (100 normalized vectors)
 * ```
 */
export declare function sampleFromDistribution(mu: number[], sigma: number, n: number, rng?: () => number): number[][];
/**
 * Computes the mean vector from a set of samples.
 *
 * @param samples - Array of vectors
 * @returns Mean vector
 */
export declare function computeMean(samples: number[][]): number[];
/**
 * Computes the standard deviation for each dimension.
 *
 * @param samples - Array of vectors
 * @param mean - Pre-computed mean vector
 * @returns Standard deviation vector
 */
export declare function computeStdDev(samples: number[][], mean: number[]): number[];
//# sourceMappingURL=sampling.d.ts.map