/**
 * Proof Utilities - Import/Export and benchmarking
 */

import { encode } from '@isc/core';
import { ZK_PROTOCOL, ZK_CONFIG } from '../config/zkConfig.js';
import type {
  Embedding,
  ProximityProof,
  SerializableProof,
} from '../models/proof.js';
import { generateProximityProof } from './ProofGeneratorService.js';
import { verifyProximityProof } from './ProofVerifierService.js';
import { normalize } from '../utils/commitment.js';

/**
 * Export proof for sharing
 */
export function exportProof(proof: ProximityProof): SerializableProof {
  return {
    id: proof.id,
    commitmentA: Array.from(proof.commitmentA),
    commitmentB: Array.from(proof.commitmentB),
    proofData: {
      protocol: proof.proofData.protocol,
      publicInputs: Array.from(proof.proofData.publicInputs),
      proof: Array.from(proof.proofData.proof),
      verificationKeyHash: proof.proofData.verificationKeyHash,
    },
    threshold: proof.threshold,
    verified: proof.verified,
    createdAt: proof.createdAt,
  };
}

/**
 * Import proof from serialized format
 */
export function importProof(serialized: SerializableProof): ProximityProof {
  return {
    id: serialized.id,
    commitmentA: new Uint8Array(serialized.commitmentA),
    commitmentB: new Uint8Array(serialized.commitmentB),
    proofData: {
      protocol: ZK_PROTOCOL.NAME,
      publicInputs: new Uint8Array(serialized.proofData.publicInputs),
      proof: new Uint8Array(serialized.proofData.proof),
      verificationKeyHash: serialized.proofData.verificationKeyHash,
    },
    threshold: serialized.threshold,
    actualSimilarity: 0,
    verified: serialized.verified,
    createdAt: serialized.createdAt,
    prover: 'imported',
  };
}

/**
 * Performance benchmark for proof generation
 */
export async function benchmarkProofGeneration(
  dimensions: number = 384
): Promise<{
  dimensions: number;
  generationTimeMs: number;
  verificationTimeMs: number;
  proofSize: number;
}> {
  const embeddingA = Array.from({ length: dimensions }, () => Math.random());
  const embeddingB = Array.from({ length: dimensions }, () => Math.random());

  const normA = normalize(embeddingA);
  const normB = normalize(embeddingB);

  const genStart = performance.now();
  const proof = await generateProximityProof(normA, normB, 0.5);
  const genEnd = performance.now();

  const verifyStart = performance.now();
  await verifyProximityProof(proof);
  const verifyEnd = performance.now();

  const proofSize =
    proof.proofData.proof.length +
    proof.proofData.publicInputs.length +
    proof.commitmentA.length +
    proof.commitmentB.length;

  return {
    dimensions,
    generationTimeMs: genEnd - genStart,
    verificationTimeMs: verifyEnd - verifyStart,
    proofSize,
  };
}
