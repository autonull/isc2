/* eslint-disable */
/**
 * Appeal Service
 *
 * Manages the lifecycle of moderation appeals.
 */

import { encode } from '@isc/core';
import { COURT_CONFIG } from './config.js';
import type { AppealCase } from './types.js';
import type {
  ModerationStorage,
  ModerationIdentity,
  ModerationNetwork,
} from './adapters.js';

export interface AppealService {
  create(reportId: string, reason: string, evidence?: string[]): Promise<AppealCase>;
  get(id: string): Promise<AppealCase | null>;
  getPending(): Promise<AppealCase[]>;
  getByUser(peerId: string): Promise<AppealCase[]>;
}

export function createAppealService(
  storage: ModerationStorage,
  identity: ModerationIdentity,
  network?: ModerationNetwork
): AppealService {
  return {
    async create(reportId, reason, evidence = []) {
      const appellant = await identity.getPeerId();

      const unsignedAppeal = {
        id: `appeal_${crypto.randomUUID()}`,
        reportId,
        appellant,
        reason,
        evidence,
        timestamp: Date.now(),
        status: 'pending' as const,
      };

      const signature = await identity.sign(encode(unsignedAppeal));
      const appeal: AppealCase = { ...unsignedAppeal, signature };

      await storage.saveAppeal(appeal);

      if (network) {
        const key = `${COURT_CONFIG.dht.APPEAL_PREFIX}/${appeal.id}`;
        await network.announce(
          key,
          encode(appeal),
          COURT_CONFIG.timing.DEFAULT_VOTE_DURATION_MS / 1000
        );
      }

      return appeal;
    },

    async get(id) {
      return storage.getAppeal(id);
    },

    async getPending() {
      return storage.filterAppeals((a) => a.status === 'pending');
    },

    async getByUser(peerId) {
      return storage.filterAppeals((a) => a.appellant === peerId);
    },
  };
}
