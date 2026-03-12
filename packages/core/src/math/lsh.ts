import { seededRng } from './rng.js';

export function lshHash(
  vec: number[],
  seed: string,
  numHashes: number = 10,
  hashLen: number = 32
): string[] {
  const rng = seededRng(seed);
  const dim = vec.length;

  return Array.from({ length: numHashes }, () => {
    const projection = generateRandomProjection(dim, rng);
    let hash = '';
    for (let i = 0; i < hashLen; i++) {
      hash += dot(vec, projection) >= 0 ? '1' : '0';
    }
    return hash;
  });
}

function generateRandomProjection(dimensions: number, rng: () => number): number[] {
  const vec = new Array<number>(dimensions);
  for (let i = 0; i < dimensions; i++) {
    const u1 = rng() || 1e-10;
    const u2 = rng();
    vec[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  const norm = Math.sqrt(vec.reduce((sum, z) => sum + z * z, 0));
  return vec.map((z) => z / norm);
}

const dot = (a: number[], b: number[]): number => a.reduce((sum, ai, i) => sum + ai * b[i], 0);

export function collisionRate(hashesA: string[], hashesB: string[]): number {
  if (hashesA.length !== hashesB.length) {
    throw new Error('Hash arrays must have same length');
  }

  if (hashesA.length === 0) return 0;

  let collisions = 0;
  for (let i = 0; i < hashesA.length; i++) {
    if (hashesA[i] === hashesB[i]) collisions++;
  }
  return collisions / hashesA.length;
}

export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) {
    throw new Error('Hash strings must have same length');
  }

  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) distance++;
  }
  return distance;
}
