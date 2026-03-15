/**
 * Channel Service
 * 
 * Business logic layer for channel operations.
 * Wraps ChannelManager with additional UI-friendly functionality.
 */

import type { Channel, Relation } from '@isc/core';
import type { ChannelManager } from '../channels/manager.js';

export interface CreateChannelInput {
  name: string;
  description: string;
  spread?: number;
  relations?: Relation[];
}

export interface ChannelService {
  createChannel(input: CreateChannelInput): Promise<Channel>;
  getChannel(id: string): Promise<Channel | null>;
  getAllChannels(): Promise<Channel[]>;
  getActiveChannels(): Promise<Channel[]>;
  updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | null>;
  deleteChannel(id: string): Promise<void>;
  activateChannel(id: string): Promise<void>;
  deactivateChannel(id: string): Promise<void>;
  getChannelCount(): number;
}

export function createChannelService(channelManager: ChannelManager): ChannelService {
  return {
    async createChannel(input: CreateChannelInput): Promise<Channel> {
      // Validate input
      if (!input.name || input.name.trim().length < 3) {
        throw new Error('Channel name must be at least 3 characters');
      }
      
      if (!input.description || input.description.trim().length < 10) {
        throw new Error('Channel description must be at least 10 characters');
      }
      
      if (input.spread !== undefined && (input.spread < 0 || input.spread > 100)) {
        throw new Error('Spread must be between 0 and 100');
      }

      // Create the channel
      const channel = await channelManager.createChannel(
        input.name.trim(),
        input.description.trim(),
        input.spread ?? 50,
        input.relations ?? []
      );

      // Auto-activate if under the limit
      const activeCount = channelManager.getActiveChannelCount();
      if (activeCount < 5) {
        await channelManager.activateChannel(channel.id, []);
      }

      return channel;
    },

    async getChannel(id: string): Promise<Channel | null> {
      return channelManager.getChannel(id);
    },

    async getAllChannels(): Promise<Channel[]> {
      const channels = await channelManager.getAllChannels();
      return channels.sort((a, b) => b.createdAt - a.createdAt);
    },

    async getActiveChannels(): Promise<Channel[]> {
      const channels = await channelManager.getAllChannels();
      return channels.filter(c => channelManager.isActive(c.id));
    },

    async updateChannel(id: string, updates: Partial<Channel>): Promise<Channel | null> {
      const channel = await channelManager.getChannel(id);
      if (!channel) return null;

      const updated = { ...channel, ...updates, updatedAt: Date.now() };
      await channelManager.updateChannel(id, updates);
      return updated;
    },

    async deleteChannel(id: string): Promise<void> {
      await channelManager.deactivateChannel(id);
      await channelManager.deleteChannel(id);
    },

    async activateChannel(id: string): Promise<void> {
      const channels = await channelManager.getAllChannels();
      const activeCount = channels.filter(c => channelManager.isActive(c.id)).length;
      if (activeCount >= 5) {
        throw new Error(`Maximum 5 active channels allowed`);
      }
      
      await channelManager.activateChannel(id, []);
    },

    async deactivateChannel(id: string): Promise<void> {
      await channelManager.deactivateChannel(id);
    },

    getChannelCount(): number {
      // This is a sync method, can't access async getAllChannels
      // Return 0 as placeholder - UI should use getAllChannels directly
      return 0;
    },
  };
}

const MAX_ACTIVE_CHANNELS = 5;

/**
 * Validate channel input
 */
export function validateChannelInput(input: CreateChannelInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || input.name.trim().length < 3) {
    errors.push('Channel name must be at least 3 characters');
  }

  if (input.name && input.name.length > 50) {
    errors.push('Channel name must be less than 50 characters');
  }

  if (!input.description || input.description.trim().length < 10) {
    errors.push('Channel description must be at least 10 characters');
  }

  if (input.description && input.description.length > 500) {
    errors.push('Channel description must be less than 500 characters');
  }

  if (input.spread !== undefined && (input.spread < 0 || input.spread > 100)) {
    errors.push('Spread must be between 0 and 100');
  }

  if (input.relations && input.relations.length > 5) {
    errors.push('Maximum 5 relations allowed');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format channel for display
 */
export function formatChannel(channel: Channel): {
  name: string;
  description: string;
  spread: string;
  relationCount: number;
  createdAt: string;
} {
  return {
    name: channel.name,
    description: channel.description.length > 100 
      ? channel.description.slice(0, 100) + '...' 
      : channel.description,
    spread: `${channel.spread}%`,
    relationCount: channel.relations?.length ?? 0,
    createdAt: new Date(channel.createdAt).toLocaleDateString(),
  };
}
