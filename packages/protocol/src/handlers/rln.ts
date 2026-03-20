/**
 * ISC Phase P3.1: RLN (Rate Limiting Nullifier) Proof Generation and Verification
 *
 * RLN allows a peer to prove "I have not exceeded my epoch quota" without revealing identity.
 * Full WASM implementation requires @rln-js/rln or snarkjs integration (deferred).
 * This module provides the type definitions, stub implementation, and integration hooks.
 *
 * Full RLN implementation requires:
 * - @rln-js/rln WASM build (~150ms proof generation on mid-tier devices)
 * - Integration via Web Worker to avoid main thread blocking
 * - Epoch/slot management for rate limiting
 */

import type { RLNProof } from '../messages.js';
import { getSecurityTier, isRLNRequired } from '@isc/core';

export interface RLNConfig {
  epoch: number;
  rateLimit: number;
  chainID: number;
  signalMaxLength?: number;
}

export interface RLNProofRequest {
  epoch: number;
  rateSlot: number;
  signal: Uint8Array;
  shareX: Uint8Array;
  shareY: Uint8Array;
  nullifier: Uint8Array;
}

export interface RLNVerificationResult {
  valid: boolean;
  reason?: string;
}

const EPOCH_DURATION_MS = 60_000;
const proofsByEpoch = new Map<number, Set<string>>();

export async function generateRLNProof(
  epoch: number,
  _rateSlot: number,
  _config: RLNConfig
): Promise<RLNProof> {
  if (!isRLNRequired(getSecurityTier())) {
    throw new Error('RLN proofs only required on Tier 2');
  }

  if (!proofsByEpoch.has(epoch)) {
    proofsByEpoch.set(epoch, new Set());
  }

  const epochProofs = proofsByEpoch.get(epoch)!;
  if (epochProofs.size >= _config.rateLimit) {
    throw new Error('RLN quota exceeded for this epoch');
  }

  const nullifier = crypto.getRandomValues(new Uint8Array(32));
  const zA = crypto.getRandomValues(new Uint8Array(32));
  const zB = crypto.getRandomValues(new Uint8Array(32));
  const internalNullifier = crypto.getRandomValues(new Uint8Array(32));

  epochProofs.add(arrayToHex(nullifier));

  return {
    zA: arrayToHex(zA),
    zB: arrayToHex(zB),
    internalNullifier: arrayToHex(internalNullifier),
    chainID: _config.chainID,
    epoch,
  };
}

export async function verifyRLNProof(
  proof: RLNProof,
  _config: RLNConfig
): Promise<RLNVerificationResult> {
  if (!isRLNRequired(getSecurityTier())) {
    return { valid: true };
  }

  if (!proof.zA || !proof.zB || !proof.internalNullifier) {
    return { valid: false, reason: 'Missing proof fields' };
  }

  if (proof.epoch !== _config.epoch) {
    return { valid: false, reason: 'Epoch mismatch' };
  }

  if (proof.chainID !== _config.chainID) {
    return { valid: false, reason: 'Chain ID mismatch' };
  }

  return { valid: true };
}

export function getEpochRemainingQuota(epoch: number): number {
  const proofs = proofsByEpoch.get(epoch);
  if (!proofs) return 5;
  return Math.max(0, 5 - proofs.size);
}

export function getCurrentEpoch(): number {
  return Math.floor(Date.now() / EPOCH_DURATION_MS);
}

export function cleanupOldEpochs(): void {
  const current = getCurrentEpoch();
  for (const epoch of proofsByEpoch.keys()) {
    if (epoch < current - 2) {
      proofsByEpoch.delete(epoch);
    }
  }
}

export function getEpochTimeRemaining(): number {
  const now = Date.now();
  const epochStart = Math.floor(now / EPOCH_DURATION_MS) * EPOCH_DURATION_MS;
  return Math.max(0, EPOCH_DURATION_MS - (now - epochStart));
}

function arrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
