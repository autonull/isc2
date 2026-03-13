/**
 * Peer Discovery Service
 *
 * Handles DHT peer discovery and querying.
 */

import { lshHash } from '@isc/core';
import { getDHTClient } from '../../../network/dht.js';
import { DISCOVER_CONFIG } from '../config/discoverConfig.js';
import type { PeerInfo } from '../types/discover.js';

export class PeerDiscoveryService {
  /**
   * Query DHT for peers
   */
  async discoverPeers(
    queryVec: number[],
    modelHash: string
  ): Promise<PeerInfo[]> {
    const dhtClient = getDHTClient();
    if (!dhtClient || !dhtClient.isConnected()) {
      return [];
    }

    const hashes = lshHash(queryVec, modelHash, 20, 32);
    const allPeers: PeerInfo[] = [];
    const seenPeers = new Set<string>();

    const queryPromises = hashes
      .slice(0, DISCOVER_CONFIG.maxQueryHashes)
      .map(async (hash) => {
        const key = `/isc/announce/${modelHash}/${hash}`;
        const results = await dhtClient.query(key, 20);

        for (const data of results) {
          try {
            const decoded = JSON.parse(
              new TextDecoder().decode(data)
            ) as PeerInfo;

            if (!seenPeers.has(decoded.peerId)) {
              seenPeers.add(decoded.peerId);
              allPeers.push(decoded);
            }
          } catch {
            // Skip invalid entries
          }
        }
      });

    await Promise.all(queryPromises);
    return allPeers;
  }

  /**
   * Check if DHT is connected
   */
  isConnected(): boolean {
    const dhtClient = getDHTClient();
    return dhtClient?.isConnected() ?? false;
  }

  /**
   * Get own peer ID
   */
  getOwnPeerId(): string {
    const dhtClient = getDHTClient();
    return dhtClient?.getPeerId() ?? '';
  }
}
