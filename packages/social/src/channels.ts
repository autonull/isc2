/**
 * Channel Service
 *
 * Channel management operations.
 */

import type { Channel } from '../types';
import type { SocialStorage, SocialNetwork } from '../adapters/interfaces';

export interface CreateChannelInput {
  name: string;
  description: string;
  spread?: number;
  context?: string[];
}

export interface ChannelService {
  create(input: CreateChannelInput): Promise<Channel>;
  getAll(): Promise<Channel[]>;
  getById(id: string): Promise<Channel | null>;
  update(id: string, updates: Partial<Channel>): Promise<void>;
  delete(id: string): Promise<void>;
  activate(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
}

export function createChannelService(
  storage: SocialStorage,
  network?: SocialNetwork
): ChannelService {
  return {
    async create({ name, description, spread = 0.15, context = [] }: CreateChannelInput): Promise<Channel> {
      const channel: Channel = {
        id: `chan_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        name,
        description,
        spread,
        context,
        createdAt: Date.now(),
        active: true,
      };

      await storage.saveChannel(channel);

      if (network) {
        await network.createChannel(name, description);
      }

      return channel;
    },

    async getAll(): Promise<Channel[]> {
      return storage.getChannels();
    },

    async getById(id: string): Promise<Channel | null> {
      const channels = await storage.getChannels();
      return channels.find((c: Channel) => c.id === id) ?? null;
    },

    async update(id: string, updates: Partial<Channel>): Promise<void> {
      const channels = await storage.getChannels();
      const index = channels.findIndex((c: Channel) => c.id === id);
      if (index === -1) throw new Error(`Channel not found: ${id}`);

      channels[index] = { ...channels[index], ...updates };
      await storage.saveChannel(channels[index]);
    },

    async delete(id: string): Promise<void> {
      await storage.deleteChannel(id);
    },

    async activate(id: string): Promise<void> {
      await this.update(id, { active: true });
    },

    async deactivate(id: string): Promise<void> {
      await this.update(id, { active: false });
    },
  };
}
