/* eslint-disable */
/**
 * Discovery Service
 *
 * Manages peer discovery, search, and recommendations.
 */

import { getWebUINetworkService } from './networkService.ts';
import { loggers } from '../utils/logger.ts';

const logger = loggers.social;

interface PeerProfile {
  id: string;
  name: string;
  bio: string;
  similarity?: number;
  online: boolean;
  lastSeen?: number;
}

function toPeerProfile(match: any): PeerProfile {
  const peerId = match.peerId ?? match.peer?.id ?? '';
  const identity = match.identity ?? match.peer;
  return {
    id: peerId,
    name: identity?.name ?? `@${peerId.slice(0, 8)}`,
    bio: identity?.bio ?? identity?.description ?? '',
    similarity: match.similarity ?? 0,
    online: match.online ?? false,
    lastSeen: match.lastSeen,
  };
}

class DiscoveryServiceImpl {
  async searchPeers(query: string): Promise<PeerProfile[]> {
    try {
      const networkService = getWebUINetworkService();
      const matches = await networkService.discoverPeers();

      const queryLower = query.toLowerCase();
      const filtered = matches.filter((match: any) => {
        const profile = toPeerProfile(match);
        return (
          profile.name.toLowerCase().includes(queryLower) ||
          profile.bio.toLowerCase().includes(queryLower)
        );
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

      const sorted = [...matches].sort(
        (_a: any, _b: any) => (_b.similarity ?? 0) - (_a.similarity ?? 0)
      );

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
      const match = matches.find((m: any) => (m.peerId ?? m.peer?.id) === userId);

      return match ? toPeerProfile(match) : null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get peer profile', error, { userId });
      return null;
    }
  }
}

let _instance: DiscoveryServiceImpl | null = null;

export function getDiscoveryService(): DiscoveryServiceImpl {
  if (!_instance) {
    _instance = new DiscoveryServiceImpl();
  }
  return _instance;
}

export function createDiscoveryService(): DiscoveryServiceImpl {
  return getDiscoveryService();
}
