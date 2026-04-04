/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { describe, it, expect } from 'vitest';
import { wordHash, hammingDistance } from '../src/shared/wordHash.js';

describe('wordHash', () => {
  it('should create a hash of correct length', () => {
    const hash = wordHash('hello world');
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(12); // HASH_SIZE = VOCAB_SIZE / 8 = 100 / 8 = 12
  });

  it('should be deterministic', () => {
    const hash1 = wordHash('the quick brown fox');
    const hash2 = wordHash('the quick brown fox');
    expect(hash1).toEqual(hash2);
  });

  it('should handle empty string', () => {
    const hash = wordHash('');
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(12);
  });

  it('should handle case insensitivity', () => {
    const hash1 = wordHash('Hello World');
    const hash2 = wordHash('hello world');
    expect(hash1).toEqual(hash2);
  });

  it('should handle punctuation', () => {
    const hash1 = wordHash('hello, world!');
    const hash2 = wordHash('hello world');
    expect(hash1).toEqual(hash2);
  });

  it('should handle multiple spaces', () => {
    const hash1 = wordHash('hello   world');
    const hash2 = wordHash('hello world');
    expect(hash1).toEqual(hash2);
  });

  it('should handle known vocabulary words', () => {
    const hash = wordHash('the and is');
    expect(hash).toBeInstanceOf(Uint8Array);
  });

  it('should handle unknown words gracefully', () => {
    const hash = wordHash('xyzzy quux plugh');
    expect(hash).toBeInstanceOf(Uint8Array);
  });
});

describe('hammingDistance', () => {
  it('should return 0 for identical hashes', () => {
    const hash = wordHash('test');
    const distance = hammingDistance(hash, hash);
    expect(distance).toBe(0);
  });

  it('should return normalized distance', () => {
    const hash1 = wordHash('hello');
    const hash2 = wordHash('world');
    const distance = hammingDistance(hash1, hash2);
    expect(distance).toBeGreaterThanOrEqual(0);
    expect(distance).toBeLessThanOrEqual(1);
  });

  it('should be symmetric', () => {
    const hash1 = wordHash('foo');
    const hash2 = wordHash('bar');
    const d1 = hammingDistance(hash1, hash2);
    const d2 = hammingDistance(hash2, hash1);
    expect(d1).toBe(d2);
  });

  it('should handle similar texts with low distance', () => {
    const hash1 = wordHash('the quick brown fox');
    const hash2 = wordHash('the quick brown dog');
    const distance = hammingDistance(hash1, hash2);
    expect(distance).toBeLessThan(0.5);
  });
});
