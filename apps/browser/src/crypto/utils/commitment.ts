/**
 * Commitment utilities for ZK proofs
 */

import { encode } from '@isc/core';
import type { Embedding } from '../models/proof.js';
import type { ZKConfig } from '../config/zkConfig.js';

/**
 * Generate a random salt for commitments
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Hash function for commitments (SHA-256 based)
 */
export async function hashCommitment(data: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const combined = new Uint8Array(data.length + salt.length);
  combined.set(data);
  combined.set(salt, data.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined.buffer as ArrayBuffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Convert embedding to bytes for hashing
 */
export function embeddingToBytes(embedding: Embedding): Uint8Array {
  const float32Array = new Float32Array(embedding);
  return new Uint8Array(float32Array.buffer);
}

/**
 * Convert bytes back to embedding
 */
export function bytesToEmbedding(bytes: Uint8Array): Embedding {
  const float32Array = new Float32Array(bytes.buffer);
  return Array.from(float32Array);
}

/**
 * Normalize an embedding vector
 */
export function normalize(embedding: Embedding): Embedding {
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map((v) => v / norm);
}

/**
 * Generate verification key hash
 */
export async function hashVerificationKey(config: ZKConfig): Promise<string> {
  const keyData = encode({
    dimensions: config.dimensions,
    securityBits: config.securityBits,
    protocol: 'zk-similarity-v1',
  });

  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData.buffer as ArrayBuffer);
  const hashArray = new Uint8Array(hashBuffer);

  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
