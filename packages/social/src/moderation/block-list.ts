/**
 * Moderation Service
 *
 * Block list management for peer moderation.
 */

import type { PeerProfile, ModerationAction } from '../types.js';
import type { SocialStorage } from '../adapters/interfaces.js';

export interface ModerationService {
  getBlockedPeers(): Promise<Set<string>>;
  isBlocked(peerId: string): Promise<boolean>;
  block(peerId: string, reason?: string): Promise<void>;
  unblock(peerId: string): Promise<void>;
  filterPeers(peers: PeerProfile[]): Promise<PeerProfile[]>;
  getActions(): Promise<ModerationAction[]>;
}

export function createModerationService(storage: SocialStorage): ModerationService {
  const actions: ModerationAction[] = [];

  return {
    async getBlockedPeers(): Promise<Set<string>> {
      return storage.getBlockedPeers();
    },

    async isBlocked(peerId: string): Promise<boolean> {
      if (!peerId) {return false;}
      const blocked = await this.getBlockedPeers();
      return blocked.has(peerId);
    },

    async block(peerId: string, reason = ''): Promise<void> {
      if (!peerId) {return;}

      const blocked = await this.getBlockedPeers();
      blocked.add(peerId);
      await storage.saveBlockedPeers(blocked);

      actions.push({
        type: 'block',
        peerId,
        reason,
        timestamp: Date.now(),
      });
    },

    async unblock(peerId: string): Promise<void> {
      if (!peerId) {return;}

      const blocked = await this.getBlockedPeers();
      blocked.delete(peerId);
      await storage.saveBlockedPeers(blocked);

      actions.push({
        type: 'unblock',
        peerId,
        timestamp: Date.now(),
      });
    },

    async filterPeers(peers: PeerProfile[]): Promise<PeerProfile[]> {
      const blocked = await this.getBlockedPeers();
      return peers.filter((p) => !blocked.has(p.id));
    },

    async getActions(): Promise<ModerationAction[]> {
      return [...actions];
    },
  };
}
