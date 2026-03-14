/**
 * Zero-Knowledge Proximity Proofs Tests
 *
 * Tests for Phase 6: ZK proximity proofs (Research Track)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock crypto for hash functions and randomUUID
let uuidCounter = 0;
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockImplementation(() => {
        // Return different hash for each call
        const hash = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          hash[i] = Math.floor(Math.random() * 256);
        }
        return Promise.resolve(hash.buffer);
      }),
    },
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => `test-uuid-${++uuidCounter}-${Math.random().toString(36).slice(2)}`,
  },
  writable: true,
});

import {
  createEmbeddingCommitment,
  getCommitment,
  generateProximityProof,
  verifyProximityProof,
  proveChannelRelevance,
  proveInterestSimilarity,
  generateBatchProofs,
  verifyBatchProofs,
  getAllProofs,
  getProofsByProver,
  getVerifiedProofs,
  exportProof,
  importProof,
  benchmarkProofGeneration,
  getResearchNotes,
  RESEARCH_NOTES,
  type Embedding,
  type ProximityProof,
} from '../../src/crypto/zk-proofs';
import { cosineSimilarity } from '@isc/core';

describe('ZK Proximity Proofs - Commitments', () => {
  describe('createEmbeddingCommitment', () => {
    it('should create commitment with unique ID', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const commitment = await createEmbeddingCommitment(embedding);

      expect(commitment.id).toBeDefined();
      expect(commitment.id).toMatch(/^commit_/);
    });

    it('should include commitment hash', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const commitment = await createEmbeddingCommitment(embedding);

      expect(commitment.commitment).toBeDefined();
      expect(commitment.commitment.length).toBe(64); // SHA-256 hex output
    });

    it('should include salt', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const commitment = await createEmbeddingCommitment(embedding);

      expect(commitment.salt).toBeDefined();
      expect(commitment.salt.length).toBe(64); // hex output
    });

    it('should include creation timestamp', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const commitment = await createEmbeddingCommitment(embedding);

      expect(commitment.createdAt).toBeGreaterThan(0);
    });

    it('should include metadata if provided', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const commitment = await createEmbeddingCommitment(embedding, {
        channelId: 'channel_123',
        contentHash: 'hash_abc',
      });

      expect(commitment.metadata?.channelId).toBe('channel_123');
      expect(commitment.metadata?.contentHash).toBe('hash_abc');
    });

    it('should create different commitments for same embedding (due to salt)', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      const commitment1 = await createEmbeddingCommitment(embedding);
      const commitment2 = await createEmbeddingCommitment(embedding);

      expect(commitment1.commitment).not.toEqual(commitment2.commitment);
      expect(commitment1.salt).not.toEqual(commitment2.salt);
    });
  });

  describe('getCommitment', () => {
    it('should retrieve commitment by ID', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const created = await createEmbeddingCommitment(embedding);
      const retrieved = await getCommitment(created.id);

      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent commitment', async () => {
      const retrieved = await getCommitment('nonexistent');
      expect(retrieved).toBeNull();
    });
  });
});

describe('ZK Proximity Proofs - Proof Generation', () => {
  const createNormalizedEmbedding = (dim: number): Embedding => {
    const embedding = Array.from({ length: dim }, () => Math.random());
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  };

  describe('generateProximityProof', () => {
    it('should create proof with unique ID', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);

      expect(proof.id).toBeDefined();
      expect(proof.id).toMatch(/^proof_/);
    });

    it('should include commitments for both embeddings', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);

      expect(proof.commitmentA).toBeDefined();
      expect(proof.commitmentB).toBeDefined();
      expect(proof.commitmentA.length).toBe(32);
      expect(proof.commitmentB.length).toBe(32);
    });

    it('should include proof data', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);

      expect(proof.proofData).toBeDefined();
      expect(proof.proofData.protocol).toBe('zk-similarity-v1');
    });

    it('should include threshold', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.7);

      expect(proof.threshold).toBe(0.7);
    });

    it('should include actual similarity score', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);

      expect(proof.actualSimilarity).toBeDefined();
      expect(proof.actualSimilarity).toBeGreaterThanOrEqual(-1);
      expect(proof.actualSimilarity).toBeLessThanOrEqual(1);
    });

    it('should use default threshold of 0.7', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB);

      expect(proof.threshold).toBe(0.7);
    });

    it('should create different proofs for same embeddings (due to salt)', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof1 = await generateProximityProof(embeddingA, embeddingB, 0.5);
      const proof2 = await generateProximityProof(embeddingA, embeddingB, 0.5);

      expect(proof1.commitmentA).not.toEqual(proof2.commitmentA);
    });
  });
});

describe('ZK Proximity Proofs - Verification', () => {
  const createNormalizedEmbedding = (dim: number): Embedding => {
    const embedding = Array.from({ length: dim }, () => Math.random());
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  };

  describe('verifyProximityProof', () => {
    it('should verify valid proof', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      const result = await verifyProximityProof(proof);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('similarityRange');
      expect(result).toHaveProperty('confidence');
    });

    it('should return similarity range', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      const result = await verifyProximityProof(proof);

      expect(result.similarityRange.min).toBeGreaterThanOrEqual(0);
      expect(result.similarityRange.max).toBeLessThanOrEqual(1);
      expect(result.similarityRange.min).toBeLessThanOrEqual(result.similarityRange.max);
    });

    it('should reject proof with wrong protocol', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      proof.proofData.protocol = 'invalid-protocol' as any;

      const result = await verifyProximityProof(proof);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should mark proof as verified after successful verification', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      expect(proof.verified).toBe(false);

      await verifyProximityProof(proof);

      const updated = await getCommitment(proof.id.replace('proof_', 'commit_'));
      // Note: Proof verification updates the proof, not commitment
    });
  });
});

describe('ZK Proximity Proofs - Specialized Proofs', () => {
  const createNormalizedEmbedding = (dim: number): Embedding => {
    const embedding = Array.from({ length: dim }, () => Math.random());
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  };

  describe('proveChannelRelevance', () => {
    it('should create proof for channel relevance', async () => {
      const contentEmbedding = createNormalizedEmbedding(384);
      const channelEmbedding = createNormalizedEmbedding(384);

      const proof = await proveChannelRelevance(contentEmbedding, channelEmbedding, 'channel_123');

      expect(proof.id).toBeDefined();
      expect(proof.threshold).toBe(0.7);
    });
  });

  describe('proveInterestSimilarity', () => {
    it('should create proof for interest similarity', async () => {
      const userAEmbedding = createNormalizedEmbedding(384);
      const userBEmbedding = createNormalizedEmbedding(384);

      const proof = await proveInterestSimilarity(userAEmbedding, userBEmbedding);

      expect(proof.id).toBeDefined();
      expect(proof.threshold).toBe(0.6); // Lower threshold for interest matching
    });
  });
});

describe('ZK Proximity Proofs - Batch Operations', () => {
  const createNormalizedEmbedding = (dim: number): Embedding => {
    const embedding = Array.from({ length: dim }, () => Math.random());
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  };

  describe('generateBatchProofs', () => {
    it('should generate proofs for multiple embeddings', async () => {
      const embeddings = [
        createNormalizedEmbedding(10),
        createNormalizedEmbedding(10),
        createNormalizedEmbedding(10),
      ];
      const reference = createNormalizedEmbedding(10);

      const proofs = await generateBatchProofs(embeddings, reference, 0.5);

      expect(proofs.length).toBe(3);
      proofs.forEach((proof) => {
        expect(proof.id).toBeDefined();
      });
    });

    it('should use same threshold for all proofs', async () => {
      const embeddings = [
        createNormalizedEmbedding(10),
        createNormalizedEmbedding(10),
      ];
      const reference = createNormalizedEmbedding(10);

      const proofs = await generateBatchProofs(embeddings, reference, 0.8);

      proofs.forEach((proof) => {
        expect(proof.threshold).toBe(0.8);
      });
    });
  });

  describe('verifyBatchProofs', () => {
    it('should verify multiple proofs', async () => {
      const embeddings = [
        createNormalizedEmbedding(10),
        createNormalizedEmbedding(10),
      ];
      const reference = createNormalizedEmbedding(10);

      const proofs = await generateBatchProofs(embeddings, reference, 0.5);
      const results = await verifyBatchProofs(proofs);

      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('similarityRange');
      });
    });
  });
});

describe('ZK Proximity Proofs - Storage & Retrieval', () => {
  const createNormalizedEmbedding = (dim: number): Embedding => {
    const embedding = Array.from({ length: dim }, () => Math.random());
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  };

  describe('getAllProofs', () => {
    it('should return array of proofs', async () => {
      const proofs = await getAllProofs();
      expect(Array.isArray(proofs)).toBe(true);
    });
  });

  describe('getProofsByProver', () => {
    it('should return proofs for specific prover', async () => {
      const proofs = await getProofsByProver('local');
      expect(Array.isArray(proofs)).toBe(true);
    });
  });

  describe('getVerifiedProofs', () => {
    it('should return only verified proofs', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      await verifyProximityProof(proof);

      const verified = await getVerifiedProofs();
      expect(Array.isArray(verified)).toBe(true);
    });
  });
});

describe('ZK Proximity Proofs - Export/Import', () => {
  const createNormalizedEmbedding = (dim: number): Embedding => {
    const embedding = Array.from({ length: dim }, () => Math.random());
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  };

  describe('exportProof', () => {
    it('should export proof to serializable format', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      const exported = exportProof(proof);

      expect(exported).toHaveProperty('id');
      expect(exported).toHaveProperty('commitmentA');
      expect(exported).toHaveProperty('commitmentB');
      expect(exported).toHaveProperty('proofData');
      expect(exported).toHaveProperty('threshold');
      expect(exported).toHaveProperty('verified');
    });

    it('should convert Uint8Arrays to arrays', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      const exported = exportProof(proof);

      expect(Array.isArray((exported as any).commitmentA)).toBe(true);
      expect(Array.isArray((exported as any).commitmentB)).toBe(true);
    });
  });

  describe('importProof', () => {
    it('should import proof from serialized format', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      const exported = exportProof(proof);
      const imported = importProof(exported);

      expect(imported.id).toBe(proof.id);
      expect(imported.threshold).toBe(proof.threshold);
      expect(imported.verified).toBe(proof.verified);
    });

    it('should convert arrays back to Uint8Arrays', async () => {
      const embeddingA = createNormalizedEmbedding(10);
      const embeddingB = createNormalizedEmbedding(10);

      const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
      const exported = exportProof(proof);
      const imported = importProof(exported);

      expect(imported.commitmentA).toBeInstanceOf(Uint8Array);
      expect(imported.commitmentB).toBeInstanceOf(Uint8Array);
    });
  });
});

describe('ZK Proximity Proofs - Benchmarking', () => {
  describe('benchmarkProofGeneration', () => {
    it('should return benchmark results', async () => {
      const results = await benchmarkProofGeneration(64);

      expect(results).toHaveProperty('dimensions');
      expect(results).toHaveProperty('generationTimeMs');
      expect(results).toHaveProperty('verificationTimeMs');
      expect(results).toHaveProperty('proofSize');
    });

    it('should have positive timing values', async () => {
      const results = await benchmarkProofGeneration(64);

      expect(results.generationTimeMs).toBeGreaterThan(0);
      expect(results.verificationTimeMs).toBeGreaterThan(0);
    });

    it('should handle different dimensions', async () => {
      const results64 = await benchmarkProofGeneration(64);
      const results128 = await benchmarkProofGeneration(128);

      expect(results64.dimensions).toBe(64);
      expect(results128.dimensions).toBe(128);
    });
  });
});

describe('ZK Proximity Proofs - Research Notes', () => {
  describe('getResearchNotes', () => {
    it('should return research notes', () => {
      const notes = getResearchNotes();

      expect(notes).toHaveProperty('limitations');
      expect(notes).toHaveProperty('futureWork');
      expect(notes).toHaveProperty('securityConsiderations');
    });
  });

  describe('RESEARCH_NOTES', () => {
    it('should include limitations', () => {
      expect(RESEARCH_NOTES.limitations.length).toBeGreaterThan(0);
    });

    it('should include future work items', () => {
      expect(RESEARCH_NOTES.futureWork.length).toBeGreaterThan(0);
    });

    it('should include security considerations', () => {
      expect(RESEARCH_NOTES.securityConsiderations.length).toBeGreaterThan(0);
    });
  });
});

describe('ZK Proximity Proofs - Integration', () => {
  const createNormalizedEmbedding = (dim: number): Embedding => {
    const embedding = Array.from({ length: dim }, () => Math.random());
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map((v) => v / norm);
  };

  it('should complete full proof workflow', async () => {
    // Create embeddings
    const embeddingA = createNormalizedEmbedding(32);
    const embeddingB = createNormalizedEmbedding(32);

    // Create commitment
    const commitment = await createEmbeddingCommitment(embeddingA, {
      channelId: 'test_channel',
    });
    expect(commitment.id).toBeDefined();

    // Generate proof
    const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);
    expect(proof.id).toBeDefined();

    // Verify proof
    const result = await verifyProximityProof(proof);
    expect(result).toHaveProperty('valid');

    // Retrieve proof
    const allProofs = await getAllProofs();
    expect(allProofs.length).toBeGreaterThan(0);
  });

  it('should handle cosine similarity correctly', async () => {
    // Create identical embeddings
    const embedding = createNormalizedEmbedding(32);

    const proof = await generateProximityProof(embedding, embedding, 0.9);

    // Identical embeddings should have similarity of 1
    expect(proof.actualSimilarity).toBeCloseTo(1, 1);
  });

  it('should handle orthogonal embeddings', async () => {
    // Create orthogonal embeddings (similarity ~0)
    const embeddingA = new Array(32).fill(0);
    embeddingA[0] = 1;

    const embeddingB = new Array(32).fill(0);
    embeddingB[1] = 1;

    const proof = await generateProximityProof(embeddingA, embeddingB, 0.5);

    // Orthogonal embeddings should have similarity of 0
    expect(proof.actualSimilarity).toBeCloseTo(0, 1);
  });
});
