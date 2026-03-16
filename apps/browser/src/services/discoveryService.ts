/**
 * Discovery Service
 *
 * Manages peer discovery, search, and recommendations.
 */

import type { DiscoveryService as IDiscoveryService, PeerMatch } from '@isc/network';
import { getWebUINetworkService } from './networkService.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.social;

interface PeerProfile {
  id: string;
  name: string;
  bio: string;
  similarity?: number;
  online: boolean;
  lastSeen?: number;
}

/**
 * Map PeerMatch to PeerProfile
 */
function toPeerProfile(match: PeerMatch): PeerProfile {
  const anyMatch = match as Record<string, unknown>;
  return {
    id: match.id,
    name: (anyMatch.name as string) ?? `@${match.id.slice(0, 8)}`,
    bio: (anyMatch.bio as string) ?? '',
    similarity: anyMatch.similarity as number | undefined,
    online: (anyMatch.online as boolean) ?? false,
    lastSeen: anyMatch.lastSeen as number | undefined,
  };
}

class DiscoveryServiceImpl implements IDiscoveryService {
  async searchPeers(query: string): Promise<PeerProfile[]> {
    try {
      const networkService = getWebUINetworkService();
      const matches = await networkService.discoverPeers();

      const queryLower = query.toLowerCase();
      const filtered = matches.filter(match => {
        const profile = toPeerProfile(match);
        return profile.name.toLowerCase().includes(queryLower) || profile.bio.toLowerCase().includes(queryLower);
      });

      return filtered.map(toPeerProfile);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to search peers', error, { query });
      return [];
    }
  }

  async getRecommendedPeers(): Promise<PeerProfile[]> {
    try {
      const networkService = getWebUINetworkService();
      const matches = await networkService.discoverPeers();

      // Sort by similarity and return top recommendations
      const sorted = matches.sort((a: PeerMatch, b: PeerMatch) => {
        const aSim = (a as Record<string, unknown>).similarity as number ?? 0;
        const bSim = (b as Record<string, unknown>).similarity as number ?? 0;
        return bSim - aSim;
      });

      return sorted.slice(0, 10).map(toPeerProfile);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get recommended peers', error);
      return [];
    }
  }

  async getPeerProfile(userId: string): Promise<PeerProfile | null> {
    try {
      const networkService = getWebUINetworkService();
      const matches = await networkService.discoverPeers();
      const match = matches.find(m => m.id === userId);

      return match ? toPeerProfile(match) : null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get peer profile', error, { userId });
      return null;
    }
  }
}

let _instance: DiscoveryServiceImpl | null = null;

export function getDiscoveryService(): IDiscoveryService {
  if (!_instance) {
    _instance = new DiscoveryServiceImpl();
  }
  return _instance;
}

export function createDiscoveryService(): IDiscoveryService {
  return getDiscoveryService();
}
