/**
 * ISC Network - Transformer Embedding Service
 * 
 * Real LM embeddings using @xenova/transformers.
 * Lazy loading, caching, and batch processing support.
 */

import type { EmbeddingService } from './types.js';

/**
 * Transformer-based embedding service
 */
export class TransformerEmbeddingService implements EmbeddingService {
  private extractor: any = null;
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
    return this.loaded && this.extractor !== null;
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
      // Wait for existing load
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.loaded) return;
      if (this.loadError) throw this.loadError;
    }

    this.loading = true;
    this.loadError = null;

    try {
      // Lazy import to avoid module-level initialization issues
      const { pipeline } = await import('@xenova/transformers');
      
      console.log(`[Embedding] Loading model: ${this.modelId}`);
      this.extractor = await pipeline('feature-extraction', this.modelId);
      this.loaded = true;
      console.log(`[Embedding] Model loaded successfully`);
    } catch (err) {
      this.loadError = err instanceof Error ? err : new Error(String(err));
      console.warn('[Embedding] Failed to load model, will use word-hash fallback:', this.loadError.message);
      // We don't rethrow here to allow the app to continue with fallback
    } finally {
      this.loading = false;
    }
  }

  /**
   * Compute embedding for text
   */
  async compute(text: string): Promise<number[]> {
    // Check cache
    const cached = this.cache.get(text);
    if (cached) return cached;

    // Ensure model is loaded
    if (!this.isLoaded()) {
      await this.load();
    }

    try {
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      const embedding = Array.from(output.data as Float32Array);
      
      // Cache result
      this.cache.set(text, embedding);
      
      return embedding;
    } catch (err) {
      console.error('[Embedding] Model inference failed, using fallback:', err);
      return this.computeFallback(text);
    }
  }

  /**
   * Compute a fallback embedding using word-hashing (384-dim)
   */
  private computeFallback(text: string): number[] {
    const vocab = [
      'ai', 'distributed', 'consensus', 'blockchain', 'p2p', 'social', 'chat',
      'privacy', 'security', 'crypto', 'decentralized', 'network', 'protocol',
      'semantic', 'vector', 'embedding', 'match', 'search', 'discovery',
      'channel', 'post', 'identity', 'trust', 'reputation', 'community'
    ];
    
    const words = text.toLowerCase().match(/\w+/g) || [];
    const wordSet = new Set(words);
    const vector = new Array(384).fill(0);

    for (let i = 0; i < 384; i++) {
      let sum = 0;
      for (const word of vocab) {
        if (wordSet.has(word)) {
          // Simple deterministic hash based on word and dimension index
          let hash = 0;
          const str = word + i;
          for (let j = 0; j < str.length; j++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(j);
            hash |= 0;
          }
          sum += (Math.abs(hash) % 100) / 100;
        }
      }
      vector[i] = sum;
    }

    // Normalize
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < 384; i++) vector[i] /= norm;
    } else {
      // Return a stable random-ish vector for empty strings
      for (let i = 0; i < 384; i++) vector[i] = Math.sin(i * 0.1);
    }

    return vector;
  }

  /**
   * Compute embeddings for multiple texts (batched)
   */
  async computeBatch(texts: string[]): Promise<number[][]> {
    // Check cache first
    const results: number[][] = [];
    const toCompute: { text: string; index: number }[] = [];

    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(texts[i]);
      if (cached) {
        results[i] = cached;
      } else {
        toCompute.push({ text: texts[i], index: i });
        results[i] = []; // Placeholder
      }
    }

    // Compute missing embeddings
    if (toCompute.length > 0) {
      if (!this.isLoaded()) {
        await this.load();
      }

      if (!this.extractor) {
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

  /**
   * Compute cosine similarity between two vectors
   */
  similarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
    this.extractor = null;
    this.loaded = false;
    this.loading = false;
    console.log('[Embedding] Model unloaded');
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
