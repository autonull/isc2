/**
 * DHT Configuration
 */

export const DHT_CONFIG = {
  initialization: {
    readyTimeoutMs: 3000,
    maxRetries: 3,
    retryDelayMs: 1000,
  },
  defaults: {
    announceTTLSeconds: 300,
    queryLimit: 20,
    kBucketsSize: 20,
  },
  bootstrap: {
    peers: [
      '/dns4/relay.libp2p.io/tcp/443/wss/p2p/QmZmViJTcj74zJ8kVDxFbPEJLdVqV5jRnFbVJkVqV5jRn',
    ],
  },
  rateLimit: {
    queryIntervalMs: 1000,
    announceIntervalMs: 1000,
    maxQueriesPerSecond: 10,
    maxAnnouncesPerSecond: 5,
  },
} as const;
