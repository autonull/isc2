/**
 * Embedding Service - Real sentence transformers for semantic search
 * Uses @xenova/transformers with all-MiniLM-L6-v2 model (384 dimensions)
 * 
 * This is a wrapper around the centralized EmbeddingService for backward compatibility.
 */

import { EmbeddingService as CentralEmbeddingService } from '../identity/embedding-service.js';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export class EmbeddingServiceWrapper {
  async load(modelId: string = MODEL_ID): Promise<void> {
    await CentralEmbeddingService.loadModel();
  }

  async embed(text: string): Promise<number[]> {
    return CentralEmbeddingService.computeEmbedding(text);
  }

  async unload(): Promise<void> {
    await CentralEmbeddingService.unloadModel();
  }

  isLoaded(): boolean {
    return CentralEmbeddingService.isModelLoaded();
  }

  isLoading(): boolean {
    return CentralEmbeddingService.isModelLoading();
  }

  getModelId(): string | null {
    return CentralEmbeddingService.isModelLoaded() ? MODEL_ID : null;
  }

  clearCache(): void {
    CentralEmbeddingService.clearCache();
  }

  getCacheSize(): number {
    return 0; // Not exposed in new service
  }
}

// Singleton instance
export const embeddingService = new EmbeddingServiceWrapper();

// Re-export for convenience
export {
  EmbeddingService,
  loadEmbeddingModel,
  isModelLoaded,
  isModelLoading,
  getLoadProgress,
  computeEmbedding,
} from '../identity/embedding-service.js';
