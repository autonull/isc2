/**
 * Discover Configuration
 */

export const DISCOVER_CONFIG = {
  localModel: 'Xenova/all-MiniLM-L6-v2',
  similarityThreshold: 0.55,
  queryCacheTTL: 5 * 60 * 1000,
  maxMatches: 20,
  maxQueryHashes: 5,
  modelHashLength: 12,
} as const;

export const SIMILARITY_THRESHOLDS = {
  VERY_CLOSE: 0.85,
  NEARBY: 0.70,
  ORBITING: 0.55,
} as const;

export const PROXIMITY_LABELS = {
  VERY_CLOSE: 'VERY CLOSE',
  NEARBY: 'NEARBY',
  ORBITING: 'ORBITING',
  DISTANT: 'DISTANT',
} as const;
