/**
 * Appeal Service - Manages appeal lifecycle
 */

import { sign, encode } from '@isc/core';
import { DelegationClient } from '../../delegation/fallback.js';
import { dbGet, dbPut, dbFilter } from '../../db/helpers.js';
import { getPeerID, getKeypair } from '../../identity/index.js';
import { COURT_CONFIG } from '../config/courtConfig.js';
import type { AppealCase } from '../models/appeal.js';

/**
 * Create an appeal for a moderation decision
 */
export async function createAppeal(
  reportId: string,
  reason: string,
  evidence: string[] = []
): Promise<AppealCase> {
  const appellant = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const appeal: Omit<AppealCase, 'signature'> = {
    id: `appeal_${crypto.randomUUID()}`,
    reportId,
    appellant,
    reason,
    evidence,
    timestamp: Date.now(),
    status: 'pending',
  };

  const payload = encode(appeal);
  const signatureObj = await sign(payload, keypair.privateKey);
  const signature = signatureObj.data;

  const signedAppeal: AppealCase = { ...appeal, signature };

  await dbPut(COURT_CONFIG.stores.APPEALS, signedAppeal);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `${COURT_CONFIG.dht.APPEAL_PREFIX}/${signedAppeal.id}`;
    await client.announce(key, encode(signedAppeal), COURT_CONFIG.timing.DEFAULT_VOTE_DURATION_MS / 1000);
  }

  return signedAppeal;
}

/**
 * Get appeal by ID
 */
export async function getAppeal(appealId: string): Promise<AppealCase | null> {
  return dbGet<AppealCase>(COURT_CONFIG.stores.APPEALS, appealId);
}

/**
 * Get all pending appeals
 */
export async function getPendingAppeals(): Promise<AppealCase[]> {
  return dbFilter<AppealCase>(COURT_CONFIG.stores.APPEALS, (a) => a.status === 'pending');
}

/**
 * Get appeals for a specific user
 */
export async function getAppealsByUser(peerID: string): Promise<AppealCase[]> {
  return dbFilter<AppealCase>(COURT_CONFIG.stores.APPEALS, (a) => a.appellant === peerID);
}
