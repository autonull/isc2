/**
 * Reputation Cache Service
 *
 * Caches reputation scores for performance optimization.
 */

import type { DecayReputation } from '../types/reputation.js';
import { dbGet, dbPut } from '../../db/helpers.js';
import { REPUTATION_STORES, REPUTATION_CONSTANTS } from '../config/reputationConfig.js';

interface CachedReputation extends DecayReputation {
  cachedAt: number;
}

export class ReputationCache {
  /**
   * Cache reputation score
   */
  static async cache(peerID: string, reputation: DecayReputation): Promise<void> {
    await dbPut(REPUTATION_STORES.SCORES, {
      ...reputation,
      cachedAt: Date.now(),
    });
  }

  /**
   * Get cached reputation score
   */
  static async get(peerID: string): Promise<DecayReputation | null> {
    const cached = await dbGet<CachedReputation>(REPUTATION_STORES.SCORES, peerID);

    if (!cached) return null;

    // Cache expires after 1 hour
    const cacheAge = Date.now() - cached.cachedAt;

    if (cacheAge > REPUTATION_CONSTANTS.CACHE_EXPIRY_MS) {
      return null;
    }

    const { cachedAt, ...reputation } = cached;
    return reputation;
  }

  /**
   * Check if cache is valid
   */
  static isValid(cachedAt: number): boolean {
    const cacheAge = Date.now() - cachedAt;
    return cacheAge <= REPUTATION_CONSTANTS.CACHE_EXPIRY_MS;
  }
}
