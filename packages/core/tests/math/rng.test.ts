/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { seededRng, randomInt, shuffle, randomSample } from '../../src/math/rng';

describe('seededRng', () => {
  it('produces deterministic output for same seed', () => {
    const rng1 = seededRng('test-seed');
    const rng2 = seededRng('test-seed');

    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('produces different output for different seeds', () => {
    const rng1 = seededRng('seed-1');
    const rng2 = seededRng('seed-2');

    const values1 = Array.from({ length: 100 }, () => rng1());
    const values2 = Array.from({ length: 100 }, () => rng2());

    expect(values1).not.toEqual(values2);
  });

  it('produces values in range [0, 1)', () => {
    const rng = seededRng('test');
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('has reasonable distribution (χ² test approximation)', () => {
    const rng = seededRng('distribution-test');
    const buckets = new Array(10).fill(0);
    const n = 10000;

    for (let i = 0; i < n; i++) {
      const value = rng();
      const bucket = Math.floor(value * 10);
      buckets[Math.min(bucket, 9)]++;
    }

    // Each bucket should have roughly n/10 values
    const expected = n / 10;
    for (const count of buckets) {
      // Allow 20% deviation for randomness
      expect(count).toBeGreaterThan(expected * 0.8);
      expect(count).toBeLessThan(expected * 1.2);
    }
  });
});

describe('randomInt', () => {
  it('returns integer in range [min, max]', () => {
    const rng = seededRng('test');
    for (let i = 0; i < 100; i++) {
      const value = randomInt(rng, 1, 10);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it('can return min and max values', () => {
    const rng = seededRng('boundary-test');
    const values = new Set<number>();

    // Run many iterations to hit boundaries
    for (let i = 0; i < 1000; i++) {
      values.add(randomInt(rng, 1, 3));
    }

    expect(values.has(1)).toBe(true);
    expect(values.has(3)).toBe(true);
  });
});

describe('shuffle', () => {
  it('preserves array length', () => {
    const rng = seededRng('test');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle([...arr], rng);
    expect(shuffled.length).toBe(arr.length);
  });

  it('preserves array elements', () => {
    const rng = seededRng('test');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffle([...arr], rng);
    expect(shuffled.sort((a, b) => a - b)).toEqual(arr.sort((a, b) => a - b));
  });

  it('produces different orderings for different seeds', () => {
    const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const shuffled1 = shuffle([...arr1], seededRng('seed-1'));
    const shuffled2 = shuffle([...arr2], seededRng('seed-2'));

    expect(shuffled1).not.toEqual(shuffled2);
  });
});

describe('randomSample', () => {
  it('returns k elements', () => {
    const rng = seededRng('test');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sample = randomSample(arr, 5, rng);
    expect(sample.length).toBe(5);
  });

  it('returns elements from original array', () => {
    const rng = seededRng('test');
    const arr = [1, 2, 3, 4, 5];
    const sample = randomSample(arr, 3, rng);
    for (const item of sample) {
      expect(arr).toContain(item);
    }
  });

  it('returns empty array for k=0', () => {
    const rng = seededRng('test');
    const arr = [1, 2, 3];
    expect(randomSample(arr, 0, rng)).toEqual([]);
  });
});
