/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-imports, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-redundant-type-constituents */
import type { EmbeddingModelAdapter } from '../interfaces/model.js';

const EMBEDDING_DIM = 384;

export class BrowserModel implements EmbeddingModelAdapter {
  private modelId: string | null = null;
  private isLoadedFlag = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractor: any = null;

  async load(modelId: string): Promise<void> {
    try {
      // Lazy import transformers to avoid onnxruntime initialization at module load
      const { pipeline, env } = await import('@xenova/transformers');

      // Check if we are running in an environment that has a real browser cache
      // The tests run in Node.js (via Vitest) where self.caches doesn't exist
      const hasBrowserCache = typeof self !== 'undefined' && 'caches' in self;

      // Configure env for browser
      env.allowLocalModels = !hasBrowserCache; // Enable local models for tests
      env.useBrowserCache = hasBrowserCache;

      // Load feature-extraction pipeline
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.extractor = await pipeline('feature-extraction' as 'auto', modelId);

      this.modelId = modelId;
      this.isLoadedFlag = true;
    } catch (err) {
      console.error(`Failed to load model ${modelId}:`, err);
      throw err;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isLoadedFlag || !this.extractor) {
      throw new Error('Model not loaded');
    }

    try {
      // Generate embeddings
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      // output is a Tensor. The data is a Float32Array under output.data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const raw = output.data as Float32Array;
      const data: number[] = Array.from(raw);

      if (data.length !== EMBEDDING_DIM) {
        console.warn(`Unexpected embedding dimension: ${data.length}, expected ${EMBEDDING_DIM}`);
        if (data.length > EMBEDDING_DIM) {
          return data.slice(0, EMBEDDING_DIM);
        } else {
          const padded: number[] = new Array(EMBEDDING_DIM).fill(0);
          data.forEach((val: number, i: number) => (padded[i] = val));
          return padded;
        }
      }

      return data;
    } catch (err) {
      console.error('Embedding generation failed:', err);
      throw err;
    }
  }

  unload(): Promise<void> {
    this.isLoadedFlag = false;
    this.modelId = null;

    if (this.extractor) {
      if (typeof (this.extractor as { dispose?: () => void }).dispose === 'function') {
        (this.extractor as { dispose: () => void }).dispose();
      }
      this.extractor = null;
    }
    return Promise.resolve();
  }

  isLoaded(): boolean {
    return this.isLoadedFlag;
  }

  getModelId(): string | null {
    return this.modelId;
  }
}

