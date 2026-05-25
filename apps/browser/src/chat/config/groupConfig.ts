/* eslint-disable */
/**
 * Group Chat Configuration
 */

export const GROUP_CONFIG = {
  formation: {
    defaultSimilarityThreshold: 0.85,
    minMembers: 3,
    maxMembers: 8,
  },
  exit: {
    driftThreshold: 0.55,
  },
  invite: {
    ttlMs: 86400 * 7 * 1000, // 7 days
  },
} as const;
