/* eslint-disable */
/**
 * Crypto Module
 */

export { SignatureService } from './services/SignatureService.ts';

// Re-export proof-related functions from existing modules
export {
  generateProximityProof,
  proveChannelRelevance,
  proveInterestSimilarity,
  generateBatchProofs,
} from './zk-proofs.ts';

export {
  verifyProximityProof,
  verifyBatchProofs,
} from './zk-proofs.ts';

export {
  createEmbeddingCommitment,
  getCommitment,
} from './zk-proofs.ts';

export type { SignableData } from './services/SignatureService.ts';
