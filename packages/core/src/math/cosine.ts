/* eslint-disable */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`);
  }

  if (a.length === 0) {return 0;}

  const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = magnitude(a);
  const normB = magnitude(b);

  if (normA === 0 || normB === 0) {return 0;}

  return dotProduct / (normA * normB);
}

export function squaredEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} !== ${b.length}`);
  }

  return a.reduce((sum, ai, i) => {
    const diff = ai - b[i];
    return sum + diff * diff;
  }, 0);
}

export function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
}

export function normalize(vector: number[]): number[] {
  const norm = magnitude(vector);

  if (norm === 0) {
    throw new Error('Cannot normalize a zero vector');
  }

  return vector.map((v) => v / norm);
}
