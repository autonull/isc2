/* eslint-disable */
/**
 * Proof Verifier Service - Verifies ZK proximity proofs
 */

import { decode } from '@isc/core';
import { dbPut } from '../../db/helpers.ts';
import { ZK_STORES, ZK_PROTOCOL, type ZKConfig, ZK_CONFIG } from '../config/zkConfig.ts';
import type { ProximityProof, VerificationResult } from '../models/proof.ts';
import { hashVerificationKey } from '../utils/commitment.ts';

/**
 * Verify a proximity proof
 */
export async function verifyProximityProof(
  proof: ProximityProof,
  config: ZKConfig = ZK_CONFIG
): Promise<VerificationResult> {
  try {
    if (proof.proofData.protocol !== ZK_PROTOCOL.NAME) {
      return {
        valid: false,
        similarityRange: { min: 0, max: 0 },
        confidence: 0,
        error: 'Unknown proof protocol',
      };
    }

    const expectedKeyHash = await hashVerificationKey(config);
    if (proof.proofData.verificationKeyHash !== expectedKeyHash) {
      return {
        valid: false,
        similarityRange: { min: 0, max: 0 },
        confidence: 0,
        error: 'Verification key mismatch',
      };
    }

    const decodedProof = decode(proof.proofData.proof) as {
      similarity: number;
      passesThreshold: boolean;
      noisySimilarity: number;
    };

    const noiseMargin = ZK_PROTOCOL.NOISE_MARGIN;
    const minSimilarity = Math.max(0, decodedProof.noisySimilarity - noiseMargin);
    const maxSimilarity = Math.min(1, decodedProof.noisySimilarity + noiseMargin);

    const passesThreshold = minSimilarity >= proof.threshold;

    proof.verified = passesThreshold;

    await dbPut(ZK_STORES.PROOFS, proof);

    return {
      valid: passesThreshold,
      similarityRange: {
        min: minSimilarity,
        max: maxSimilarity,
      },
      confidence: ZK_PROTOCOL.DEFAULT_CONFIDENCE,
    };
  } catch (error) {
    return {
      valid: false,
      similarityRange: { min: 0, max: 0 },
      confidence: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
