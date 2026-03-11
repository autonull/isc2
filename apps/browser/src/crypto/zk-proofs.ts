/**
 * Zero-Knowledge Proximity Proofs (Research)
 *
 * Experimental implementation for proving semantic similarity
 * without revealing the underlying embedding vectors.
 *
 * This enables privacy-preserving content matching where users
 * can prove their content is similar to a topic without exposing
 * the actual semantic vectors.
 *
 * References: NEXT_STEPS.md#63-zk-proximity-proofs-research
 *
 * @remarks
 * This is a RESEARCH TRACK implementation. Production use requires:
 * - Proper ZK-SNARK/STARK cryptographic primitives
 * - Trusted setup for SNARK parameters
 * - Extensive security auditing
 * - Performance optimization for browser environments
 */

import { encode, decode, cosineSimilarity } from '@isc/core';
import { dbGet, dbPut, dbFilter } from '../db/helpers.js';

const ZK_PROOFS_STORE = 'zk_proofs';
const ZK_COMMITMENTS_STORE = 'zk_commitments';

/**
 * Semantic embedding vector (simplified for research)
 * In production, this would be a 384+ dimensional vector
 */
export type Embedding = number[];

/**
 * Commitment to an embedding using hash-based scheme
 */
export interface EmbeddingCommitment {
  id: string;
  commitment: Uint8Array;
  salt: Uint8Array;
  createdAt: number;
  metadata?: {
    channelId?: string;
    contentHash?: string;
  };
}

/**
 * ZK Proximity Proof
 *
 * Proves that an embedding is within a certain distance threshold
 * of a reference embedding, without revealing either embedding.
 */
export interface ProximityProof {
  id: string;
  commitmentA: Uint8Array;
  commitmentB: Uint8Array;
  proofData: ProofData;
  threshold: number;
  actualSimilarity: number;
  verified: boolean;
  createdAt: number;
  prover: string;
}

/**
 * Proof data structure (simplified for research)
 *
 * In production, this would contain:
 * - SNARK proof bytes
 * - Public inputs (commitments, threshold)
 * - Verification key reference
 */
export interface ProofData {
  protocol: 'zk-similarity-v1';
  publicInputs: Uint8Array;
  proof: Uint8Array;
  verificationKeyHash: string;
}

/**
 * Verification result
 */
export interface VerificationResult {
  valid: boolean;
  similarityRange: {
    min: number;
    max: number;
  };
  confidence: number;
  error?: string;
}

/**
 * ZK Proof configuration
 */
export interface ZKConfig {
  // Similarity threshold for "close enough" proofs
  defaultThreshold: number;
  // Number of dimensions in embeddings
  dimensions: number;
  // Security parameter (bits)
  securityBits: number;
  // Enable debug logging
  debug: boolean;
}

const DEFAULT_CONFIG: ZKConfig = {
  defaultThreshold: 0.7,
  dimensions: 384,
  securityBits: 128,
  debug: false,
};

/**
 * Generate a random salt for commitments
 */
