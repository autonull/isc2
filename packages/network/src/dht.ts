/* eslint-disable */
/**
 * ISC Network - In-Memory DHT Implementation
 *
 * Simple in-memory DHT for peer announcements with TTL-based cleanup.
 * Used for testing and as a reference for production DHT implementations.
 */

import type { DHT, PeerInfo, PeerMatch } from './types.js';
import { cosineSimilarity } from '@isc/core';

/**
 * DHT entry with expiration
 */
interface DHTEntry {
  peer: PeerInfo;
  expiresAt: number;
}

/**
 * Generic key-value entry with expiration
 */
interface KVEntry {
  value: Uint8Array;
  expiresAt: number;
}

/**
 * In-memory DHT implementation
 */
export class InMemoryDHT implements DHT {
  private entries: Map<string, DHTEntry> = new Map();
  private kvStore: Map<string, KVEntry[]> = new Map();
  private announceCount = 0;
  private discoverCount = 0;

  /**
   * Announce a peer to the DHT
   */
  async announce(peer: PeerInfo, ttl: number): Promise<void> {
    if (this.entries.size >= 1000) {
      // Prevent unbounded growth
      this.cleanup(Date.now());
    }

    this.entries.set(peer.id, {
      peer,
      expiresAt: Date.now() + ttl,
    });
    this.announceCount++;
  }

  /**
   * Discover peers similar to the given vector
   */
  async discover(myVector: number[], threshold: number): Promise<PeerMatch[]> {
    this.discoverCount++;
    const matches: PeerMatch[] = [];
    const now = Date.now();

    for (const entry of this.entries.values()) {
      // Skip expired entries
      if (entry.expiresAt < now) continue;

      // Skip self
      if (entry.peer.id === myVector.toString()) continue;

      // Compute similarity
      const similarity = cosineSimilarity(myVector, entry.peer.vector);

      if (similarity >= threshold) {
        // Find matched topics
        const matchedTopics = this.findMatchedTopics(
          entry.peer.topics,
          myVector // In real impl, would use topic vectors
        );

        matches.push({
          peer: entry.peer,
          similarity,
          matchedTopics,
        });
      }
    }

    // Sort by similarity (highest first)
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get all active peers
   */
  getAll(): PeerInfo[] {
    const now = Date.now();
    return Array.from(this.entries.values())
      .filter((e) => e.expiresAt > now)
      .map((e) => e.peer);
  }

  /**
   * Get peer count
   */
  getCount(): number {
    return this.getAll().length;
  }

  cleanup(currentTime: number): number {
    let removed = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (entry.expiresAt < currentTime) {
        this.entries.delete(id);
        removed++;
      }
    }
    for (const [key, list] of this.kvStore.entries()) {
      const pruned = list.filter(e => e.expiresAt >= currentTime);
      if (pruned.length !== list.length) {
        removed += list.length - pruned.length;
        pruned.length === 0 ? this.kvStore.delete(key) : this.kvStore.set(key, pruned);
      }
    }
    return removed;
  }

  /**
   * Store a value under a key with TTL
   */
  async put(key: string, value: Uint8Array, ttl: number): Promise<void> {
    const list = this.kvStore.get(key) ?? [];
    list.push({ value, expiresAt: Date.now() + ttl });
    this.kvStore.set(key, list);
  }

  async get(key: string, count: number): Promise<Uint8Array[]> {
    const now = Date.now();
    return (this.kvStore.get(key) ?? [])
      .filter(e => e.expiresAt > now)
      .slice(0, count)
      .map(e => e.value);
  }

  /**
   * Get statistics
   */
  getStats(): { entries: number; announces: number; discoveries: number } {
    return {
      entries: this.getCount(),
      announces: this.announceCount,
      discoveries: this.discoverCount,
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.kvStore.clear();
  }

  private findMatchedTopics(topics: string[], _myVector: number[]): string[] {
    // Simplified - in real impl would compare topic vectors
    return topics.slice(0, 3);
  }
}

/**
 * Create a new in-memory DHT instance
 */
export function createDHT(): InMemoryDHT {
  return new InMemoryDHT();
}
