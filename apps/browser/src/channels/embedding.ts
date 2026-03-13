/**
 * Embedding Service - Re-exports
 *
 * Re-exports from centralized embedding-service.ts for backward compatibility.
 * Use embedding-service.ts directly in new code.
 */

export {
  EmbeddingService,
  loadEmbeddingModel,
  getModel,
  isModelLoaded,
  isModelLoading,
  getLoadProgress,
  computeEmbedding,
  computeEmbeddings,
  unloadModel,
  clearCache,
  getCacheStats,
} from '../identity/embedding-service.js';

export type { EmbeddingModelAdapter } from '@isc/adapters';
export { BrowserModel } from '@isc/adapters';
