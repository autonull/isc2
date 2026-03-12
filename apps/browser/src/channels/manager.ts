import type { Channel, Relation } from '@isc/core';
import { DHTClient, openDB, dbGet, dbGetAll, dbPut, dbDelete } from '@isc/adapters';

const MAX_ACTIVE_CHANNELS = 5;
const DB_NAME = 'isc-channels';
const DB_VERSION = 1;
const MAX_RELATIONS = 5;

export interface ChannelStore {
  getAll(): Promise<Channel[]>;
  get(id: string): Promise<Channel | null>;
  save(channel: Channel): Promise<void>;
  delete(id: string): Promise<void>;
}

class IndexedDBChannelStore implements ChannelStore {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    this.db = await openDB(DB_NAME, DB_VERSION, (database) => {
      if (!database.objectStoreNames.contains('channels')) {
        database.createObjectStore('channels', { keyPath: 'id' });
      }
    });
    return this.db;
  }

  async getAll(): Promise<Channel[]> {
    const db = await this.getDB();
    return dbGetAll<Channel>(db, 'channels');
  }

  async get(id: string): Promise<Channel | null> {
    const db = await this.getDB();
    return dbGet<Channel>(db, 'channels', id);
  }

  async save(channel: Channel): Promise<void> {
    const db = await this.getDB();
    await dbPut(db, 'channels', channel);
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    await dbDelete(db, 'channels', id);
  }
}

export interface ChannelManagerConfig {
  store?: ChannelStore;
  dhtClient?: DHTClient;
}

export class ChannelManager {
  private store: ChannelStore;
  private dhtClient: DHTClient | null = null;
  private activeChannels = new Set<string>();

  constructor(config: ChannelManagerConfig = {}) {
    this.store = config.store ?? new IndexedDBChannelStore();
    this.dhtClient = config.dhtClient ?? null;
  }

  setDHTClient(client: DHTClient): void {
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
    if (this.activeChannels.has(id) && this.dhtClient) {
      await this.dhtClient.deactivateChannel(id);
    }
    return updated;
  }

  async deleteChannel(id: string): Promise<void> {
    if (this.activeChannels.has(id) && this.dhtClient) {
      await this.dhtClient.deactivateChannel(id);
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
    if (!this.dhtClient) throw new Error('DHT client not configured');

    await this.dhtClient.announceChannel(channel, distributions);
    this.activeChannels.add(id);
    await this.store.save({ ...channel, active: true, updatedAt: Date.now() });
  }

  async deactivateChannel(id: string): Promise<void> {
    if (!this.activeChannels.has(id)) return;
    if (this.dhtClient) await this.dhtClient.deactivateChannel(id);
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
