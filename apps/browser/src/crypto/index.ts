/**
 * Zero-Knowledge Proofs Module (Research)
 *
 * Privacy-preserving semantic similarity proofs.
 * References: NEXT_STEPS.md#63-zk-proximity-proofs-research
 */

export {
  // Commitments
  createEmbeddingCommitment,
  getCommitment,
  
  // Proximity proofs
  generateProximityProof,
  verifyProximityProof,
  
  // Specialized proofs
  proveChannelRelevance,
  proveInterestSimilarity,
  
  // Batch operations
  generateBatchProofs,
  verifyBatchProofs,
  
  // Storage
  getAllProofs,
  getProofsByProver,
  getVerifiedProofs,
  
  // Export/Import
  exportProof,
  importProof,
  
  // Benchmarking
  benchmarkProofGeneration,
  
  // Research
  getResearchNotes,
  RESEARCH_NOTES,
} from './zk-proofs.js';

export type {
  Embedding,
  EmbeddingCommitment,
  ProximityProof,
  ProofData,
  VerificationResult,
  ZKConfig,
} from './zk-proofs.js';
