/* eslint-disable */
/**
 * Batch Proof Service - Handles batch proof operations
 */

import { dbFilter } from '../../db/helpers.ts';
import { ZK_STORES, ZK_PROTOCOL } from '../config/zkConfig.ts';
import type { Embedding, ProximityProof, VerificationResult } from '../models/proof.ts';
import { generateProximityProof } from './ProofGeneratorService.ts';
import { verifyProximityProof } from './ProofVerifierService.ts';

/**
 * Batch generate proofs for multiple embeddings
 */
export async function generateBatchProofs(
  embeddings: Embedding[],
  referenceEmbedding: Embedding,
  threshold: number = ZK_PROTOCOL.CHANNEL_RELEVANCE_THRESHOLD
): Promise<ProximityProof[]> {
  return Promise.all(
    embeddings.map(embedding => generateProximityProof(embedding, referenceEmbedding, threshold))
  );
}

/**
 * Verify batch of proofs
 */
export async function verifyBatchProofs(
  proofs: ProximityProof[]
): Promise<VerificationResult[]> {
  return Promise.all(proofs.map(verifyProximityProof));
}

/**
 * Get all stored proofs
 */
export async function getAllProofs(): Promise<ProximityProof[]> {
  return dbFilter<ProximityProof>(ZK_STORES.PROOFS, () => true);
}

/**
 * Get proofs by prover
 */
export async function getProofsByProver(prover: string): Promise<ProximityProof[]> {
  return dbFilter<ProximityProof>(ZK_STORES.PROOFS, (p) => p.prover === prover);
}

/**
 * Get verified proofs only
 */
export async function getVerifiedProofs(): Promise<ProximityProof[]> {
  return dbFilter<ProximityProof>(ZK_STORES.PROOFS, (p) => p.verified);
}
