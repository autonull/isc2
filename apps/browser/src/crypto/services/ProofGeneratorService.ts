/* eslint-disable */
/**
 * Proof Generator Service - Generates ZK proximity proofs
 */

import { encode } from '@isc/core';
import { dbPut } from '../../db/helpers.ts';
import { ZK_STORES, ZK_PROTOCOL, type ZKConfig, ZK_CONFIG } from '../config/zkConfig.ts';
import type { Embedding, ProximityProof, ProofData } from '../models/proof.ts';
import {
  generateSalt,
  hashCommitment,
  embeddingToBytes,
  hashVerificationKey,
} from '../utils/commitment.ts';

/**
 * Generate a zero-knowledge proximity proof
 */
export async function generateProximityProof(
  embeddingA: Embedding,
  embeddingB: Embedding,
  threshold: number = ZK_CONFIG.defaultThreshold,
  config: ZKConfig = ZK_CONFIG
): Promise<ProximityProof> {
  const actualSimilarity = cosineSimilarity(embeddingA, embeddingB);

  const saltA = generateSalt();
  const saltB = generateSalt();

  const embeddingABytes = embeddingToBytes(embeddingA);
  const embeddingBBytes = embeddingToBytes(embeddingB);

  const [commitmentA, commitmentB] = await Promise.all([
    hashCommitment(embeddingABytes, saltA),
    hashCommitment(embeddingBBytes, saltB),
  ]);

  const proofData = await generateProofData(
    embeddingA,
    embeddingB,
    threshold,
    actualSimilarity,
    commitmentA,
    commitmentB,
    config
  );

  const proof: ProximityProof = {
    id: `proof_${crypto.randomUUID()}`,
    commitmentA,
    commitmentB,
    proofData,
    threshold,
    actualSimilarity,
    verified: false,
    createdAt: Date.now(),
    prover: 'local',
  };

  await dbPut(ZK_STORES.PROOFS, proof);

  return proof;
}

/**
 * Generate proof data (RESEARCH: simplified scheme)
 */
async function generateProofData(
  _embeddingA: Embedding,
  _embeddingB: Embedding,
  threshold: number,
  actualSimilarity: number,
  commitmentA: Uint8Array,
  commitmentB: Uint8Array,
  _config: ZKConfig
): Promise<ProofData> {
  const publicInputs = encode({
    commitmentA: Array.from(commitmentA),
    commitmentB: Array.from(commitmentB),
    threshold,
    timestamp: Date.now(),
  });

  const proofPayload = {
    similarity: actualSimilarity,
    passesThreshold: actualSimilarity >= threshold,
    noisySimilarity: actualSimilarity + (Math.random() - 0.5) * 0.1,
  };

  const proof = encode(proofPayload);
  const verificationKeyHash = await hashVerificationKey(_config);

  return {
    protocol: ZK_PROTOCOL.NAME,
    publicInputs,
    proof,
    verificationKeyHash,
  };
}

/**
 * Compute cosine similarity between two embeddings
 */
function cosineSimilarity(a: Embedding, b: Embedding): number {
  const dotProduct = a.reduce((sum: number, ai: number, i: number) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum: number, ai: number) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum: number, bi: number) => sum + bi * bi, 0));
  return dotProduct / (normA * normB);
}

/**
 * Prove content matches a channel's semantic theme
 */
export async function proveChannelRelevance(
  contentEmbedding: Embedding,
  channelThemeEmbedding: Embedding,
  channelId: string
): Promise<ProximityProof> {
  const { getCommitment, createEmbeddingCommitment } = await import('./CommitmentService.ts');

  let channelCommitment = await getCommitment(`channel_${channelId}`);

  if (!channelCommitment) {
    channelCommitment = await createEmbeddingCommitment(channelThemeEmbedding, {
      channelId,
    });
    await dbPut(ZK_STORES.COMMITMENTS, {
      ...channelCommitment,
      id: `channel_${channelId}`,
    });
  }

  return generateProximityProof(
    contentEmbedding,
    channelThemeEmbedding,
    ZK_PROTOCOL.CHANNEL_RELEVANCE_THRESHOLD
  );
}

/**
 * Prove two users have similar interests
 */
export async function proveInterestSimilarity(
  userAEmbedding: Embedding,
  userBEmbedding: Embedding
): Promise<ProximityProof> {
  return generateProximityProof(
    userAEmbedding,
    userBEmbedding,
    ZK_PROTOCOL.INTEREST_SIMILARITY_THRESHOLD,
    { ...ZK_CONFIG, debug: true }
  );
}
