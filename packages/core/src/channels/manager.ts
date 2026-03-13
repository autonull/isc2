/**
 * Channel Management - Environment-agnostic core
 *
 * Provides channel CRUD, activation, and distribution computation.
 * Storage, embedding, and network are injected via interfaces.
 */

import type { Channel, Relation, Distribution } from '../index.js';
import { cosineSimilarity } from '../math/index.js';

/**
 * Maximum number of active channels
 */
export const MAX_ACTIVE_CHANNELS = 5;

/**
 * Maximum number of relations per channel
 */
export const MAX_RELATIONS = 5;

/**
 * Channel distribution with embedding
 */
export interface ChannelDistribution extends Distribution {
  channelID?: string;
}

/**
 * Storage adapter for channels
 */
export interface ChannelStorage {
  getAll(): Promise<Channel[]>;
  get(id: string): Promise<Channel | null>;
  save(channel: Channel): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  computeEmbedding(text: string): Promise<number[]>;
}

/**
 * Network adapter for DHT announcements
 */
export interface ChannelNetwork {
  announceChannel(channel: Channel, distributions: Distribution[]): Promise<void>;
  deactivateChannel(channelID: string): Promise<void>;
}

/**
 * Channel manager configuration
 */
export interface ChannelManagerConfig {
  storage?: ChannelStorage;
  embedding?: EmbeddingProvider;
  network?: ChannelNetwork | null;
}

/**
 * Channel Manager - Manages channel lifecycle and DHT announcements
 */
export class ChannelManager {
  private storage: ChannelStorage;
  private embedding: EmbeddingProvider;
  private network: ChannelNetwork | null = null;
  private activeChannels = new Set<string>();

  constructor(config: ChannelManagerConfig = {}) {
    this.storage = config.storage ?? createDefaultStorage();
    this.embedding = config.embedding ?? createDefaultEmbedding();
    this.network = config.network ?? null;
  }

  /**
   * Set network adapter for DHT operations
   */
  setNetwork(network: ChannelNetwork): void {
    this.network = network;
  }

  /**
   * Set embedding provider
   */
  setEmbedding(embedding: EmbeddingProvider): void {
    this.embedding = embedding;
  }

  /**
   * Create a new channel
   */
  async createChannel(
    name: string,
    description: string,
    spread: number = 0.1,
    relations: Relation[] = []
  ): Promise<Channel> {
    const channel: Channel = {
      id: `ch_${crypto.randomUUID()}`,
      name,
      description,
      spread: Math.max(0, Math.min(0.3, spread)),
      relations: relations.slice(0, MAX_RELATIONS),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: false,
    };

    await this.storage.save(channel);
    return channel;
  }

  /**
   * Get channel by ID
   */
  async getChannel(id: string): Promise<Channel | null> {
    return this.storage.get(id);
  }

  /**
   * Get all channels
   */
  async getAllChannels(): Promise<Channel[]> {
    return this.storage.getAll();
  }

  /**
   * Update channel
   */
  async updateChannel(
    id: string,
    updates: Partial<Omit<Channel, 'id' | 'createdAt'>>
  ): Promise<Channel | null> {
    const channel = await this.storage.get(id);
    if (!channel) return null;

    const updated: Channel = { ...channel, ...updates, updatedAt: Date.now() };
    if (updates.relations) {
      updated.relations = updates.relations.slice(0, MAX_RELATIONS);
    }

    await this.storage.save(updated);

    // Deactivate if active (embeddings changed)
    if (this.activeChannels.has(id) && this.network) {
      await this.network.deactivateChannel(id);
      this.activeChannels.delete(id);
    }

    return updated;
  }

  /**
   * Delete channel
   */
  async deleteChannel(id: string): Promise<void> {
    if (this.activeChannels.has(id) && this.network) {
      await this.network.deactivateChannel(id);
      this.activeChannels.delete(id);
    }
    await this.storage.delete(id);
  }

  /**
   * Activate channel with distributions
   */
  async activateChannel(
    id: string,
    distributions: Distribution[]
  ): Promise<void> {
    const channel = await this.storage.get(id);
    if (!channel) {
      throw new Error(`Channel ${id} not found`);
    }

    if (this.activeChannels.has(id)) {
      return;
    }

    if (this.activeChannels.size >= MAX_ACTIVE_CHANNELS) {
      throw new Error(`Maximum ${MAX_ACTIVE_CHANNELS} active channels allowed`);
    }

    if (!this.network) {
      throw new Error('Network not configured');
    }

    await this.network.announceChannel(channel, distributions);
    this.activeChannels.add(id);
    await this.storage.save({ ...channel, active: true, updatedAt: Date.now() });
  }

  /**
   * Deactivate channel
   */
  async deactivateChannel(id: string): Promise<void> {
    if (!this.activeChannels.has(id)) {
      return;
    }

    if (this.network) {
      await this.network.deactivateChannel(id);
    }
    this.activeChannels.delete(id);

    const channel = await this.storage.get(id);
    if (channel) {
      await this.storage.save({ ...channel, active: false, updatedAt: Date.now() });
    }
  }

