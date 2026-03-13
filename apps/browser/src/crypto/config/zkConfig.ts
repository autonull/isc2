/**
 * Zero-Knowledge Proof Configuration
 */

export interface ZKConfig {
  defaultThreshold: number;
  dimensions: number;
  securityBits: number;
  debug: boolean;
}

export const ZK_CONFIG: ZKConfig = {
  defaultThreshold: 0.7,
  dimensions: 384,
  securityBits: 128,
  debug: false,
} as const;

export const ZK_STORES = {
  PROOFS: 'zk_proofs',
  COMMITMENTS: 'zk_commitments',
} as const;

export const ZK_PROTOCOL = {
  NAME: 'zk-similarity-v1',
  CHANNEL_RELEVANCE_THRESHOLD: 0.7,
  INTEREST_SIMILARITY_THRESHOLD: 0.6,
  NOISE_MARGIN: 0.05,
  DEFAULT_CONFIDENCE: 0.95,
} as const;
