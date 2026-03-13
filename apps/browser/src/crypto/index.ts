/**
 * Crypto Module
 */

export { SignatureService } from './services/SignatureService.js';

// Re-export proof-related functions from existing modules
export {
  generateProximityProof,
  proveChannelRelevance,
  proveInterestSimilarity,
  generateBatchProofs,
} from './zk-proofs.js';

export {
  verifyProximityProof,
  verifyBatchProofs,
} from './zk-proofs.js';

export {
  createEmbeddingCommitment,
  getCommitment,
} from './zk-proofs.js';

export type { SignableData } from './services/SignatureService.js';
