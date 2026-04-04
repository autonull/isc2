/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { sampleFromDistribution, computeMean, computeStdDev } from '../../src/math/sampling.js';

describe('sampleFromDistribution', () => {
  describe('reproducibility', () => {
    it('should produce identical samples with seeded RNG', () => {
      const mu = [0.1, -0.2, 0.3, 0.0];
      const sigma = 0.1;
      const n = 10;

      // Use a simple seeded RNG that produces same sequence
      let seed1 = 12345;
      let seed2 = 12345;
      const seededRng1 = () => {
        seed1 = (seed1 * 9301 + 49297) % 233280;
        return seed1 / 233280;
      };
      const seededRng2 = () => {
        seed2 = (seed2 * 9301 + 49297) % 233280;
        return seed2 / 233280;
      };

      const samples1 = sampleFromDistribution(mu, sigma, n, seededRng1);
      const samples2 = sampleFromDistribution(mu, sigma, n, seededRng2);

      samples1.forEach((s, i) => {
        s.forEach((v, j) => {
          expect(v).toBeCloseTo(samples2[i][j], 3);
        });
      });
    });
  });

  describe('sigma behavior', () => {
    it('should return vectors close to mu when sigma is 0', () => {
      const mu = [0.1, 0.2, 0.3, 0.4];
      const sigma = 0;
      const n = 10;

      const samples = sampleFromDistribution(mu, sigma, n);

      samples.forEach((sample) => {
        const norm = Math.sqrt(sample.reduce((sum, v) => sum + v * v, 0));
        // Normalized mu
        const expectedNorm = Math.sqrt(mu.reduce((sum, v) => sum + v * v, 0));
        sample.forEach((v, i) => {
          expect(v).toBeCloseTo(mu[i] / expectedNorm, 1);
        });
      });
    });

    it('should produce samples with variance when sigma is large', () => {
      const mu = [0.0, 0.0, 0.0, 0.0];
      const sigma = 1.0;
      const n = 100;

      const samples = sampleFromDistribution(mu, sigma, n);

      // Check that samples have variance (not all same normalized direction)
      const firstElements = samples.map((s) => s[0]);
      const uniqueFirst = new Set(firstElements.map((n) => n.toFixed(2)));

      // With large sigma, we should see some variation
      expect(uniqueFirst.size).toBeGreaterThan(1);
    });
  });

  describe('sigma behavior', () => {
    it('should return vectors close to mu when sigma is 0', () => {
      const mu = [0.1, 0.2, 0.3, 0.4];
      const sigma = 0;
      const n = 10;

      const samples = sampleFromDistribution(mu, sigma, n);

      samples.forEach((sample) => {
        const norm = Math.sqrt(sample.reduce((sum, v) => sum + v * v, 0));
        // Normalized mu
        const expectedNorm = Math.sqrt(mu.reduce((sum, v) => sum + v * v, 0));
        sample.forEach((v, i) => {
          expect(v).toBeCloseTo(mu[i] / expectedNorm, 1);
        });
      });
    });

    it('should produce samples with variance when sigma is large', () => {
      const mu = [0.0, 0.0, 0.0, 0.0];
      const sigma = 1.0;
      const n = 100;

      const samples = sampleFromDistribution(mu, sigma, n);

      // Check that samples have variance (not all same normalized direction)
      const firstElements = samples.map((s) => s[0]);
      const uniqueFirst = new Set(firstElements.map((n) => n.toFixed(2)));

      // With large sigma, we should see some variation
      expect(uniqueFirst.size).toBeGreaterThan(1);
    });
  });

  describe('output format', () => {
    it('should produce exactly n samples', () => {
      const mu = [0.1, 0.2, 0.3];
      const sigma = 0.1;

      expect(sampleFromDistribution(mu, sigma, 10)).toHaveLength(10);
      expect(sampleFromDistribution(mu, sigma, 1)).toHaveLength(1);
      expect(sampleFromDistribution(mu, sigma, 0)).toHaveLength(0);
    });

    it('should produce vectors of same dimension as mu', () => {
      const mu3 = [0.1, 0.2, 0.3];
      const mu10 = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

      const samples3 = sampleFromDistribution(mu3, 0.1, 5);
      const samples10 = sampleFromDistribution(mu10, 0.1, 5);

      samples3.forEach((s) => expect(s).toHaveLength(3));
      samples10.forEach((s) => expect(s).toHaveLength(10));
    });

    it('should produce normalized unit vectors', () => {
      const mu = [0.1, 0.2, 0.3, 0.4];
      const sigma = 0.5;
      const n = 50;

      const samples = sampleFromDistribution(mu, sigma, n);

      samples.forEach((sample) => {
        const norm = Math.sqrt(sample.reduce((sum, v) => sum + v * v, 0));
        expect(norm).toBeCloseTo(1.0, 2);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle single dimension', () => {
      const mu = [1.0];
      const samples = sampleFromDistribution(mu, 0.1, 5);

      samples.forEach((s) => {
        expect(s).toHaveLength(1);
        expect(s[0]).toBeCloseTo(1.0, 2);
      });
    });

    it('should handle non-zero mu', () => {
      const mu = [0.5, 0.5];
      const samples = sampleFromDistribution(mu, 0.1, 5);

      expect(samples).toHaveLength(5);
      samples.forEach((s) => expect(s).toHaveLength(2));
    });
  });
});

describe('computeMean', () => {
  it('should compute correct mean', () => {
    const samples = [
      [1, 2, 3],
      [2, 3, 4],
      [3, 4, 5],
    ];

    const mean = computeMean(samples);

    expect(mean).toEqual([2, 3, 4]);
  });

  it('should throw for empty samples', () => {
    expect(() => computeMean([])).toThrow();
  });
});

describe('computeStdDev', () => {
  it('should compute correct standard deviation', () => {
    const samples = [[2], [2], [2]];
    const mean = [2];

    const stdDev = computeStdDev(samples, mean);

    expect(stdDev[0]).toBeCloseTo(0, 5);
  });

  it('should throw for empty samples', () => {
    expect(() => computeStdDev([], [1])).toThrow();
  });
});
