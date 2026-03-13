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

export { ZK_CONFIG, ZK_PROTOCOL, ZK_STORES } from './config/zkConfig.js';
export type { ZKConfig } from './config/zkConfig.js';

export type {
  Embedding,
  EmbeddingCommitment,
  ProximityProof,
  ProofData,
  VerificationResult,
  SerializableProof,
} from './models/proof.js';

export {
  createEmbeddingCommitment,
  getCommitment,
} from './services/CommitmentService.js';

export {
  generateProximityProof,
  proveChannelRelevance,
  proveInterestSimilarity,
} from './services/ProofGeneratorService.js';

export { verifyProximityProof } from './services/ProofVerifierService.js';

export {
  generateBatchProofs,
  verifyBatchProofs,
  getAllProofs,
  getProofsByProver,
  getVerifiedProofs,
} from './services/BatchProofService.js';

export { exportProof, importProof, benchmarkProofGeneration } from './services/ProofUtilsService.js';

export { RESEARCH_NOTES, getResearchNotes } from './docs/researchNotes.js';

export type { ResearchNotes } from './docs/researchNotes.js';
