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
 * In-memory DHT implementation
 */
export class InMemoryDHT implements DHT {
  private entries: Map<string, DHTEntry> = new Map();
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

  /**
   * Clean up expired entries
   */
  cleanup(currentTime: number): number {
    let removed = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (entry.expiresAt < currentTime) {
        this.entries.delete(id);
        removed++;
      }
    }
    return removed;
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
