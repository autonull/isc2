/**
 * Browser Moderation Adapters
 *
 * Concrete implementations of the @isc/social ModerationStorage,
 * ModerationIdentity, ModerationNetwork, ModerationReputation, and
 * CouncilProvider interfaces using browser-specific primitives.
 */

import { sign, encode } from '@isc/core';
import type {
  ModerationStorage,
  ModerationIdentity,
  ModerationNetwork,
  ModerationReputation,
  CouncilProvider,
} from '@isc/social';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbPut, dbFilter, dbGetAll } from '../db/helpers.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { computeReputationCached } from '../reputation/decay.js';
import { getCouncil, isCouncilEligible } from '../social/moderation.js';
import { COURT_CONFIG } from './config/courtConfig.js';

const { APPEALS, JURY, VERDICTS, COURTS } = COURT_CONFIG.stores;

export function createBrowserModerationStorage(): ModerationStorage {
  return {
    // Appeals
    getAppeal: (id) => dbGet(APPEALS, id),
    saveAppeal: (appeal) => dbPut(APPEALS, appeal),
    filterAppeals: (pred) => dbFilter(APPEALS, pred),

    // Juries
    getJury: (id) => dbGet(JURY, id),
    saveJury: (jury) => dbPut(JURY, jury),
    filterJuries: (pred) => dbFilter(JURY, pred),
    getAllJuries: () => dbGetAll(JURY),

    // Verdicts
    getVerdict: (id) => dbGet(VERDICTS, id),
    saveVerdict: (verdict) => dbPut(VERDICTS, verdict),
    getAllVerdicts: () => dbGetAll(VERDICTS),

    // Sessions
    getSession: (id) => dbGet(COURTS, id),
    saveSession: (session) => dbPut(COURTS, session),
  };
}

export function createBrowserModerationIdentity(): ModerationIdentity {
  return {
    async getPeerId() {
      return getPeerID();
    },
    async sign(payload: Uint8Array) {
      const keypair = getKeypair();
      if (!keypair) throw new Error('Identity not initialized');
      const result = await sign(payload, keypair.privateKey);
      return result.data;
    },
  };
}

export function createBrowserModerationNetwork(): ModerationNetwork {
  return {
    async announce(key, value, ttlSeconds) {
      const client = DelegationClient.getInstance();
      if (client) await client.announce(key, value, ttlSeconds);
    },
  };
}

export function createBrowserModerationReputation(): ModerationReputation {
  return {
    async getScore(peerId) {
      const rep = await computeReputationCached(peerId);
      return rep.sybilAdjustedScore;
    },
  };
}

export function createBrowserCouncilProvider(): CouncilProvider {
  return {
    async getCouncil(councilId) {
      return getCouncil(councilId);
    },
    async isEligible(memberId, reputationThreshold) {
      return isCouncilEligible(memberId, reputationThreshold);
    },
  };
}
