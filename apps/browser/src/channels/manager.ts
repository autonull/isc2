/* eslint-disable */
import type { Channel, Relation } from '@isc/core';
import { getDB, dbGet, dbGetAll, dbPut, dbDelete } from '../db/factory.ts';
import { loggers } from '../utils/logger.ts';
import type { RealDHTClient } from '../network/dht.ts';

const logger = loggers.channel;

const MAX_ACTIVE_CHANNELS = 5;
const DB_NAME = 'isc-channels';
const DB_VERSION = 1;
const MAX_RELATIONS = 5;
const CHANNEL_STORE = 'channels';

export interface ChannelStore {
  getAll(): Promise<Channel[]>;
  get(id: string): Promise<Channel | null>;
  save(channel: Channel): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ChannelDistribution {
  mu: number[];
  sigma: number;
  tag?: string;
  weight?: number;
}

class IndexedDBChannelStore implements ChannelStore {
  private async getDB(): Promise<IDBDatabase> {
    return getDB(DB_NAME, DB_VERSION, [CHANNEL_STORE]);
  }

  async getAll(): Promise<Channel[]> {
    const db = await this.getDB();
    return dbGetAll<Channel>(db, CHANNEL_STORE);
  }

  async get(id: string): Promise<Channel | null> {
    const db = await this.getDB();
    return dbGet<Channel>(db, CHANNEL_STORE, id);
  }

  async save(channel: Channel): Promise<void> {
    const db = await this.getDB();
    await dbPut(db, CHANNEL_STORE, channel);
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    await dbDelete(db, CHANNEL_STORE, id);
  }
}

export interface ChannelManagerConfig {
  store?: ChannelStore;
  dhtClient?: RealDHTClient | null;
}

export class ChannelManager {
  private store: ChannelStore;
  private dhtClient: RealDHTClient | null = null;
  private activeChannels = new Set<string>();

  constructor(config: ChannelManagerConfig = {}) {
    this.store = config.store ?? new IndexedDBChannelStore();
    this.dhtClient = config.dhtClient ?? null;
  }

  setDHTClient(client: RealDHTClient | null): void {
    this.dhtClient = client;
  }

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
    await this.store.save(channel);
    return channel;
  }

  async getChannel(id: string): Promise<Channel | null> {
    return this.store.get(id);
  }

  async getAllChannels(): Promise<Channel[]> {
    return this.store.getAll();
  }

  async updateChannel(
    id: string,
    updates: Partial<Omit<Channel, 'id' | 'createdAt'>>
  ): Promise<Channel | null> {
    const channel = await this.store.get(id);
    if (!channel) return null;

    const updated: Channel = { ...channel, ...updates, updatedAt: Date.now() };
    if (updates.relations) updated.relations = updates.relations.slice(0, MAX_RELATIONS);

    await this.store.save(updated);
    // RealDHTClient doesn't have deactivateChannel, just remove from active set
    if (this.activeChannels.has(id)) {
      this.activeChannels.delete(id);
    }
    return updated;
  }

  async deleteChannel(id: string): Promise<void> {
    if (this.activeChannels.has(id)) {
      this.activeChannels.delete(id);
    }
    await this.store.delete(id);
  }

  async activateChannel(
    id: string,
    distributions: { mu: number[]; sigma: number }[]
  ): Promise<void> {
    const channel = await this.store.get(id);
    if (!channel) throw new Error(`Channel ${id} not found`);
    if (this.activeChannels.has(id)) return;
    if (this.activeChannels.size >= MAX_ACTIVE_CHANNELS) {
      throw new Error(`Maximum ${MAX_ACTIVE_CHANNELS} active channels allowed`);
    }
    
    // DHT is optional - allow local-only activation
    if (!this.dhtClient) {
      logger.warn('No DHT client configured, activating channel locally only');
      this.activeChannels.add(id);
      await this.store.save({ ...channel, active: true, updatedAt: Date.now() });
      return;
    }

    try {
      // Use RealDHTClient's announce method directly
      const rootDist = distributions[0];
      if (!rootDist) throw new Error('No root distribution');

      const { lshHash } = await import('@isc/core');
      const modelHash = 'XenovaallMiniLM'.slice(0, 12);
      const hashes = lshHash(rootDist.mu, modelHash, 8, 16);

      const announcement = {
        peerID: this.dhtClient.getPeerId(),
        channelID: channel.id,
        model: 'Xenova/all-MiniLM-L6-v2',
        vec: rootDist.mu,
        ttl: 300,
        updatedAt: Date.now(),
      };

      const encoded = new TextEncoder().encode(JSON.stringify(announcement));
      for (const hash of hashes) {
        const key = `/isc/announce/${modelHash}/${hash}`;
        await this.dhtClient.announce(key, encoded, 300);
      }

      this.activeChannels.add(id);
      await this.store.save({ ...channel, active: true, updatedAt: Date.now() });
    } catch (err) {
      logger.warn('Failed to announce to DHT, activating locally', { error: (err as Error).message });
      // Still activate locally even if DHT fails
      this.activeChannels.add(id);
      await this.store.save({ ...channel, active: true, updatedAt: Date.now() });
    }
  }

