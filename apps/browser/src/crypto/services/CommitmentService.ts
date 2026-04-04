/* eslint-disable */
/**
 * Commitment Service - Manages embedding commitments
 */

import { dbGet, dbPut } from '../../db/helpers.ts';
import { ZK_STORES } from '../config/zkConfig.ts';
import type { Embedding, EmbeddingCommitment } from '../models/proof.ts';
import { generateSalt, hashCommitment, embeddingToBytes } from '../utils/commitment.ts';

/**
 * Create a commitment to an embedding
 */
export async function createEmbeddingCommitment(
  embedding: Embedding,
  metadata?: { channelId?: string; contentHash?: string }
): Promise<EmbeddingCommitment> {
  const salt = generateSalt();
  const embeddingBytes = embeddingToBytes(embedding);
  const commitmentBytes = await hashCommitment(embeddingBytes, salt);
  const commitment = Buffer.from(commitmentBytes).toString('hex');

  const commitmentObj: EmbeddingCommitment = {
    id: `commit_${crypto.randomUUID()}`,
    commitment,
    salt: Buffer.from(salt).toString('hex'),
    createdAt: Date.now(),
    metadata,
  };

  await dbPut(ZK_STORES.COMMITMENTS, commitmentObj);

  return commitmentObj;
}

/**
 * Get commitment by ID
 */
export async function getCommitment(commitmentId: string): Promise<EmbeddingCommitment | null> {
  return dbGet<EmbeddingCommitment>(ZK_STORES.COMMITMENTS, commitmentId);
}
