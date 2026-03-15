import { EmbeddingModelAdapter } from '../interfaces/model.js';
import { pipeline, env, type PipelineType } from '@xenova/transformers';

interface NodeModelOptions {
  maxBatchSize?: number;
}

const EMBEDDING_DIM = 384;

export class NodeModel implements EmbeddingModelAdapter {
  private modelId: string | null = null;
  private isLoadedFlag = false;
  // Use any here because transformers.js types can be tricky across versions
  private extractor: any = null;

  constructor(private options: Required<NodeModelOptions> = { maxBatchSize: 32 }) {}

  async load(modelId: string): Promise<void> {
    try {
      // In node, we can allow local models or just use the HF hub cache
      // The default behavior of env usually works fine in node
      
      this.extractor = await pipeline('feature-extraction' as PipelineType, modelId);
      
      this.modelId = modelId;
      this.isLoadedFlag = true;
    } catch (err) {
      console.error(`Failed to load model ${modelId} in Node:`, err);
      throw err;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isLoadedFlag || !this.extractor) {
      throw new Error('Model not loaded');
    }

    try {
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      const data = Array.from(output.data as Float32Array);
      
      if (data.length !== EMBEDDING_DIM) {
        console.warn(`Unexpected embedding dimension: ${data.length}, expected ${EMBEDDING_DIM}`);
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

  async embedBatch(texts: string[]): Promise<number[][]> {
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += this.options.maxBatchSize) {
      batches.push(texts.slice(i, i + this.options.maxBatchSize));
    }

    const results: number[][] = [];
    for (const batch of batches) {
      for (const text of batch) {
        results.push(await this.embed(text));
      }
    }
    return results;
  }
}

export const nodeModel = new NodeModel();

