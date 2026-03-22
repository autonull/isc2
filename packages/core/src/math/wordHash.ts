/**
 * Word Hash Utilities
 *
 * Deterministic hash-based word embeddings.
 * Used as fallback when ML models are unavailable.
 */

export const EMBEDDING_DIM = 384;

/**
 * Common English words for embedding fallback
 */
export const COMMON_WORDS = [
  'the',
  'be',
  'to',
  'of',
  'and',
  'a',
  'in',
  'that',
  'have',
  'it',
  'for',
  'not',
  'on',
  'with',
  'he',
  'as',
  'you',
  'do',
  'at',
  'this',
  'but',
  'his',
  'by',
  'from',
  'they',
  'we',
  'say',
  'her',
  'she',
  'or',
  'an',
  'will',
  'my',
  'one',
  'all',
  'would',
  'there',
  'their',
  'what',
  'so',
  'up',
  'out',
  'if',
  'about',
  'who',
  'get',
  'which',
  'go',
  'me',
  'when',
  'make',
  'can',
  'like',
  'time',
  'no',
  'just',
  'him',
  'know',
  'take',
  'people',
  'into',
  'year',
  'your',
  'good',
  'some',
  'could',
  'them',
  'see',
  'other',
  'than',
  'then',
  'now',
  'look',
  'only',
  'come',
  'its',
  'over',
  'think',
  'also',
  'back',
  'after',
  'use',
  'two',
  'how',
  'our',
  'work',
  'first',
  'well',
  'way',
  'even',
  'new',
  'want',
  'because',
  'any',
  'these',
  'give',
  'day',
  'most',
  'us',
  'is',
  // Domain-specific
  'semantic',
  'vector',
  'embedding',
  'similarity',
  'match',
  'search',
  'discovery',
  'channel',
  'post',
  'user',
  'content',
  'topic',
  'discussion',
  'community',
  'ai',
  'distributed',
  'consensus',
  'p2p',
  'social',
  'chat',
  'privacy',
  'security',
  'crypto',
  'decentralized',
  'network',
  'protocol',
  'identity',
  'trust',
  'reputation',
];

/**
 * Simple deterministic hash function for words
 */
export function hashWord(word: string): number {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    const char = word.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Compute embedding using word hashing (384-dim)
 */
export function computeWordHashEmbedding(text: string): number[] {
  const words = text.toLowerCase().match(/\w+/g) ?? [];
  const wordSet = new Set(words);
  const vector = new Array(EMBEDDING_DIM).fill(0);

  if (words.length === 0) {
    return vector;
  }

  for (let i = 0; i < EMBEDDING_DIM; i++) {
    let sum = 0;
    for (const word of COMMON_WORDS) {
      if (wordSet.has(word)) {
        const hash = hashWord(word + i);
        sum += (Math.abs(hash) % 100) / 100;
      }
    }
    vector[i] = sum;
  }

  // Normalize
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vector[i] /= norm;
    }
  } else {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vector[i] = Math.sin(i * 0.1);
    }
  }

  return vector;
}

export { cosineSimilarity } from './cosine.js';
