/* eslint-disable */
/**
 * ISC Network - Transformer Embedding Service
 *
 * Real LM embeddings using @xenova/transformers.
 * Lazy loading, caching, and batch processing support.
 */

import type { EmbeddingService } from './types.js';
import { computeWordHashEmbedding, cosineSimilarity } from '@isc/core';
import { BrowserModel } from '@isc/adapters';

/**
 * Transformer-based embedding service
 */
export class TransformerEmbeddingService implements EmbeddingService {
  private adapter: BrowserModel | null = null;
  private loaded = false;
  private loading = false;
  private loadError: Error | null = null;
  private cache: Map<string, number[]> = new Map();
  private readonly modelId: string;

  constructor(modelId: string = 'Xenova/all-MiniLM-L6-v2') {
    this.modelId = modelId;
  }

  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.loaded && this.adapter !== null && this.adapter.isLoaded();
  }

  /**
   * Check if model is currently loading
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Get load error if any
   */
  getError(): Error | null {
    return this.loadError;
  }

  /**
   * Load the transformer model
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    if (this.loading) {
      while (this.loading) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (this.loaded) return;
      if (this.loadError) throw this.loadError;
    }

    this.loading = true;
    this.loadError = null;

    try {
      this.adapter = new BrowserModel();
      await this.adapter.load(this.modelId);
      this.loaded = true;
    } catch (err) {
      this.loadError = err instanceof Error ? err : new Error(String(err));
    } finally {
      this.loading = false;
    }
  }

  /**
   * Compute embedding for text
   */
  async compute(text: string): Promise<number[]> {
    const cached = this.cache.get(text);
    if (cached) return cached;

    if (!this.isLoaded()) {
      await this.load();
    }

    try {
      if (!this.adapter) throw new Error("Adapter not loaded");

      const embedding = await this.adapter.embed(text);
      this.cache.set(text, embedding);

      return embedding;
    } catch {
      return this.computeFallback(text);
    }
  }

  /**
   * Compute a fallback embedding using word-hashing (384-dim)
   */
  private computeFallback(text: string): number[] {
    return computeWordHashEmbedding(text);
  }

  /**
   * Compute embeddings for multiple texts (batched)
   */
  async computeBatch(texts: string[]): Promise<number[][]> {
    // Check cache first
    const results: number[][] = [];
    const toCompute: { text: string; index: number }[] = [];

    texts.forEach((text, i) => {
      const cached = this.cache.get(text);
      if (cached) {
        results[i] = cached;
      } else {
        toCompute.push({ text, index: i });
        results[i] = []; // Placeholder
      }
    });

    // Compute missing embeddings
    if (toCompute.length > 0) {
      if (!this.isLoaded()) {
        await this.load();
      }

      if (!this.adapter) {
        throw new Error('Embedding model not loaded');
      }

      // Process in batches to avoid memory issues
      const batchSize = 10;
      for (let i = 0; i < toCompute.length; i += batchSize) {
        const batch = toCompute.slice(i, i + batchSize);

        for (const { text, index } of batch) {
          const embedding = await this.compute(text);
          results[index] = embedding;
        }
      }
    }

    return results;
  }

  similarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; memoryEstimate: number } {
    const size = this.cache.size;
    // Rough estimate: 384 floats * 4 bytes per entry
    const memoryEstimate = size * 384 * 4;
    return { size, memoryEstimate };
  }

  /**
   * Unload the model to free memory
   */
  unload(): void {
    if (this.adapter) {
      this.adapter.unload().catch(console.error);
    }
    this.adapter = null;
    this.loaded = false;
    this.loading = false;
  }
}

/**
 * Create a new transformer embedding service
 */
export function createEmbeddingService(modelId?: string): TransformerEmbeddingService {
  return new TransformerEmbeddingService(modelId);
}

/**
 * Singleton instance for convenience
 */
let _instance: TransformerEmbeddingService | null = null;

export function getEmbeddingService(): TransformerEmbeddingService {
  if (!_instance) {
    _instance = createEmbeddingService();
  }
  return _instance;
}