  /**
   * Fork channel (create copy)
   */
  async forkChannel(id: string): Promise<Channel | null> {
    const original = await this.storage.get(id);
    if (!original) return null;

    const forked: Channel = {
      ...original,
      id: `ch_${crypto.randomUUID()}`,
      name: `${original.name} (fork)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: false,
    };

    await this.storage.save(forked);
    return forked;
  }

  /**
   * Archive channel (deactivate without deleting)
   */
  async archiveChannel(id: string): Promise<void> {
    await this.deactivateChannel(id);
    const channel = await this.storage.get(id);
    if (channel) {
      await this.storage.save({ ...channel, updatedAt: Date.now() });
    }
  }

  /**
   * Get active channel count
   */
  getActiveChannelCount(): number {
    return this.activeChannels.size;
  }

  /**
   * Check if channel is active
   */
  isActive(id: string): boolean {
    return this.activeChannels.has(id);
  }

  /**
   * Compute channel distributions from embeddings
   */
  async computeDistributions(channel: Channel): Promise<ChannelDistribution[]> {
    const distributions: ChannelDistribution[] = [];

    try {
      // Root distribution from description
      const rootEmbedding = await this.embedding.computeEmbedding(channel.description);
      distributions.push({
        mu: rootEmbedding,
        sigma: channel.spread,
      });

      // Fused distributions for each relation
      for (const relation of channel.relations || []) {
        const composedText = `${channel.description} ${relation.tag.replace(/_/g, ' ')} ${relation.object}`;
        const fusedEmbedding = await this.embedding.computeEmbedding(composedText);

        distributions.push({
          mu: fusedEmbedding,
          sigma: channel.spread / (relation.weight || 1.0),
          tag: relation.tag,
          weight: relation.weight,
        });
      }
    } catch (err) {
      throw new Error(`Failed to compute channel distributions: ${(err as Error).message}`);
    }

    return distributions;
  }

  /**
   * Activate channel with automatic embedding computation
   */
  async activateChannelWithEmbedding(id: string): Promise<void> {
    const channel = await this.getChannel(id);
    if (!channel) {
      throw new Error(`Channel ${id} not found`);
    }

    if (this.activeChannels.has(id)) {
      return;
    }

    if (this.activeChannels.size >= MAX_ACTIVE_CHANNELS) {
      throw new Error(`Maximum ${MAX_ACTIVE_CHANNELS} active channels allowed`);
    }

    if (!this.network) {
      throw new Error('Network not configured');
    }

    const distributions = await this.computeDistributions(channel);
    await this.activateChannel(id, distributions);
  }

  /**
   * Get active channel (first active or first available)
   */
  async getActiveChannel(): Promise<Channel | null> {
    const channels = await this.getAllChannels();
    return channels.find(c => c.active) || channels[0] || null;
  }

  /**
   * Find similar channels based on embedding similarity
   */
  async findSimilarChannels(
    queryEmbedding: number[],
    channel: Channel,
    limit: number = 10
  ): Promise<Array<{ channel: Channel; similarity: number }>> {
    const channels = await this.getAllChannels();
    const otherChannels = channels.filter(c => c.id !== channel.id);

    const scored = await Promise.all(
      otherChannels.map(async c => ({
        channel: c,
        similarity: await this.computeSimilarity(queryEmbedding, c),
      }))
    );

    return scored
      .filter(s => s.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Compute similarity between query and channel
   */
  private async computeSimilarity(queryEmbedding: number[], channel: Channel): Promise<number> {
    if (!channel.distributions || channel.distributions.length === 0) {
      return 0;
    }

    const similarities = channel.distributions.map(dist =>
      cosineSimilarity(queryEmbedding, dist.mu)
    );

    return Math.max(...similarities);
  }
}

/**
 * Default in-memory storage (for environments without persistent storage)
 */
export function createDefaultStorage(): ChannelStorage {
  const store = new Map<string, Channel>();

  return {
    async getAll(): Promise<Channel[]> {
      return Array.from(store.values());
    },
    async get(id: string): Promise<Channel | null> {
      return store.get(id) || null;
    },
    async save(channel: Channel): Promise<void> {
      store.set(channel.id, channel);
    },
    async delete(id: string): Promise<void> {
      store.delete(id);
    },
  };
}

/**
 * Default embedding provider (returns zero vectors - should be overridden)
 */
export function createDefaultEmbedding(): EmbeddingProvider {
  return {
    async computeEmbedding(_text: string): Promise<number[]> {
      // Fallback: return zero vector (384 dimensions)
      console.warn('Using default embedding provider - returning zero vector');
      return new Array(384).fill(0);
    },
  };
}

/**
 * Create channel manager with default configuration
 */
export function createChannelManager(config: ChannelManagerConfig = {}): ChannelManager {
  return new ChannelManager(config);
}
