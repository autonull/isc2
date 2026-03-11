import { seededRng } from './rng.js';
import { normalize } from './cosine.js';
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
export function sampleFromDistribution(mu, sigma, n, rng) {
    const random = rng || seededRng('default-sample-rng');
    const samples = [];
    for (let s = 0; s < n; s++) {
        const sample = new Array(mu.length);
        // Box-Muller transform for each dimension
        for (let i = 0; i < mu.length; i += 2) {
            const u1 = random() || 1e-10; // Avoid log(0)
            const u2 = random();
            const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
            sample[i] = mu[i] + sigma * z0;
            if (i + 1 < mu.length) {
                sample[i + 1] = mu[i + 1] + sigma * z1;
            }
        }
        // Normalize to unit vector
        try {
            samples.push(normalize(sample));
        }
        catch {
            // If normalization fails (zero vector), use mu directly
            samples.push(normalize(mu));
        }
    }
    return samples;
}
/**
 * Computes the mean vector from a set of samples.
 *
 * @param samples - Array of vectors
 * @returns Mean vector
 */
export function computeMean(samples) {
    if (samples.length === 0) {
        throw new Error('Cannot compute mean of empty sample set');
    }
    const dimensions = samples[0].length;
    const mean = new Array(dimensions).fill(0);
    for (const sample of samples) {
        for (let i = 0; i < dimensions; i++) {
            mean[i] += sample[i];
        }
    }
    for (let i = 0; i < dimensions; i++) {
        mean[i] /= samples.length;
    }
    return mean;
}
/**
 * Computes the standard deviation for each dimension.
 *
 * @param samples - Array of vectors
 * @param mean - Pre-computed mean vector
 * @returns Standard deviation vector
 */
export function computeStdDev(samples, mean) {
    if (samples.length === 0) {
        throw new Error('Cannot compute std dev of empty sample set');
    }
    const dimensions = samples[0].length;
    const variance = new Array(dimensions).fill(0);
    for (const sample of samples) {
        for (let i = 0; i < dimensions; i++) {
            const diff = sample[i] - mean[i];
            variance[i] += diff * diff;
        }
    }
    const stdDev = new Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
        stdDev[i] = Math.sqrt(variance[i] / samples.length);
    }
    return stdDev;
}
//# sourceMappingURL=sampling.js.map