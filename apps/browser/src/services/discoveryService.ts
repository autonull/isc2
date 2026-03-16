/**
 * Discovery Service
 *
 * Manages peer discovery, search, and recommendations.
 */

import type { DiscoveryService as IDiscoveryService } from '../di/container.js';
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

class DiscoveryServiceImpl implements IDiscoveryService {
  async searchPeers(query: string): Promise<PeerProfile[]> {
    try {
      const networkService = getWebUINetworkService();
      const matches = await networkService.discoverPeers();

      const queryLower = query.toLowerCase();
      const filtered = matches.filter(match => {
        const name = (match as any).name ?? '';
        const bio = (match as any).bio ?? '';
        return name.toLowerCase().includes(queryLower) || bio.toLowerCase().includes(queryLower);
      });

      return filtered.map(match => ({
        id: match.id,
        name: (match as any).name ?? `@${match.id.slice(0, 8)}`,
        bio: (match as any).bio ?? '',
        similarity: (match as any).similarity,
        online: (match as any).online ?? false,
        lastSeen: (match as any).lastSeen,
      }));
    } catch (err) {
      logger.error('Failed to search peers', err as Error, { query });
      return [];
    }
  }

  async getRecommendedPeers(): Promise<PeerProfile[]> {
    try {
      const networkService = getWebUINetworkService();
      const matches = await networkService.discoverPeers();

      // Sort by similarity and return top recommendations
      const sorted = matches.sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0));

      return sorted.slice(0, 10).map(match => ({
        id: match.id,
        name: (match as any).name || `@${match.id.slice(0, 8)}`,
        bio: (match as any).bio || '',
        similarity: (match as any).similarity,
        online: (match as any).online || false,
        lastSeen: (match as any).lastSeen,
      }));
    } catch (err) {
      logger.error('Failed to get recommended peers', err as Error);
      return [];
    }
  }

  async getPeerProfile(userId: string): Promise<PeerProfile | null> {
    try {
      const networkService = getWebUINetworkService();
      const matches = await networkService.discoverPeers();
      const match = matches.find(m => m.id === userId);

      if (!match) {
        return null;
      }

      return {
        id: match.id,
        name: (match as any).name || `@${match.id.slice(0, 8)}`,
        bio: (match as any).bio || '',
        similarity: (match as any).similarity,
        online: (match as any).online || false,
        lastSeen: (match as any).lastSeen,
      };
    } catch (err) {
      logger.error('Failed to get peer profile', err as Error, { userId });
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
