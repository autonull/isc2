// Discovery
export { SupernodeDiscovery, queryProximals } from './discovery.js';
export type { SupernodeDiscoveryConfig, DHTAdapter } from './discovery.js';

// Ranking
export { DelegationRanker, createDelegationRanker } from './ranking.js';
export type { SupernodeRanking, RankingComponents, SupernodeMetrics, RankingWeights, RankingConfig } from './ranking.js';

// Selection
export { HealthSelector } from './selection.js';
export type { HealthSelectionConfig } from './selection.js';

// Scoring
export { scoreSupernode, rankSupernodes, filterHealthySupernodes, selectTopSupernodes } from './scoring.js';
export type { SupernodeStats, ScoredSupernode } from './scoring.js';

// Request
export { createDelegationRequest, decryptResponsePayload } from './request.js';
export type { DelegationRequestOptions } from './request.js';

// Verify
export {
  verifyDelegationResponse,
  decodeEmbedResponse,
  decodeANNResponse,
  decodeSigVerifyResponse,
} from './verify.js';
export type { EmbedResult, ANNResult, SigVerifyResult, ServiceResult } from './verify.js';

// Fallback/Client
export { DelegationClient } from './fallback.js';
export type { DelegationConfig, LocalHandler, DelegationStats } from './fallback.js';

// Policy
export {
  DelegationPolicyManager,
  createMinimalPolicy,
  isChannelDescriptionSafe,
  sanitizeForDelegation,
} from './policy.js';
export type { DelegationPolicy, DelegationPolicyConfig, PolicyStorage } from './policy.js';
