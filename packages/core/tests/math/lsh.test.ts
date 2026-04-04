/* eslint-disable */
import { describe, it, expect, beforeEach } from 'vitest';
import { lshHash, collisionRate, hammingDistance } from '../../src/math/lsh.js';
import { VECTORS, LSH_PARAMS } from '../fixtures/vectors.js';

describe('lshHash', () => {
  describe('determinism', () => {
    it('should produce identical hashes for same vector and seed', () => {
      const vec = VECTORS.similarA;
      const hashes1 = lshHash(vec, 'test-seed', LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);
      const hashes2 = lshHash(vec, 'test-seed', LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);

      expect(hashes1).toEqual(hashes2);
    });

    it('should produce different hashes for same vector with different seeds', () => {
      const vec = VECTORS.similarA;
      const hashes1 = lshHash(vec, 'seed-1', LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);
      const hashes2 = lshHash(vec, 'seed-2', LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);

      // At least some hashes should differ
      const different = hashes1.filter((h, i) => h !== hashes2[i]).length;
      expect(different).toBeGreaterThan(0);
    });
  });

  describe('hash format', () => {
    it('should produce correct number of hashes', () => {
      const vec = VECTORS.similarA;
      const hashes = lshHash(vec, 'test', 5, 32);

      expect(hashes).toHaveLength(5);
    });

    it('should produce hashes of correct length', () => {
      const vec = VECTORS.similarA;
      const hashes = lshHash(vec, 'test', 3, 16);

      hashes.forEach((hash) => {
        expect(hash).toHaveLength(16);
        expect(hash).toMatch(/^[01]+$/);
      });
    });

    it('should handle custom numHashes and hashLen', () => {
      const vec = VECTORS.similarA;

      // Single hash
      const single = lshHash(vec, 'test', 1, 64);
      expect(single).toHaveLength(1);
      expect(single[0]).toHaveLength(64);

      // Many short hashes
      const many = lshHash(vec, 'test', 20, 8);
      expect(many).toHaveLength(20);
      many.forEach((h) => expect(h).toHaveLength(8));
    });
  });

  describe('bucket proximity', () => {
    it('should have high collision rate for identical vectors', () => {
      const vec = VECTORS.similarA;

      const hashes1 = lshHash(vec, LSH_PARAMS.seed, LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);
      const hashes2 = lshHash(vec, LSH_PARAMS.seed, LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);

      const collision = collisionRate(hashes1, hashes2);

      // Identical vectors should have 1.0 collision rate
      expect(collision).toBe(1.0);
    });

    it('should produce different hashes for different seeds (semantic isolation)', () => {
      const vec = VECTORS.similarA;

      const hashes1 = lshHash(vec, 'seed-one', LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);
      const hashes2 = lshHash(vec, 'seed-two', LSH_PARAMS.numHashes, LSH_PARAMS.hashLen);

      // Different seeds should produce different hashes
      const different = hashes1.filter((h, i) => h !== hashes2[i]).length;
      expect(different).toBeGreaterThan(0);
    });
  });

  describe('bucket distribution', () => {
    it('should hash different input vectors to different buckets', () => {
      // Generate different vectors and check they produce different hashes
      const hashes = [
        lshHash(VECTORS.random1, LSH_PARAMS.seed, 1, 16)[0],
        lshHash(VECTORS.random2, LSH_PARAMS.seed, 1, 16)[0],
        lshHash(VECTORS.random3, LSH_PARAMS.seed, 1, 16)[0],
        lshHash(VECTORS.random4, LSH_PARAMS.seed, 1, 16)[0],
        lshHash(VECTORS.random5, LSH_PARAMS.seed, 1, 16)[0],
      ];

      // Most hashes should be different (allowing some collisions is normal)
      const unique = new Set(hashes);
      expect(unique.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('should handle zero vector gracefully', () => {
      const zeroVec = new Array(384).fill(0);

      // Should not throw
      const hashes = lshHash(zeroVec, 'test', 3, 8);
      expect(hashes).toHaveLength(3);
      hashes.forEach((h) => expect(h).toHaveLength(8));
    });

    it('should handle near-zero vector', () => {
      const nearZero = VECTORS.nearZero;

      const hashes = lshHash(nearZero, 'test', 3, 8);
      expect(hashes).toHaveLength(3);
    });

    it('should handle single dimension vector', () => {
      const singleDim = [0.5];
      const hashes = lshHash(singleDim, 'test', 3, 8);

      expect(hashes).toHaveLength(3);
      // Should produce valid binary strings
      hashes.forEach((h) => expect(h).toMatch(/^[01]+$/));
    });
  });
});

describe('collisionRate', () => {
  it('should return 1.0 for identical hashes', () => {
    const hashes = ['10110', '01001', '11100'];
    expect(collisionRate(hashes, hashes)).toBe(1.0);
  });

  it('should return 0.0 for completely different hashes', () => {
    const hashesA = ['11111', '11111', '11111'];
    const hashesB = ['00000', '00000', '00000'];
    expect(collisionRate(hashesA, hashesB)).toBe(0.0);
  });

  it('should return 0 for empty arrays', () => {
    expect(collisionRate([], [])).toBe(0);
  });

  it('should throw for arrays of different lengths', () => {
    expect(() => collisionRate(['1'], ['1', '2'])).toThrow();
  });
});

describe('hammingDistance', () => {
  it('should return 0 for identical strings', () => {
    expect(hammingDistance('10110', '10110')).toBe(0);
  });

  it('should return length for opposite strings', () => {
    expect(hammingDistance('11111', '00000')).toBe(5);
  });

  it('should count correct number of differing bits', () => {
    expect(hammingDistance('10110', '00111')).toBe(2);
    expect(hammingDistance('0101', '1111')).toBe(2);
    expect(hammingDistance('0101', '0101')).toBe(0);
    expect(hammingDistance('1111', '0000')).toBe(4);
  });

  it('should throw for strings of different lengths', () => {
    expect(() => hammingDistance('1', '11')).toThrow();
  });
});
