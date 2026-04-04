/* eslint-disable */
/**
 * Channel Service
 *
 * Channel management operations.
 */

import { networkService } from './network.ts';
import { logger } from '../logger.js';
import { actions, getState } from '../state.js';

export const channelService = {
  async create(name, description, spread = 0.15, context = []) {
    try {
      const channel = await networkService.createChannel(name, description, { spread, context });
      logger.info('Channel created', { id: channel.id, name: channel.name });
      if (!getState().activeChannelId) {
        actions.setActiveChannel(channel.id);
      }
      document.dispatchEvent(new CustomEvent('isc:channel-created'));
      return channel;
    } catch (err) {
      logger.error('Channel creation failed', { error: err.message });
      throw err;
    }
  },

  async update(channelId, { name, description }) {
    try {
      await networkService.service?.updateChannel?.(channelId, { name, description });
      actions.setChannels(networkService.getChannels());
      logger.info('Channel updated', { channelId, name });
    } catch (err) {
      logger.error('Channel update failed', { error: err.message });
      throw err;
    }
  },

  async delete(channelId) {
    try {
      await networkService.deleteChannel(channelId);
      logger.info('Channel deleted', { channelId });
    } catch (err) {
      logger.error('Channel deletion failed', { error: err.message });
      throw err;
    }
  },

  getAll() {
    return networkService.getChannels();
  },

  getById(channelId) {
    return networkService.getChannels().find(c => c.id === channelId);
  },

  async activate(channelId) {
    try {
      await networkService.service?.activateChannel?.(channelId);
      logger.info('Channel activated', { channelId });
    } catch (err) {
      logger.error('Channel activation failed', { error: err.message });
      throw err;
    }
  },

  async deactivate(channelId) {
    try {
      await networkService.service?.deactivateChannel?.(channelId);
      logger.info('Channel deactivated', { channelId });
    } catch (err) {
      logger.error('Channel deactivation failed', { error: err.message });
      throw err;
    }
  },
};
