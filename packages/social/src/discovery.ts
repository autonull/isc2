/**
 * Discovery Service
 *
 * Peer discovery and matching.
 */

import type { PeerProfile } from './types';
import type { SocialNetwork } from './adapters/interfaces';

export interface DiscoveryOptions {
  query?: string;
  limit?: number;
  minSimilarity?: number;
}

export interface DiscoveryService {
  getPeers(options?: DiscoveryOptions): Promise<PeerProfile[]>;
  discoverPeers(): Promise<PeerProfile[]>;
  search(query: string): Promise<PeerProfile[]>;
  getProfile(peerId: string): Promise<PeerProfile | null>;
}

export function createDiscoveryService(network: SocialNetwork): DiscoveryService {
  let cachedPeers: PeerProfile[] = [];
  let cacheTime = 0;
  const CACHE_TTL = 60_000; // 1 minute

  return {
    async getPeers(options: DiscoveryOptions = {}): Promise<PeerProfile[]> {
      const { query, limit = 50, minSimilarity = 0 } = options;

      // Use cache if fresh
      const now = Date.now();
      let peers = cachedPeers;
      if (now - cacheTime > CACHE_TTL) {
        peers = await network.discoverPeers();
        cachedPeers = peers;
        cacheTime = now;
      }

      // Filter by query
      if (query) {
        const q = query.toLowerCase();
        peers = peers.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.bio.toLowerCase().includes(q)
        );
      }

      // Filter by similarity
      peers = peers.filter((p) => (p.similarity ?? 0) >= minSimilarity);

      // Sort by similarity
      peers = peers.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

      return peers.slice(0, limit);
    },

    async discoverPeers(): Promise<PeerProfile[]> {
      const peers = await network.discoverPeers();
      cachedPeers = peers;
      cacheTime = Date.now();
      return peers;
    },

    async search(query: string): Promise<PeerProfile[]> {
      return this.getPeers({ query });
    },

    async getProfile(peerId: string): Promise<PeerProfile | null> {
      const peers = await this.getPeers();
      return peers.find((p) => p.id === peerId) ?? null;
    },
  };
}
