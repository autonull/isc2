import type { ANNQueryRequest, ANNQueryResponse } from './types.js';
import { validateANNQueryRequest, serializeServiceResponse } from './types.js';

export interface HNSWIndex {
  search(query: number[], k: number): { key: string; score: number }[];
  add(key: string, vector: number[]): void;
  remove(key: string): void;
  size(): number;
}

export interface IndexStore {
  get(modelHash: string): HNSWIndex | undefined;
  set(modelHash: string, index: HNSWIndex): void;
  delete(modelHash: string): void;
}

export class ANNService {
  private indexStore: IndexStore;

  constructor(indexStore: IndexStore, _defaultK: number = 50) {
    this.indexStore = indexStore;
  }

  async handleRequest(payload: Uint8Array): Promise<Uint8Array> {
    const decoder = new TextDecoder();
    const req: ANNQueryRequest = JSON.parse(decoder.decode(payload));

    if (!validateANNQueryRequest(req)) {
      throw new Error('Invalid ANN query request');
    }

    const index = this.indexStore.get(req.modelHash);
    if (!index) {
      const response: ANNQueryResponse = {
        matches: [],
        scores: [],
      };
      return serializeServiceResponse('ann_query', response);
    }

    const k = Math.min(req.k, index.size());
    const results = index.search(req.query, k);

    const response: ANNQueryResponse = {
      matches: results.map((r) => r.key),
      scores: results.map((r) => r.score),
    };

    return serializeServiceResponse('ann_query', response);
  }

  getOrCreateIndex(modelHash: string): HNSWIndex {
    let index = this.indexStore.get(modelHash);
    if (!index) {
      index = this.createHNSWIndex();
      this.indexStore.set(modelHash, index);
    }
    return index;
  }

  private createHNSWIndex(): HNSWIndex {
    return new SimpleHNSWIndex(16, 200);
  }
}

class SimpleHNSWIndex implements HNSWIndex {
  private vectors: Map<string, number[]> = new Map();

  constructor(_m: number = 16, _efConstruction: number = 200) {}

  search(query: number[], k: number): { key: string; score: number }[] {
    const results: { key: string; score: number }[] = [];

    for (const [key, vec] of this.vectors) {
      const score = this.cosineSimilarity(query, vec);
      results.push({ key, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  add(key: string, vector: number[]): void {
    this.vectors.set(key, vector);
  }

  remove(key: string): void {
    this.vectors.delete(key);
  }

  size(): number {
    return this.vectors.size;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, v, i) => sum + v * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
    const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }
}
