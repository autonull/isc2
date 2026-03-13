/**
 * Embedding Service
 * 
 * Manages transformer model loading, caching, and inference with fallback support.
 * Provides lazy loading, IndexedDB caching, and graceful degradation.
 */

import type { EmbeddingModelAdapter } from '@isc/adapters';
import { BrowserModel } from '@isc/adapters';
import { loggers } from '../utils/logger.js';

const logger = loggers.embed;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const MODEL_CACHE_KEY = 'isc-embedding-model-loaded';
const EMBEDDING_CACHE_DB = 'isc-embeddings';
const EMBEDDING_CACHE_VERSION = 1;

interface EmbeddingCache {
  text: string;
  embedding: number[];
  timestamp: number;
}

class EmbeddingServiceClass {
  private model: EmbeddingModelAdapter | null = null;
  private loadPromise: Promise<void> | null = null;
  private instance: BrowserModel | null = null;
  private isLoading = false;
  private isLoaded = false;
  private loadProgress = 0;
  private onProgressCallbacks: Array<(progress: number) => void> = [];
  private embeddingCache: Map<string, EmbeddingCache> = new Map();
  private cacheDb: IDBDatabase | null = null;

  /**
   * Load the embedding model with progress tracking
   */
  async loadModel(onProgress?: (progress: number) => void): Promise<EmbeddingModelAdapter> {
    if (this.isLoaded && this.model) {
      return this.model;
    }

    if (this.loadPromise) {
      if (onProgress) {
        this.onProgressCallbacks.push(onProgress);
        onProgress(this.loadProgress);
      }
      return this.loadPromise.then(() => this.model!);
    }

    this.isLoading = true;
    if (onProgress) {
      this.onProgressCallbacks.push(onProgress);
    }

    this.loadPromise = (async () => {
      try {
        // Check if model was previously loaded
        const wasLoaded = localStorage.getItem(MODEL_CACHE_KEY);
        if (wasLoaded) {
          this.loadProgress = 0.3;
          this.notifyProgress();
        }

        if (!this.instance) {
          this.instance = new BrowserModel();
        }

        this.loadProgress = 0.5;
        this.notifyProgress();

        await this.instance.load(MODEL_ID);
        
        this.loadProgress = 0.9;
        this.notifyProgress();

        // Initialize IndexedDB cache
        await this.initCacheDb();

        // Load cached embeddings
        await this.loadCachedEmbeddings();

        this.model = this.instance;
        this.isLoaded = true;
        this.isLoading = false;
        this.loadProgress = 1.0;
        this.notifyProgress();

        // Mark as loaded for future sessions
        localStorage.setItem(MODEL_CACHE_KEY, 'true');

        logger.info('Model loaded successfully', { model: MODEL_ID });
      } catch (err) {
        logger.warn('Failed to load model, using fallback', { error: (err as Error).message });
        this.model = null;
        this.instance = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.loadProgress = 0;
        this.notifyProgress();
        throw err;
      }
    })();

    try {
      await this.loadPromise;
      return this.model!;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Get model instance (returns null if not loaded)
   */
  getModel(): EmbeddingModelAdapter | null {
    return this.model;
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.isLoaded && this.model?.isLoaded() === true;
  }

  /**
   * Check if model is currently loading
   */
  isModelLoading(): boolean {
    return this.isLoading;
  }

  /**
   * Get load progress (0-1)
   */
  getLoadProgress(): number {
    return this.loadProgress;
  }

  /**
   * Compute embedding for text with caching
   */
  async computeEmbedding(text: string): Promise<number[]> {
    // Check in-memory cache first
    const cached = this.embeddingCache.get(text);
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour cache
      return cached.embedding;
    }

    // Use model if available
    if (this.isModelLoaded() && this.model) {
      try {
        const embedding = await this.model.embed(text);
        
        // Cache in memory
        this.embeddingCache.set(text, {
          text,
          embedding,
          timestamp: Date.now(),
        });

        // Cache in IndexedDB (async, don't block)
        this.cacheEmbedding(text, embedding).catch((err) => {
          logger.warn('Failed to cache embedding', { error: (err as Error).message });
        });

        return embedding;
      } catch (err) {
        logger.warn('Model inference failed, using fallback', { error: (err as Error).message });
      }
    }

    // Fallback: word-hash based embedding
    return this.computeWordHashEmbedding(text);
  }

  /**
   * Compute embeddings for multiple texts (batched)
   */
  async computeEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.computeEmbedding(text)));
  }

  /**
   * Unload model to free memory
   */
  async unloadModel(): Promise<void> {
    if (this.model && this.instance) {
      await this.instance.unload();
      this.model = null;
      this.instance = null;
      this.isLoaded = false;
      this.isLoading = false;
      this.loadProgress = 0;
      this.loadPromise = null;
      logger.info('Model unloaded');
    }
  }

  /**
   * Clear embedding cache
   */
  async clearCache(): Promise<void> {
    this.embeddingCache.clear();
    if (this.cacheDb) {
      const tx = this.cacheDb.transaction('embeddings', 'readwrite');
      tx.objectStore('embeddings').clear();
      await new Promise<void>((resolve) => {
        tx.oncomplete = () => resolve();
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ count: number; size: number }> {
    if (!this.cacheDb) {
      return { count: 0, size: 0 };
    }

    const tx = this.cacheDb.transaction('embeddings', 'readonly');
    const store = tx.objectStore('embeddings');
    const count = await new Promise<number>((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
    });

    // Estimate size (384 floats * 4 bytes + text overhead)
    const estimatedSize = count * (384 * 4 + 100);

    return { count, size: estimatedSize };
  }

  /**
   * Initialize IndexedDB cache
   */
  private async initCacheDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(EMBEDDING_CACHE_DB, EMBEDDING_CACHE_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.cacheDb = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('embeddings')) {
          const store = db.createObjectStore('embeddings', { keyPath: 'text' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Cache embedding in IndexedDB
   */
  private async cacheEmbedding(text: string, embedding: number[]): Promise<void> {
    if (!this.cacheDb) return;

    const cache: EmbeddingCache = {
      text,
      embedding,
      timestamp: Date.now(),
    };

    const tx = this.cacheDb.transaction('embeddings', 'readwrite');
    tx.objectStore('embeddings').put(cache);

    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Don't fail on cache errors
    });
  }

  /**
   * Load cached embeddings from IndexedDB
   */
  private async loadCachedEmbeddings(): Promise<void> {
    if (!this.cacheDb) return;

    const tx = this.cacheDb.transaction('embeddings', 'readonly');
    const store = tx.objectStore('embeddings');
    const all = await new Promise<EmbeddingCache[]>((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    // Load recent embeddings into memory cache (last 100)
    const recent = all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 100);

    for (const item of recent) {
      this.embeddingCache.set(item.text, item);
    }

    logger.debug('Loaded cached embeddings', { count: recent.length });
  }

  /**
   * Fallback: word-hash based embedding (no model required)
   * Uses a fixed vocabulary and creates a 384-dim vector based on word presence
   */
  private computeWordHashEmbedding(text: string): number[] {
    const vocabulary = this.getVocabulary();
    const words = text.toLowerCase().match(/\w+/g) || [];
    const wordSet = new Set(words);

    // Create 384-dim vector based on word presence and simple hashing
    const embedding = new Array(384).fill(0);

    for (let i = 0; i < 384; i++) {
      let sum = 0;
      for (const word of vocabulary) {
        if (wordSet.has(word)) {
          // Simple hash-based contribution
          const hash = this.simpleHash(word + i);
          sum += (hash % 100) / 100;
        }
      }
      embedding[i] = sum / Math.sqrt(vocabulary.length);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < 384; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Simple hash function for fallback embedding
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Common English words for fallback embedding
   */
  private getVocabulary(): string[] {
    return [
      'ai', 'ethics', 'technology', 'philosophy', 'science', 'machine', 'learning',
      'data', 'algorithm', 'model', 'neural', 'network', 'deep', 'intelligence',
      'distributed', 'system', 'consensus', 'blockchain', 'crypto', 'decentralized',
      'privacy', 'security', 'encryption', 'peer', 'network', 'protocol', 'p2p',
      'chat', 'message', 'communication', 'social', 'community', 'trust', 'reputation',
      'identity', 'verification', 'signature', 'key', 'public', 'private', 'secure',
      'web', 'internet', 'browser', 'server', 'client', 'api', 'service', 'cloud',
      'compute', 'storage', 'database', 'cache', 'memory', 'performance', 'optimization',
      'user', 'interface', 'experience', 'design', 'frontend', 'backend', 'fullstack',
      'development', 'engineering', 'software', 'code', 'programming', 'language',
      'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'react', 'node',
      'open', 'source', 'community', 'collaboration', 'contribution', 'maintainer',
      'research', 'experiment', 'prototype', 'mvp', 'product', 'feature', 'release',
      'test', 'quality', 'automation', 'ci', 'cd', 'deployment', 'infrastructure',
      'docker', 'kubernetes', 'container', 'microservice', 'architecture', 'pattern',
      'semantic', 'vector', 'embedding', 'similarity', 'match', 'search', 'discovery',
      'relation', 'context', 'meaning', 'knowledge', 'graph', 'ontology', 'taxonomy',
      'time', 'location', 'space', 'temporal', 'spatial', 'geographic', 'position',
      'mood', 'emotion', 'sentiment', 'tone', 'feeling', 'attitude', 'perspective',
      'domain', 'category', 'topic', 'subject', 'theme', 'field', 'discipline',
      'cause', 'effect', 'result', 'outcome', 'impact', 'influence', 'consequence',
      'part', 'whole', 'component', 'element', 'member', 'segment', 'section',
      'similar', 'different', 'same', 'unique', 'common', 'rare', 'special',
      'oppose', 'support', 'agree', 'disagree', 'debate', 'discussion', 'argument',
      'require', 'need', 'want', 'desire', 'goal', 'objective', 'purpose', 'aim',
      'boost', 'enhance', 'improve', 'optimize', 'increase', 'decrease', 'reduce',
      'art', 'creativity', 'creative', 'innovation', 'invent', 'create', 'make',
      'copyright', 'license', 'legal', 'law', 'regulation', 'policy', 'rule', 'norm',
      'automation', 'robot', 'autonomous', 'automatic', 'manual', 'human', 'artificial',
      'future', 'prediction', 'forecast', 'trend', 'analysis', 'insight', 'pattern',
      'question', 'answer', 'problem', 'solution', 'challenge', 'opportunity', 'risk',
    ];
  }

  /**
   * Notify progress callbacks
   */
  private notifyProgress(): void {
    for (const callback of this.onProgressCallbacks) {
      try {
        callback(this.loadProgress);
      } catch (err) {
        logger.warn('Progress callback error', { error: (err as Error).message });
      }
    }
  }
}

// Singleton instance
export const EmbeddingService = new EmbeddingServiceClass();

// Convenience exports for backward compatibility
export async function loadEmbeddingModel(onProgress?: (progress: number) => void) {
  return EmbeddingService.loadModel(onProgress);
}

export function getModel() {
  return EmbeddingService.getModel();
}

export function isModelLoaded() {
  return EmbeddingService.isModelLoaded();
}

export function isModelLoading() {
  return EmbeddingService.isModelLoading();
}

export function getLoadProgress() {
  return EmbeddingService.getLoadProgress();
}

export async function computeEmbedding(text: string) {
  return EmbeddingService.computeEmbedding(text);
}

export async function computeEmbeddings(texts: string[]) {
  return EmbeddingService.computeEmbeddings(texts);
}

export async function unloadModel() {
  return EmbeddingService.unloadModel();
}

export async function clearCache() {
  return EmbeddingService.clearCache();
}

export async function getCacheStats() {
  return EmbeddingService.getCacheStats();
}
