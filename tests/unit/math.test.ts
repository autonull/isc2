/**
 * Unit Tests for @isc/core - Mathematical Functions
 */

import { describe, it, expect } from 'vitest';
import { cosineSimilarity, lshHash, sampleFromDistribution } from '../src/math/index.js';

describe('Math Functions', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle normalized vectors', () => {
      const vec1 = [0.6, 0.8];
      const vec2 = [0.6, 0.8];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle high-dimensional vectors', () => {
      const vec1 = Array.from({ length: 384 }, (_, i) => Math.sin(i));
      const vec2 = Array.from({ length: 384 }, (_, i) => Math.sin(i));
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle zero vectors gracefully', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });
  });

  describe('lshHash', () => {
    it('should generate consistent hashes for same vector', () => {
      const vec = [0.1, 0.2, 0.3, 0.4, 0.5];
      const seed = 'test-seed';
      const hash1 = lshHash(vec, seed, 10, 16);
      const hash2 = lshHash(vec, seed, 10, 16);
      expect(hash1).toEqual(hash2);
    });

    it('should generate different hashes for different seeds', () => {
      const vec = [0.1, 0.2, 0.3, 0.4, 0.5];
      const hash1 = lshHash(vec, 'seed1', 10, 16);
      const hash2 = lshHash(vec, 'seed2', 10, 16);
      expect(hash1).not.toEqual(hash2);
    });

    it('should generate similar hashes for similar vectors', () => {
      const vec1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const vec2 = [0.11, 0.21, 0.31, 0.41, 0.51];
      const seed = 'test-seed';
      const hash1 = lshHash(vec1, seed, 10, 16);
      const hash2 = lshHash(vec2, seed, 10, 16);

      // Count matching bits
      let matchingBits = 0;
      const totalBits = hash1.length * 16;
      for (let i = 0; i < hash1.length; i++) {
        for (let j = 0; j < 16; j++) {
          if (hash1[i][j] === hash2[i][j]) matchingBits++;
        }
      }

      // Similar vectors should have >50% matching bits
      expect(matchingBits / totalBits).toBeGreaterThan(0.5);
    });

    it('should generate different hashes for very different vectors', () => {
      const vec1 = [1, 1, 1, 1, 1];
      const vec2 = [-1, -1, -1, -1, -1];
      const seed = 'test-seed';
      const hash1 = lshHash(vec1, seed, 10, 16);
      const hash2 = lshHash(vec2, seed, 10, 16);

      // Count matching bits
      let matchingBits = 0;
      const totalBits = hash1.length * 16;
      for (let i = 0; i < hash1.length; i++) {
        for (let j = 0; j < 16; j++) {
          if (hash1[i][j] === hash2[i][j]) matchingBits++;
        }
      }

      // Very different vectors should have <50% matching bits
      expect(matchingBits / totalBits).toBeLessThan(0.5);
    });

    it('should generate correct number of hashes', () => {
      const vec = [0.1, 0.2, 0.3];
      const numHashes = 20;
      const hashes = lshHash(vec, 'seed', numHashes, 32);
      expect(hashes.length).toBe(numHashes);
    });

    it('should generate hashes of correct length', () => {
      const vec = [0.1, 0.2, 0.3];
      const hashLen = 32;
      const hashes = lshHash(vec, 'seed', 10, hashLen);
      hashes.forEach(hash => {
        expect(hash.length).toBe(hashLen);
      });
    });
  });

  describe('sampleFromDistribution', () => {
    it('should return samples with correct mean', () => {
      const mean = [0, 0, 0];
      const sigma = 0.1;
      const numSamples = 1000;
      const samples = sampleFromDistribution(mean, sigma, numSamples);

      expect(samples.length).toBe(numSamples);

      // Check mean of samples
      const sampleMean = samples.reduce((acc, sample) => {
        return acc.map((val, i) => val + sample[i]);
      }, new Array(3).fill(0)).map(val => val / numSamples);

      sampleMean.forEach(val => {
        expect(val).toBeCloseTo(0, 1); // Within 0.1 for 1000 samples
      });
    });

    it('should handle different sigma values', () => {
      const mean = [0, 0, 0];
      const sigma1 = 0.1;
      const sigma2 = 1.0;
      const numSamples = 100;

      const samples1 = sampleFromDistribution(mean, sigma1, numSamples);
      const samples2 = sampleFromDistribution(mean, sigma2, numSamples);

      // Calculate variance for each
      const variance1 = samples1.reduce((acc, sample) => {
        return acc + sample.reduce((sum, val) => sum + val * val, 0);
      }, 0) / (numSamples * 3);

      const variance2 = samples2.reduce((acc, sample) => {
        return acc + sample.reduce((sum, val) => sum + val * val, 0);
      }, 0) / (numSamples * 3);

      // Higher sigma should produce higher variance
      expect(variance2).toBeGreaterThan(variance1);
    });

    it('should handle non-zero mean', () => {
      const mean = [5, 5, 5];
      const sigma = 0.1;
      const numSamples = 100;
      const samples = sampleFromDistribution(mean, sigma, numSamples);

      const sampleMean = samples.reduce((acc, sample) => {
        return acc.map((val, i) => val + sample[i]);
      }, new Array(3).fill(0)).map(val => val / numSamples);

      sampleMean.forEach(val => {
        expect(val).toBeCloseTo(5, 0); // Within 0.5 for 100 samples
      });
    });

    it('should return single sample when numSamples is 1', () => {
      const mean = [1, 2, 3];
      const sigma = 0.1;
      const samples = sampleFromDistribution(mean, sigma, 1);
      expect(samples.length).toBe(1);
      expect(samples[0].length).toBe(3);
    });

    it('should handle high-dimensional distributions', () => {
      const mean = Array.from({ length: 384 }, () => 0);
      const sigma = 0.1;
      const samples = sampleFromDistribution(mean, sigma, 10);
      expect(samples.length).toBe(10);
      samples.forEach(sample => {
        expect(sample.length).toBe(384);
      });
    });
  });
});
