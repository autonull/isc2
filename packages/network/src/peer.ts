/* eslint-disable */
/**
 * ISC Network - Virtual Peer Implementation
 * 
 * Represents a peer in the network with embedding computation,
 * DHT announcements, and peer discovery.
 */

import type { PeerInfo, PeerMatch, DHT, EmbeddingService } from './types.js';

/**
 * Virtual peer configuration
 */
export interface PeerConfig {
  id: string;
  name?: string;
  description: string;
  topics?: string[];
}

/**
 * Peer statistics
 */
export interface PeerStats {
  announcesSent: number;
  discoveriesMade: number;
  matchesFound: number;
  lastAnnounce: number;
  lastDiscovery: number;
}

/**
 * Virtual peer in the network
 */
export class VirtualPeer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly topics: string[];
  
  private vector: number[] | null = null;
  private stats: PeerStats = {
    announcesSent: 0,
    discoveriesMade: 0,
    matchesFound: 0,
    lastAnnounce: 0,
    lastDiscovery: 0,
  };

  constructor(config: PeerConfig) {
    this.id = config.id;
    this.name = config.name || `Peer-${config.id.slice(-4)}`;
    this.description = config.description;
    this.topics = config.topics || this.extractTopics(config.description);
  }

  /**
   * Extract topics from description
   */
  private extractTopics(text: string): string[] {
    // Simple keyword extraction
    const keywords = [
      'ai', 'artificial intelligence', 'machine learning', 'neural',
      'distributed', 'systems', 'consensus', 'blockchain',
      'climate', 'carbon', 'energy',
      'quantum', 'computing',
      'bio', 'gene', 'crispr',
      'robotics', 'automation',
    ];

    const lower = text.toLowerCase();
    return keywords.filter(k => lower.includes(k));
  }

  /**
   * Compute embedding for this peer's description
   */
  async computeEmbedding(service: EmbeddingService): Promise<number[]> {
    if (this.vector) return this.vector;

    this.vector = await service.compute(this.description);
    return this.vector;
  }

  /**
   * Set a pre-computed embedding vector (e.g. for channel peers)
   */
  setVector(embedding: number[]): void {
    this.vector = embedding;
  }

  /**
   * Get the peer's vector (must call computeEmbedding first)
   */
  getVector(): number[] | null {
    return this.vector;
  }

  /**
   * Get peer info for DHT announcement
   */
  getInfo(): PeerInfo {
    if (!this.vector) {
      throw new Error('Vector not computed - call computeEmbedding first');
    }

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      vector: this.vector,
      topics: this.topics,
      lastSeen: Date.now(),
    };
  }

  /**
   * Announce this peer to the DHT
   */
  async announce(dht: DHT, ttl: number = 300000): Promise<void> {
    if (!this.vector) {
      throw new Error('Cannot announce - vector not computed');
    }

    await dht.announce(this.getInfo(), ttl);
    this.stats.announcesSent++;
    this.stats.lastAnnounce = Date.now();
  }

  /**
   * Discover matching peers in the DHT
   */
  async discover(dht: DHT, threshold: number = 0.5): Promise<PeerMatch[]> {
    if (!this.vector) {
      throw new Error('Cannot discover - vector not computed');
    }

    const matches = await dht.discover(this.vector, threshold);
    this.stats.discoveriesMade++;
    this.stats.matchesFound += matches.length;
    this.stats.lastDiscovery = Date.now();

    return matches;
  }

  /**
   * Get peer statistics
   */
  getStats(): PeerStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      announcesSent: 0,
      discoveriesMade: 0,
      matchesFound: 0,
      lastAnnounce: 0,
      lastDiscovery: 0,
    };
  }

  /**
   * Create a peer from a description
   */
  static async create(
    id: string,
    description: string,
    embeddingService: EmbeddingService
  ): Promise<VirtualPeer> {
    const peer = new VirtualPeer({ id, description });
    await peer.computeEmbedding(embeddingService);
    return peer;
  }

  /**
   * Create multiple peers from descriptions
   */
  static async createBatch(
    descriptions: string[],
    embeddingService: EmbeddingService,
    idPrefix: string = 'peer'
  ): Promise<VirtualPeer[]> {
    const peers = descriptions.map(
      (desc, i) => new VirtualPeer({ id: `${idPrefix}-${i}`, description: desc })
    );

    // Batch compute embeddings
    const vectors = await embeddingService.computeBatch(descriptions);
    for (let i = 0; i < peers.length; i++) {
      (peers[i] as any).vector = vectors[i];
    }

    return peers;
  }
}

/**
 * Create a new virtual peer
 */
export function createPeer(config: PeerConfig): VirtualPeer {
  return new VirtualPeer(config);
}
