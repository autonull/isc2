/**
 * Embedding Module - Deprecated
 *
 * This module is deprecated. Use embedding-service.ts instead.
 * Re-exports maintained for backward compatibility.
 */

export {
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
  EmbeddingService,
} from './embedding-service.js';

export type { EmbeddingModelAdapter } from '@isc/adapters';
export { BrowserModel } from '@isc/adapters';