  async deactivateChannel(id: string): Promise<void> {
    if (!this.activeChannels.has(id)) return;
    // RealDHTClient doesn't have deactivateChannel, just remove from active set
    this.activeChannels.delete(id);

    const channel = await this.store.get(id);
    if (channel) await this.store.save({ ...channel, active: false, updatedAt: Date.now() });
  }

  async forkChannel(id: string): Promise<Channel | null> {
    const original = await this.store.get(id);
    if (!original) return null;

    const forked: Channel = {
      ...original,
      id: `ch_${crypto.randomUUID()}`,
      name: `${original.name} (fork)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      active: false,
    };
    await this.store.save(forked);
    return forked;
  }

  async archiveChannel(id: string): Promise<void> {
    await this.deactivateChannel(id);
    const channel = await this.store.get(id);
    if (channel) await this.store.save({ ...channel, updatedAt: Date.now() });
  }

  getActiveChannelCount(): number {
    return this.activeChannels.size;
  }

  isActive(id: string): boolean {
    return this.activeChannels.has(id);
  }

  /**
   * Compute channel distributions using embeddings
   * Uses fallback embedding if ML model not available
   */
  async computeChannelDistributions(channel: Channel): Promise<ChannelDistribution[]> {
    const distributions: ChannelDistribution[] = [];

    try {
      // Use simple fallback embedding (no ML model required)
      const { computeEmbedding } = await import('../utils/embeddingFallback.ts');
      
      // Root distribution from description
      const rootEmbedding = await computeEmbedding(channel.description);
      distributions.push({
        mu: rootEmbedding,
        sigma: channel.spread,
      });

      // Fused distributions for each relation
      for (const relation of channel.relations || []) {
        const composedText = `${channel.description} ${relation.tag.replace(/_/g, ' ')} ${relation.object || ''}`;
        const fusedEmbedding = await computeEmbedding(composedText);

        distributions.push({
          mu: fusedEmbedding,
          sigma: channel.spread / (relation.weight || 1.0),
          tag: relation.tag,
          weight: relation.weight,
        });
      }
    } catch (err) {
      console.error('[ChannelManager] Failed to compute distributions:', err);
      // Return empty distributions as fallback
      return [];
    }

    return distributions;
  }

  /**
   * Activate channel with automatic embedding computation
   */
  async activateChannelWithEmbedding(id: string): Promise<void> {
    const channel = await this.getChannel(id);
    if (!channel) throw new Error(`Channel ${id} not found`);
    if (this.activeChannels.has(id)) return;
    if (this.activeChannels.size >= MAX_ACTIVE_CHANNELS) {
      throw new Error(`Maximum ${MAX_ACTIVE_CHANNELS} active channels allowed`);
    }

    // Compute distributions using real embeddings
    const distributions = await this.computeChannelDistributions(channel);

    // Activate (DHT announcement is optional)
    await this.activateChannel(id, distributions);
  }
}

export const channelManager = new ChannelManager();

export const getChannel = (id: string): Promise<Channel | null> => channelManager.getChannel(id);

export const updateChannel = (
  id: string,
  updates: Partial<Omit<Channel, 'id' | 'createdAt'>>
): Promise<Channel | null> => channelManager.updateChannel(id, updates);

export const getAllChannels = (): Promise<Channel[]> => channelManager.getAllChannels();

export const getActiveChannel = async (): Promise<Channel | null> => {
  const channels = await channelManager.getAllChannels();
  return channels.find(c => c.active) || channels[0] || null;
};