function generateSalt(): Uint8Array {
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Hash function for commitments (SHA-256 based)
 */
async function hashCommitment(data: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const combined = new Uint8Array(data.length + salt.length);
  combined.set(data);
  combined.set(salt, data.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined.buffer as ArrayBuffer);
  return new Uint8Array(hashBuffer);
}

/**
 * Convert embedding to bytes for hashing
 */
function embeddingToBytes(embedding: Embedding): Uint8Array {
  const float32Array = new Float32Array(embedding);
  return new Uint8Array(float32Array.buffer);
}

/**
 * Convert bytes back to embedding
 */
function bytesToEmbedding(bytes: Uint8Array): Embedding {
  const float32Array = new Float32Array(bytes.buffer);
  return Array.from(float32Array);
}

/**
 * Create a commitment to an embedding
 *
 * This hides the actual embedding while allowing proofs about it.
 *
 * @param embedding - The embedding vector to commit to
 * @param metadata - Optional metadata to associate with commitment
 * @returns Commitment object
 */
export async function createEmbeddingCommitment(
  embedding: Embedding,
  metadata?: { channelId?: string; contentHash?: string }
): Promise<EmbeddingCommitment> {
  const salt = generateSalt();
  const embeddingBytes = embeddingToBytes(embedding);
  const commitment = await hashCommitment(embeddingBytes, salt);

  const commitmentObj: EmbeddingCommitment = {
    id: `commit_${crypto.randomUUID()}`,
    commitment,
    salt,
    createdAt: Date.now(),
    metadata,
  };

  // Store locally
  await dbPut(ZK_COMMITMENTS_STORE, commitmentObj);

  return commitmentObj;
}

/**
 * Get commitment by ID
 */
export async function getCommitment(commitmentId: string): Promise<EmbeddingCommitment | null> {
  return dbGet<EmbeddingCommitment>(ZK_COMMITMENTS_STORE, commitmentId);
}

/**
 * Generate a zero-knowledge proximity proof
 *
 * Proves that embedding A is within `threshold` similarity of embedding B,
 * without revealing either embedding.
 *
 * @param embeddingA - Prover's embedding
 * @param embeddingB - Reference embedding (can be public or committed)
 * @param threshold - Minimum similarity to prove
 * @param config - ZK configuration
 * @returns Proximity proof
 *
 * @remarks
 * RESEARCH IMPLEMENTATION: This uses a simplified scheme.
 * Production would use actual ZK-SNARKs with proper cryptographic security.
 */
export async function generateProximityProof(
  embeddingA: Embedding,
  embeddingB: Embedding,
  threshold: number = 0.7,
  config: ZKConfig = DEFAULT_CONFIG
): Promise<ProximityProof> {
  const actualSimilarity = cosineSimilarity(embeddingA, embeddingB);

  // Create commitments for both embeddings
  const saltA = generateSalt();
  const saltB = generateSalt();

  const embeddingABytes = embeddingToBytes(embeddingA);
  const embeddingBBytes = embeddingToBytes(embeddingB);

  const [commitmentA, commitmentB] = await Promise.all([
    hashCommitment(embeddingABytes, saltA),
    hashCommitment(embeddingBBytes, saltB),
  ]);

  // Generate proof data (RESEARCH: simplified scheme)
  // In production, this would generate a SNARK proof
  const proofData = await generateSimplifiedProof(
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
    prover: 'local', // Would be peer ID in production
  };

  // Store proof
  await dbPut(ZK_PROOFS_STORE, proof);

  return proof;
}

/**
 * Generate simplified proof data (RESEARCH TRACK)
 *
 * This is NOT cryptographically secure. Production requires
 * proper ZK-SNARK implementation.
 */
async function generateSimplifiedProof(
  embeddingA: Embedding,
  embeddingB: Embedding,
  threshold: number,
  actualSimilarity: number,
  commitmentA: Uint8Array,
  commitmentB: Uint8Array,
  config: ZKConfig
): Promise<ProofData> {
  // Create public inputs (what the verifier will see)
  const publicInputsData = {
    commitmentA: Array.from(commitmentA),
    commitmentB: Array.from(commitmentB),
    threshold,
    timestamp: Date.now(),
  };

  const publicInputs = encode(publicInputsData);

  // Create proof (RESEARCH: this is a placeholder)
  // Real implementation would use:
  // - Circom circuits for constraint system
  // - SnarkJS for proof generation
  // - Proper witness computation
  const proofPayload = {
    similarity: actualSimilarity,
    passesThreshold: actualSimilarity >= threshold,
    // Add noise for privacy (differential privacy approach)
    noisySimilarity: actualSimilarity + (Math.random() - 0.5) * 0.1,
  };

  const proof = encode(proofPayload);

  // Hash of verification key (placeholder)
  const verificationKeyHash = await hashVerificationKey(config);

  return {
    protocol: 'zk-similarity-v1',
    publicInputs,
    proof,
    verificationKeyHash,
  };
}

/**
 * Generate verification key hash
 */
async function hashVerificationKey(config: ZKConfig): Promise<string> {
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

/**
 * Verify a proximity proof
 *
 * @param proof - Proof to verify
 * @param config - ZK configuration
 * @returns Verification result
 *
 * @remarks
 * RESEARCH IMPLEMENTATION: Verification is simplified.
 * Production would verify SNARK proof cryptographically.
 */
export async function verifyProximityProof(
  proof: ProximityProof,
  config: ZKConfig = DEFAULT_CONFIG
): Promise<VerificationResult> {
  try {
    // Verify protocol version
    if (proof.proofData.protocol !== 'zk-similarity-v1') {
      return {
        valid: false,
        similarityRange: { min: 0, max: 0 },
        confidence: 0,
        error: 'Unknown proof protocol',
      };
    }

    // Verify verification key hash matches
    const expectedKeyHash = await hashVerificationKey(config);
    if (proof.proofData.verificationKeyHash !== expectedKeyHash) {
      return {
        valid: false,
        similarityRange: { min: 0, max: 0 },
        confidence: 0,
        error: 'Verification key mismatch',
      };
    }

    // Decode proof data (RESEARCH: simplified)
    const decodedProof = decode(proof.proofData.proof) as {
      similarity: number;
      passesThreshold: boolean;
      noisySimilarity: number;
    };

    // In production, would verify SNARK proof here
    // For research, we trust the proof structure

    // Calculate similarity range from noisy value
    const noiseMargin = 0.05;
    const minSimilarity = Math.max(0, decodedProof.noisySimilarity - noiseMargin);
    const maxSimilarity = Math.min(1, decodedProof.noisySimilarity + noiseMargin);

    // Verify threshold claim
    const passesThreshold = minSimilarity >= proof.threshold;

    proof.verified = passesThreshold;

    // Update stored proof
    await dbPut(ZK_PROOFS_STORE, proof);

    return {
      valid: passesThreshold,
      similarityRange: {
        min: minSimilarity,
        max: maxSimilarity,
      },
      confidence: 0.95, // Research: fixed confidence
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

/**
 * Prove content matches a channel's semantic theme
 *
 * @param contentEmbedding - Embedding of the content
 * @param channelThemeEmbedding - Embedding of channel's theme
 * @param channelId - Channel ID
 * @returns Proximity proof
 */
export async function proveChannelRelevance(
  contentEmbedding: Embedding,
  channelThemeEmbedding: Embedding,
  channelId: string
): Promise<ProximityProof> {
  // Create commitment to channel theme (can be reused)
  let channelCommitment = await getCommitment(`channel_${channelId}`);

  if (!channelCommitment) {
    channelCommitment = await createEmbeddingCommitment(channelThemeEmbedding, {
      channelId,
    });
    // Store with channel ID for lookup
    await dbPut(ZK_COMMITMENTS_STORE, {
      ...channelCommitment,
      id: `channel_${channelId}`,
    });
  }

  // Generate proof
  const proof = await generateProximityProof(
    contentEmbedding,
    channelThemeEmbedding,
    0.7 // Default threshold for channel relevance
  );

  return proof;
}

/**
 * Prove two users have similar interests without revealing them
 *
 * @param userAEmbedding - First user's interest embedding
 * @param userBEmbedding - Second user's interest embedding
 * @returns Proximity proof
 */
export async function proveInterestSimilarity(
  userAEmbedding: Embedding,
  userBEmbedding: Embedding
): Promise<ProximityProof> {
  return generateProximityProof(
    userAEmbedding,
    userBEmbedding,
    0.6, // Lower threshold for interest matching
    { ...DEFAULT_CONFIG, debug: true }
  );
}

/**
 * Batch generate proofs for multiple embeddings
 *
 * @param embeddings - Array of embeddings to prove proximity for
 * @param referenceEmbedding - Reference embedding
 * @param threshold - Similarity threshold
 * @returns Array of proximity proofs
 */
export async function generateBatchProofs(
  embeddings: Embedding[],
  referenceEmbedding: Embedding,
  threshold: number = 0.7
): Promise<ProximityProof[]> {
  const proofs: ProximityProof[] = [];

  for (const embedding of embeddings) {
    const proof = await generateProximityProof(embedding, referenceEmbedding, threshold);
    proofs.push(proof);
  }

  return proofs;
}

/**
 * Verify batch of proofs
 *
 * @param proofs - Proofs to verify
 * @returns Array of verification results
 */
export async function verifyBatchProofs(
  proofs: ProximityProof[]
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  for (const proof of proofs) {
    const result = await verifyProximityProof(proof);
    results.push(result);
  }

  return results;
}

/**
 * Get all stored proofs
 */
export async function getAllProofs(): Promise<ProximityProof[]> {
  return dbFilter<ProximityProof>(ZK_PROOFS_STORE, () => true);
}

/**
 * Get proofs by prover
 */
export async function getProofsByProver(prover: string): Promise<ProximityProof[]> {
  return dbFilter<ProximityProof>(ZK_PROOFS_STORE, (p) => p.prover === prover);
}

/**
 * Get verified proofs only
 */
export async function getVerifiedProofs(): Promise<ProximityProof[]> {
  return dbFilter<ProximityProof>(ZK_PROOFS_STORE, (p) => p.verified);
}

/**
 * Export proof for sharing
 *
 * @param proof - Proof to export
 * @returns Serializable proof object
 */
export function exportProof(proof: ProximityProof): object {
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
 *
 * @param serialized - Serialized proof
 * @returns Imported proof
 */
export function importProof(serialized: object): ProximityProof {
  const s = serialized as Record<string, unknown>;

  return {
    id: s.id as string,
    commitmentA: new Uint8Array(s.commitmentA as number[]),
    commitmentB: new Uint8Array(s.commitmentB as number[]),
    proofData: {
      protocol: 'zk-similarity-v1' as const,
      publicInputs: new Uint8Array(
        (s.proofData as Record<string, unknown>).publicInputs as number[]
      ),
      proof: new Uint8Array(
        (s.proofData as Record<string, unknown>).proof as number[]
      ),
      verificationKeyHash: (s.proofData as Record<string, unknown>)
        .verificationKeyHash as string,
    },
    threshold: s.threshold as number,
    actualSimilarity: 0, // Not available in imported proof
    verified: s.verified as boolean,
    createdAt: s.createdAt as number,
    prover: 'imported',
  };
}

/**
 * Performance benchmark for proof generation
 *
 * @param dimensions - Number of embedding dimensions
 * @returns Benchmark results
 */
export async function benchmarkProofGeneration(
  dimensions: number = 384
): Promise<{
  dimensions: number;
  generationTimeMs: number;
  verificationTimeMs: number;
  proofSize: number;
}> {
  // Generate random embedding
  const embeddingA = Array.from({ length: dimensions }, () => Math.random());
  const embeddingB = Array.from({ length: dimensions }, () => Math.random());

  // Normalize embeddings
  const normalize = (e: Embedding) => {
    const norm = Math.sqrt(e.reduce((sum, v) => sum + v * v, 0));
    return e.map((v) => v / norm);
  };

  const normA = normalize(embeddingA);
  const normB = normalize(embeddingB);

  // Benchmark generation
  const genStart = performance.now();
  const proof = await generateProximityProof(normA, normB, 0.5);
  const genEnd = performance.now();

  // Benchmark verification
  const verifyStart = performance.now();
  await verifyProximityProof(proof);
  const verifyEnd = performance.now();

  // Calculate proof size
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

/**
 * Research notes and limitations
 */
export const RESEARCH_NOTES = {
  limitations: [
    'Current implementation uses simplified proof scheme, not cryptographically secure',
    'Production requires ZK-SNARK/STARK implementation (e.g., Circom + SnarkJS)',
    'Trusted setup needed for SNARK parameters',
    'Performance may be prohibitive for real-time browser use',
    'Embedding dimension reduction may be needed for efficiency',
  ],
  futureWork: [
    'Implement proper R1CS constraint system for cosine similarity',
    'Add support for batch proof verification',
    'Explore STARKs for transparent (no trusted setup) proofs',
    'Investigate recursive proofs for proof aggregation',
    'Optimize for WASM execution in browsers',
  ],
  securityConsiderations: [
    'Current implementation should NOT be used for security-critical applications',
    'Side-channel attacks possible through timing analysis',
    'Random number generation quality affects security',
    'Embedding leakage through repeated proofs needs analysis',
  ],
};

/**
 * Get research notes
 */
export function getResearchNotes(): typeof RESEARCH_NOTES {
  return RESEARCH_NOTES;
}
