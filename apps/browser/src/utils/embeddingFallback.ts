/**
 * Simple Embedding Fallback
 * 
 * Word-hash based embeddings - no ML model required.
 * Used when transformers.js is not available.
 */

const EMBEDDING_DIM = 384;

/**
 * Simple hash function
 */
function hashWord(word: string): number {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    const char = word.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Common English words for embedding
 */
const COMMON_WORDS = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so',
  'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people',
  'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than',
  'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is',
  'semantic', 'vector', 'embedding', 'similarity', 'match', 'search', 'discovery',
  'channel', 'post', 'user', 'content', 'topic', 'discussion', 'community',
];

/**
 * Compute embedding using word hashing
 */
export function computeEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 0);
  const embedding = new Array(EMBEDDING_DIM).fill(0);
  
  if (words.length === 0) {
    return embedding;
  }
  
  // Map words to vectors
  const vocabulary = new Set([...words, ...COMMON_WORDS]);
  const wordVectors = new Map<string, number[]>();
  
  for (const word of vocabulary) {
    const vector = new Array(EMBEDDING_DIM).fill(0);
    const hash = hashWord(word);
    
    // Set a few dimensions based on hash
    for (let i = 0; i < 5; i++) {
      const dim = (hash + i * 7) % EMBEDDING_DIM;
      vector[dim] = (hash % 1000) / 1000;
    }
    
    wordVectors.set(word, vector);
  }
  
  // Average word vectors
  for (const word of words) {
    const vector = wordVectors.get(word);
    if (vector) {
      for (let i = 0; i < EMBEDDING_DIM; i++) {
        embedding[i] += vector[i];
      }
    }
  }
  
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      embedding[i] /= norm;
    }
  }
  
  return embedding;
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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
