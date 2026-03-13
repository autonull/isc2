/**
 * Social Graph Configuration
 */

export const SOCIAL_GRAPH_CONFIG = {
  reputation: {
    halfLifeDays: 30,
    maxScore: 1.0,
    mutualFollowBonusPer: 0.05,
    maxMutualFollowBonus: 0.4,
  },
  interactionWeights: {
    follow: 1.0,
    message: 0.5,
    mention: 0.3,
    reaction: 0.2,
    share: 0.4,
  },
  trust: {
    directTrustWeight: 0.5,
    maxIndirectTrust: 0.3,
    indirectTrustPerConnection: 0.03,
    mutualFollowBonus: 0.2,
    sybilCap: 0.3,
  },
  defaultTTL: 86400 * 30,
  stores: {
    follows: 'follows',
    interactions: 'interactions',
    profiles: 'profiles',
  },
} as const;

export const CHAOS_CONFIG = {
  minLevel: 0,
  maxLevel: 1,
  defaultLevel: 0,
} as const;
