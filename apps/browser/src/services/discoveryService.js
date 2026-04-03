/**
 * Discovery Service
 *
 * Peer discovery and matching.
 */

import { networkService } from './network.ts';
import { moderationService } from './moderationService.js';
import { logger } from '../logger.js';
import { getState } from '../state.js';

export const discoveryService = {
  getMatches() {
    let matches = getState().matches ?? [];
    matches = moderationService.filterMatches(matches);
    return matches;
  },

  async discoverPeers() {
    try {
      await networkService.discoverPeers();
      logger.info('Peer discovery initiated');
      const matches = this.getMatches();
      if (matches.length > 0) {
        document.dispatchEvent(new CustomEvent('isc:peers-found', { detail: { count: matches.length } }));
      }
    } catch (err) {
      logger.error('Peer discovery failed', { error: err.message });
      throw err;
    }
  },

  async connect(peerId) {
    try {
      await networkService.service?.connectPeer?.(peerId);
      logger.info('Connected to peer', { peerId });
    } catch (err) {
      logger.error('Peer connection failed', { error: err.message });
      throw err;
    }
  },

  search(query) {
    const matches = this.getMatches();
    if (!query) return matches;

    const q = query.toLowerCase();
    return matches.filter(m =>
      m.identity?.name?.toLowerCase().includes(q) ||
      m.identity?.bio?.toLowerCase().includes(q),
    );
  },
};
