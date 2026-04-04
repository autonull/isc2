/* eslint-disable */
import { seededRng } from './rng.js';

const dot = (a: number[], b: number[]): number => a.reduce((sum, ai, i) => sum + ai * b[i], 0);

function generateRandomProjection(dimensions: number, rng: () => number): number[] {
  const vec = Array.from({ length: dimensions }, () => {
    const u1 = rng() || 1e-10;
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  });

  const norm = Math.sqrt(vec.reduce((sum, z) => sum + z * z, 0));
  return vec.map((z) => z / norm);
}

export function lshHash(
  vec: number[],
  seed: string,
  numHashes: number = 10,
  hashLen: number = 32
): string[] {
  const rng = seededRng(seed);
  const dim = vec.length;

  return Array.from({ length: numHashes }, () =>
    Array.from({ length: hashLen }, () => {
      const projection = generateRandomProjection(dim, rng);
      return dot(vec, projection) >= 0 ? '1' : '0';
    }).join('')
  );
}

export function collisionRate(hashesA: string[], hashesB: string[]): number {
  if (hashesA.length !== hashesB.length) {
    throw new Error('Hash arrays must have same length');
  }

  if (hashesA.length === 0) {return 0;}

  const collisions = hashesA.filter((h, i) => h === hashesB[i]).length;
  return collisions / hashesA.length;
}

export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) {
    throw new Error('Hash strings must have same length');
  }

  return hashA.split('').filter((c, i) => c !== hashB[i]).length;
}
