/**
 * Moderation Service
 *
 * Block list management for peer moderation.
 */

import { logger } from '../logger.js';

const BLOCKED_PEERS_KEY = 'isc:blocked-peers';
const BLOCK_REASON_PREFIX = 'isc:block-reason:';

function getBlockedPeers() {
  try {
    return new Set(JSON.parse(localStorage.getItem(BLOCKED_PEERS_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export const moderationService = {
  getBlockedPeers,

  isBlocked(peerId) {
    return Boolean(peerId && getBlockedPeers().has(peerId));
  },

  block(peerId, reason = '') {
    if (!peerId) return;
    const blocked = getBlockedPeers();
    blocked.add(peerId);
    localStorage.setItem(BLOCKED_PEERS_KEY, JSON.stringify([...blocked]));
    localStorage.setItem(`${BLOCK_REASON_PREFIX}${peerId}`, reason);
    logger.info('Peer blocked', { peerId, reason });
  },

  unblock(peerId) {
    if (!peerId) return;
    const blocked = getBlockedPeers();
    blocked.delete(peerId);
    localStorage.setItem(BLOCKED_PEERS_KEY, JSON.stringify([...blocked]));
    localStorage.removeItem(`${BLOCK_REASON_PREFIX}${peerId}`);
    logger.info('Peer unblocked', { peerId });
  },

  getBlockReason(peerId) {
    return localStorage.getItem(`${BLOCK_REASON_PREFIX}${peerId}`) || '';
  },

  filterMatches(matches) {
    const blocked = getBlockedPeers();
    return matches.filter(m => !blocked.has(m.peerId));
  },
};
