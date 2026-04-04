/* eslint-disable */
/**
 * Identity Service
 *
 * Identity management operations.
 */

import { networkService } from './network.ts';
import { logger } from '../logger.js';
import { actions } from '../state.js';

export const identityService = {
  getIdentity() {
    return networkService.getIdentity();
  },

  async update(updates) {
    try {
      await networkService.updateIdentity(updates);
      logger.info('Identity updated', { updates: Object.keys(updates) });
    } catch (err) {
      logger.error('Identity update failed', { error: err.message });
      throw err;
    }
  },

  export() {
    const identity = this.getIdentity();
    if (!identity) return null;

    return {
      name: identity.name,
      bio: identity.bio,
      peerId: identity.peerId ?? identity.pubkey,
      exportedAt: new Date().toISOString(),
    };
  },

  async import(identityData) {
    try {
      await networkService.updateIdentity({
        name: identityData.name,
        bio: identityData.bio,
      });
      logger.info('Identity imported');
    } catch (err) {
      logger.error('Identity import failed', { error: err.message });
      throw err;
    }
  },

  getFingerprint() {
    const identity = this.getIdentity();
    const id = identity?.peerId ?? identity?.pubkey;
    if (!id) return null;
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  },

  async clear() {
    await networkService.clearIdentity();
    actions.setIdentity(null);
    logger.info('Identity cleared');
  },
};
