import { EmbeddingModelAdapter } from '../interfaces/model.js';
import { pipeline, env, type PipelineType } from '@xenova/transformers';

const EMBEDDING_DIM = 384;

export class BrowserModel implements EmbeddingModelAdapter {
  private modelId: string | null = null;
  private isLoadedFlag = false;
  // Use any here because transformers.js types can be tricky across versions
  private extractor: any = null;

  async load(modelId: string): Promise<void> {
    try {
      // Configure env for browser
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      // Load feature-extraction pipeline
      this.extractor = await pipeline('feature-extraction' as PipelineType, modelId);
      
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
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      // output is a Tensor. The data is in a Float32Array under output.data
      const data = Array.from(output.data as Float32Array);
      
      if (data.length !== EMBEDDING_DIM) {
        console.warn(`Unexpected embedding dimension: ${data.length}, expected ${EMBEDDING_DIM}`);
        // Handle dimension mismatch if necessary, though all-MiniLM-L6-v2 should be 384
        if (data.length > EMBEDDING_DIM) {
          return data.slice(0, EMBEDDING_DIM);
        } else {
          const padded = new Array(EMBEDDING_DIM).fill(0);
          data.forEach((val, i) => padded[i] = val);
          return padded;
        }
      }

      return data;
    } catch (err) {
      console.error('Embedding generation failed:', err);
      throw err;
    }
  }

  async unload(): Promise<void> {
    this.isLoadedFlag = false;
    this.modelId = null;
    
    // Help garbage collection
    if (this.extractor) {
      if (typeof this.extractor.dispose === 'function') {
        this.extractor.dispose();
      }
      this.extractor = null;
    }
  }

  isLoaded(): boolean {
    return this.isLoadedFlag;
  }

  getModelId(): string | null {
    return this.modelId;
  }
}

