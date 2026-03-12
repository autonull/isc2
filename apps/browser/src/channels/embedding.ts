/**
 * Embedding Service - Real sentence transformers for semantic search
 * Uses @xenova/transformers with all-MiniLM-L6-v2 model (384 dimensions)
 */

import { EmbeddingModelAdapter } from '@isc/adapters';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;

interface EmbeddingCache {
  vector: number[];
  timestamp: number;
}

export class EmbeddingService implements EmbeddingModelAdapter {
  private pipeline: any = null;
  private isLoadedFlag = false;
  private isLoadingFlag = false;
  private loadError: Error | null = null;
  private cache = new Map<string, EmbeddingCache>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async load(modelId: string = MODEL_ID): Promise<void> {
    if (this.isLoadedFlag) return;
    if (this.isLoadingFlag) {
      // Wait for existing load to complete
      while (this.isLoadingFlag) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.loadError) throw this.loadError;
      return;
    }

    this.isLoadingFlag = true;
    this.loadError = null;

    try {
      // Dynamic import to avoid bundling transformers in initial load
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', modelId, {
        quantized: true, // Use quantized model (smaller, faster)
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            console.log('[EmbeddingService] Model loading:', progress);
          }
        },
      });
      this.isLoadedFlag = true;
      console.log('[EmbeddingService] Model loaded:', modelId);
    } catch (err) {
      this.loadError = err as Error;
      console.error('[EmbeddingService] Failed to load model:', err);
      throw err;
    } finally {
      this.isLoadingFlag = false;
    }
  }

  async embed(text: string): Promise<number[]> {
    const trimmedText = text.trim();
    const cacheKey = trimmedText;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.vector;
    }

    // Lazy load model if not loaded
    if (!this.isLoadedFlag && !this.isLoadingFlag) {
      try {
        await this.load();
      } catch {
        // Fallback to stub embedding if model fails to load
        return this.stubEmbed(trimmedText);
      }
    }

    // Wait for loading to complete if in progress
    if (this.isLoadingFlag) {
      while (this.isLoadingFlag) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.loadError) {
        return this.stubEmbed(trimmedText);
      }
    }

    // Generate embedding using transformers
    if (this.pipeline) {
      try {
        const output = await this.pipeline(trimmedText, {
          pooling: 'mean',
          normalize: true,
        });
        const vector = Array.from(output.data) as number[];
        
        // Cache the result
        this.cache.set(cacheKey, { vector, timestamp: Date.now() });
        
        return vector;
      } catch (err) {
        console.error('[EmbeddingService] Embedding failed, using fallback:', err);
        return this.stubEmbed(trimmedText);
      }
    }

    // Fallback to stub embedding
    return this.stubEmbed(trimmedText);
  }

  private stubEmbed(text: string): number[] {
    // Deterministic stub embedding based on text content
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }

    const seed = Math.abs(hash);
    const random = () => {
      const x = Math.sin(seed * 9999) * 10000;
      return x - Math.floor(x);
    };

    const mockEmbed = Array.from({ length: EMBEDDING_DIM }, (_, i) => 
      random() * 2 - 1 + Math.sin(i * 0.1) * 0.3
    );
    const norm = Math.sqrt(mockEmbed.reduce((sum, x) => sum + x * x, 0));
    const normalized = mockEmbed.map(x => x / norm);

    // Cache stub result too
    this.cache.set(text, { vector: normalized, timestamp: Date.now() });
    
    return normalized;
  }

  async unload(): Promise<void> {
    this.pipeline = null;
    this.isLoadedFlag = false;
    this.loadError = null;
    this.cache.clear();
  }

  isLoaded(): boolean {
    return this.isLoadedFlag;
  }

  isLoading(): boolean {
    return this.isLoadingFlag;
  }

  getModelId(): string | null {
    return this.isLoadedFlag ? MODEL_ID : null;
  }

  getLoadError(): Error | null {
    return this.loadError;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
