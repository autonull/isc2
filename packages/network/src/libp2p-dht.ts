/**
 * ISC Network - Real libp2p DHT Implementation
 *
 * Maps semantic vectors to LSH hashes and uses the real libp2p Kademlia DHT
 * for true decentralized discovery.
 */

import type { DHT, PeerInfo, PeerMatch } from './types.js';
import type { NetworkAdapter } from '@isc/adapters';
import { lshHash, cosineSimilarity } from '@isc/core';

export class Libp2pDHT implements DHT {
  private networkAdapter: NetworkAdapter;
  private announceCount = 0;
  private discoverCount = 0;

  // Keep local in-memory cache of valid peers to satisfy some synchronous type constraints
  // without needing a separate DB immediately.
  private cache: Map<string, { peer: PeerInfo; expiresAt: number }> = new Map();

  constructor(networkAdapter: NetworkAdapter) {
    this.networkAdapter = networkAdapter;
  }

  /**
   * Announce a peer to the real libp2p DHT using LSH keys
   */
  async announce(peer: PeerInfo, ttl: number): Promise<void> {
    if (this.networkAdapter.isRunning && !this.networkAdapter.isRunning()) {
      console.warn('[Libp2pDHT] Cannot announce, network not running.');
      return;
    }

    // Generate LSH bucket hashes for the vector to map semantic space to DHT keys
    const hashes = lshHash(peer.vector, 'allminilm', 20, 32);

    // Serialize peer info
    const payloadBytes = new TextEncoder().encode(JSON.stringify(peer));

    // Announce to LSH buckets in the Kademlia DHT
    for (const hash of hashes.slice(0, 5)) { // Limit to top 5 to avoid spamming
      const key = `/isc/announce/allminilm/${hash}`;
      try {
        await this.networkAdapter.announce(key, payloadBytes, ttl);
      } catch (err) {
        console.warn(`[Libp2pDHT] Failed to announce to bucket ${key}:`, err);
      }
    }

    this.cache.set(peer.id, { peer, expiresAt: Date.now() + ttl });
    this.announceCount++;
  }

  /**
   * Discover peers from the real libp2p DHT using LSH keys
   */
  async discover(myVector: number[], threshold: number): Promise<PeerMatch[]> {
    if (this.networkAdapter.isRunning && !this.networkAdapter.isRunning()) {
      console.warn('[Libp2pDHT] Cannot discover, network not running.');
      return [];
    }

    this.discoverCount++;
    const hashes = lshHash(myVector, 'allminilm', 20, 32);
    const candidates: Map<string, PeerInfo> = new Map();

    for (const hash of hashes) {
      const key = `/isc/announce/allminilm/${hash}`;
      try {
        const results = await this.networkAdapter.query(key, 10);

        for (const resBytes of results) {
           try {
              const peer: PeerInfo = JSON.parse(new TextDecoder().decode(resBytes));

              // Skip self
              if (peer.vector.toString() === myVector.toString()) continue;

              if (!candidates.has(peer.id)) {
                  candidates.set(peer.id, peer);
              }
           } catch(e) {
               // Ignore parsing errors for individual DHT records
           }
        }
      } catch(err) {
         console.warn(`[Libp2pDHT] Failed to query bucket ${key}:`, err);
      }
    }

    const matches: PeerMatch[] = [];

    for (const peer of candidates.values()) {
      const similarity = cosineSimilarity(myVector, peer.vector);
      if (similarity >= threshold) {
        matches.push({
          peer,
          similarity,
          matchedTopics: peer.topics.slice(0, 3), // Simplified
        });

        // Populate local cache
        this.cache.set(peer.id, { peer, expiresAt: Date.now() + 300000 });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Store arbitrary bytes under a key in the DHT
   */
  async put(key: string, value: Uint8Array, ttl: number): Promise<void> {
    if (this.networkAdapter.isRunning && !this.networkAdapter.isRunning()) {
      console.warn('[Libp2pDHT] Cannot put, network not running.');
      return;
    }
    try {
      await this.networkAdapter.announce(key, value, ttl);
    } catch (err) {
      console.warn(`[Libp2pDHT] put failed for key ${key}:`, err);
    }
  }

  /**
   * Retrieve bytes stored under a key from the DHT
   */
  async get(key: string, count: number): Promise<Uint8Array[]> {
    if (this.networkAdapter.isRunning && !this.networkAdapter.isRunning()) {
      console.warn('[Libp2pDHT] Cannot get, network not running.');
      return [];
    }
    try {
      return await this.networkAdapter.query(key, count);
    } catch (err) {
      console.warn(`[Libp2pDHT] get failed for key ${key}:`, err);
      return [];
    }
  }

  getAll(): PeerInfo[] {
    const now = Date.now();
    return Array.from(this.cache.values())
      .filter(e => e.expiresAt > now)
      .map(e => e.peer);
  }

  getCount(): number {
    return this.getAll().length;
  }

  cleanup(currentTime: number): number {
    let removed = 0;
    for (const [id, entry] of this.cache.entries()) {
      if (entry.expiresAt < currentTime) {
        this.cache.delete(id);
        removed++;
      }
    }
    return removed;
  }
}
