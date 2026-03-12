export const Config = {
  social: {
    trending: {
      timeDecayHalfLifeMs: 3600 * 1000,
      minEngagement: 3,
      weights: { likes: 1, reposts: 2, replies: 3, quotes: 2 },
    },
    reputation: {
      halfLifeDays: 30,
      interactionWeights: {
        follow: 5,
        like: 1,
        repost: 3,
        reply: 2,
        quote: 2,
        mutualFollow: 10,
      },
    },
    posts: { defaultTtlSeconds: 86400 * 7 },
    follows: { defaultTtlSeconds: 86400 * 30 },
  },

  delegation: {
    weights: {
      uptime: 0.15,
      successRate: 0.15,
      latency: 0.1,
      consistency: 0.15,
      failureRate: 0.15,
      load: 0.1,
      capacity: 0.1,
      geographic: 0.05,
      networkQuality: 0.05,
    },
    minUptimePercent: 90,
    minSuccessRate: 0.8,
    maxLatencyMs: 2000,
    maxLoadPercent: 90,
    decayFactor: 0.1,
    sampleSize: 100,
    maxSupernodes: 5,
    timeoutMs: 5000,
    maxConcurrentRequests: 5,
    maxQueueSize: 50,
    maxRetries: 3,
  },

  scoring: {
    uptimeWeight: 0.4,
    successRateWeight: 0.3,
    throughputWeight: 0.2,
    rateLimitWeight: 0.1,
    minSuccessRate: 0.85,
    topSupernodesCount: 3,
  },

  offline: {
    maxRetries: 5,
    syncEventTag: 'sync-actions',
  },

  crypto: {
    shamir: { minThreshold: 1 },
  },

  network: {
    maxPeers: 50,
    reconnectDelayMs: 1000,
    maxReconnectAttempts: 5,
  },

  ui: {
    feed: { defaultLimit: 20, maxLimit: 100 },
    chaosLevel: { default: 0.2, max: 1.0 },
  },
};

export type Config = typeof Config;
