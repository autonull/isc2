import { describe, it, expect } from 'vitest';
import { cosineSimilarity, normalize, squaredEuclideanDistance } from '../../src/math/cosine';

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  it('returns -1.0 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it('handles zero vectors gracefully', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('is symmetric: sim(a,b) === sim(b,a)', () => {
    const a = [0.1, -0.2, 0.3, 0.4, -0.5];
    const b = [-0.3, 0.1, -0.4, 0.2, 0.5];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });

  it('handles 384-dimensional vectors', () => {
    const a = Array.from({ length: 384 }, (_, i) => Math.sin(i / 10));
    const b = Array.from({ length: 384 }, (_, i) => Math.cos(i / 10));
    const result = cosineSimilarity(a, b);
    expect(result).toBeGreaterThanOrEqual(-1);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('throws error for vectors of different lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow('Vector length mismatch');
  });

  it('handles empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

describe('normalize', () => {
  it('normalizes vector to unit length', () => {
    const v = [3, 4];
    const normalized = normalize(v);
    const length = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
    expect(length).toBeCloseTo(1.0, 10);
  });

  it('preserves direction', () => {
    const v = [1, 1, 1];
    const normalized = normalize(v);
    const ratio = normalized[0] / v[0];
    expect(normalized[1] / v[1]).toBeCloseTo(ratio, 10);
    expect(normalized[2] / v[2]).toBeCloseTo(ratio, 10);
  });

  it('throws error for zero vector', () => {
    expect(() => normalize([0, 0, 0])).toThrow('Cannot normalize a zero vector');
  });
});

describe('squaredEuclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(squaredEuclideanDistance(a, b)).toBe(0);
  });

  it('computes correct distance', () => {
    const a = [0, 0];
    const b = [3, 4];
    expect(squaredEuclideanDistance(a, b)).toBe(25); // 3^2 + 4^2
  });

  it('is symmetric', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    expect(squaredEuclideanDistance(a, b)).toBe(squaredEuclideanDistance(b, a));
  });
});
