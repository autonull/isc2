import { createHash } from 'crypto';

const EMBEDDING_DIM = 384;

function sha256(data: string): Buffer {
  return createHash('sha256').update(data).digest();
}

function hashToVector(hash: Buffer, dim: number): number[] {
  const vector: number[] = [];
  for (let i = 0; i < dim; i++) {
    const byteIndex = i % hash.length;
    const value = hash[byteIndex] / 255.0;
    const phase = (i * Math.PI) / dim;
    vector.push(value * 2 - 1 + Math.sin(phase) * 0.1);
  }
  return vector;
}

function normalize(vec: number[]): number[] {
  const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return mag > 0 ? vec.map((v) => v / mag) : vec;
}

export class EmbeddingStub {
  private cache = new Map<string, number[]>();

  async embed(text: string): Promise<number[]> {
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }

    const hash = sha256(text);
    const vector = normalize(hashToVector(hash, EMBEDDING_DIM));
    this.cache.set(text, vector);
    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  getModelId(): string {
    return 'stub/sha256-384';
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export function createEmbeddingStub(): EmbeddingStub {
  return new EmbeddingStub();
}
