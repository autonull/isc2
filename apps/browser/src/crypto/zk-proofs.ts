/* eslint-disable */
/**
 * Zero-Knowledge Proximity Proofs
 *
 * Enables privacy-preserving content matching where users can prove
 * their content is similar to a topic without exposing semantic vectors.
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

export { ZK_CONFIG, ZK_PROTOCOL, ZK_STORES } from './config/zkConfig.ts';
export type { ZKConfig } from './config/zkConfig.ts';

export type {
  Embedding,
  EmbeddingCommitment,
  ProximityProof,
  ProofData,
  VerificationResult,
  SerializableProof,
} from './models/proof.ts';

export {
  createEmbeddingCommitment,
  getCommitment,
} from './services/CommitmentService.ts';

export {
  generateProximityProof,
  proveChannelRelevance,
  proveInterestSimilarity,
} from './services/ProofGeneratorService.ts';

export { verifyProximityProof } from './services/ProofVerifierService.ts';

export {
  generateBatchProofs,
  verifyBatchProofs,
  getAllProofs,
  getProofsByProver,
  getVerifiedProofs,
} from './services/BatchProofService.ts';

export { exportProof, importProof, benchmarkProofGeneration } from './services/ProofUtilsService.ts';

export { RESEARCH_NOTES, getResearchNotes } from './docs/researchNotes.ts';

export type { ResearchNotes } from './docs/researchNotes.ts';
