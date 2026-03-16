/**
 * Simple Embedding Fallback
 *
 * Re-exports from @isc/core for backward compatibility.
 */

export {
  EMBEDDING_DIM,
  COMMON_WORDS,
  hashWord,
  computeWordHashEmbedding as computeEmbedding,
  wordHashCosineSimilarity as cosineSimilarity,
} from '@isc/core';
