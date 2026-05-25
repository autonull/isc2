/* eslint-disable */
/**
 * ISC Phase P3.1: RLN (Rate Limiting Nullifier) Proof Generation and Verification
 *
 * RLN allows a peer to prove "I have not exceeded my epoch quota" without revealing identity.
 * This module provides the type definitions, WASM scaffolding, and Web Worker integration.
 *
 * WASM Integration Points:
 * - WASM module loaded lazily via dynamic import
 * - Web Worker used for proof generation to avoid blocking main thread
 * - Proof generation estimated ~150ms on mid-tier devices
 *
 * TODO for full implementation:
 * - Integrate @rln-js/rln WASM build when available
 * - Implement proper ZK proof circuit
 * - Add merkle tree membership verification
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

export interface RLNWASMModule {
  generateProof: (request: RLNProofRequest) => Promise<RLNProof>;
  verifyProof: (proof: RLNProof) => Promise<RLNVerificationResult>;
  destroy: () => void;
}

const EPOCH_DURATION_MS = 60_000;
const proofsByEpoch = new Map<number, Set<string>>();

let wasmModule: RLNWASMModule | null = null;
let rlnWorker: Worker | null = null;

export function isWASMLoaded(): boolean {
  return wasmModule !== null;
}

export async function loadRLNWASM(): Promise<void> {
  if (wasmModule) {return;}

  try {
    const wasmUrl = await getRLNWASMUrl();
    if (!wasmUrl) {
      console.debug('[RLN] No WASM module URL configured, using stub implementation');
      return;
    }

    rlnWorker = new Worker(wasmUrl);
    wasmModule = {
      generateProof: async (request) => {
        return new Promise((resolve, reject) => {
          if (!rlnWorker) {
            reject(new Error('RLN Worker not initialized'));
            return;
          }

          const handler = (event: MessageEvent) => {
            const data = event.data as Record<string, unknown>;
            if (data.type === 'rln_proof_result') {
              rlnWorker!.removeEventListener('message', handler);
              resolve(data.proof as RLNProof);
            } else if (data.type === 'rln_proof_error') {
              rlnWorker!.removeEventListener('message', handler);
              reject(new Error(String(data.error)));
            }
          };

          rlnWorker.addEventListener('message', handler);
          rlnWorker.postMessage({ type: 'generate_proof', request });
        });
      },
      verifyProof: async (_proof) => {
        return new Promise((resolve) => {
          resolve({ valid: true });
        });
      },
      destroy: () => {
        rlnWorker?.terminate();
        rlnWorker = null;
        wasmModule = null;
      },
    };

    console.debug('[RLN] WASM module loaded');
  } catch (err) {
    console.warn('[RLN] Failed to load WASM module, using stub:', err);
  }
}

function getRLNWASMUrl(): Promise<string | null> {
  return Promise.resolve(null);
}

export async function generateRLNProof(
  epoch: number,
  rateSlot: number,
  config: RLNConfig
): Promise<RLNProof> {
  if (!isRLNRequired(getSecurityTier())) {
    throw new Error('RLN proofs only required on Tier 2');
  }

  if (!proofsByEpoch.has(epoch)) {
    proofsByEpoch.set(epoch, new Set());
  }

  const epochProofs = proofsByEpoch.get(epoch)!;
  if (epochProofs.size >= config.rateLimit) {
    throw new Error('RLN quota exceeded for this epoch');
  }

  if (wasmModule) {
    try {
      const request: RLNProofRequest = {
        epoch,
        rateSlot,
        signal: crypto.getRandomValues(new Uint8Array(32)),
        shareX: crypto.getRandomValues(new Uint8Array(32)),
        shareY: crypto.getRandomValues(new Uint8Array(32)),
        nullifier: crypto.getRandomValues(new Uint8Array(32)),
      };
      const proof = await wasmModule.generateProof(request);
      epochProofs.add(proof.internalNullifier);
      return proof;
    } catch (err) {
      console.debug('[RLN] WASM proof generation failed, using stub:', err);
    }
  }

  return generateStubProof(epoch, config, epochProofs);
}

function generateStubProof(epoch: number, config: RLNConfig, epochProofs: Set<string>): RLNProof {
  const nullifier = crypto.getRandomValues(new Uint8Array(32));
  const zA = crypto.getRandomValues(new Uint8Array(32));
  const zB = crypto.getRandomValues(new Uint8Array(32));
  const internalNullifier = crypto.getRandomValues(new Uint8Array(32));

  epochProofs.add(arrayToHex(nullifier));

  return {
    zA: arrayToHex(zA),
    zB: arrayToHex(zB),
    internalNullifier: arrayToHex(internalNullifier),
    chainID: config.chainID,
    epoch,
  };
}

export async function verifyRLNProof(
  proof: RLNProof,
  config: RLNConfig
): Promise<RLNVerificationResult> {
  if (!isRLNRequired(getSecurityTier())) {
    return { valid: true };
  }

  if (!proof.zA || !proof.zB || !proof.internalNullifier) {
    return { valid: false, reason: 'Missing proof fields' };
  }

  if (proof.epoch !== config.epoch) {
    return { valid: false, reason: 'Epoch mismatch' };
  }

  if (proof.chainID !== config.chainID) {
    return { valid: false, reason: 'Chain ID mismatch' };
  }

  if (wasmModule) {
    return wasmModule.verifyProof(proof);
  }

  return { valid: true };
}

export function getEpochRemainingQuota(epoch: number): number {
  const proofs = proofsByEpoch.get(epoch);
  if (!proofs) {return 5;}
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

export function shutdownRLN(): void {
  wasmModule?.destroy();
  wasmModule = null;
  rlnWorker = null;
}

function arrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
