/* eslint-disable */
/**
 * Relay Configuration
 */

import type { NATTraversalConfig, TURNConfig, STUNConfig } from '../types/relay.ts';

export const DEFAULT_TURN_SERVERS: TURNConfig[] = [];

export const DEFAULT_STUN_SERVERS: STUNConfig[] = [
  { urls: ['stun:stun.l.google.com:19302'] },
  { urls: ['stun:stun1.l.google.com:19302'] },
];

export const RELAY_CONFIG: NATTraversalConfig = {
  maxRelayPoolSize: 20,
  minRelays: 3,
  relayRefreshInterval: 60000,
  connectionTimeout: 5000,
  maxRetries: 3,
  retryBackoff: 1000,
  minQualityScore: 0.3,
  degradedQualityScore: 0.6,
  turnServers: DEFAULT_TURN_SERVERS,
  stunServers: DEFAULT_STUN_SERVERS,
  latencyWeight: 0.4,
  successRateWeight: 0.4,
  stabilityWeight: 0.2,
} as const;

export const QUALITY_WEIGHTS = {
  LATENCY: 0.35,
  PACKET_LOSS: 0.35,
  JITTER: 0.15,
  BANDWIDTH: 0.15,
} as const;

export const RELAY_SCORE_WEIGHTS = {
  LATENCY: 0.4,
  SUCCESS_RATE: 0.4,
  STABILITY: 0.2,
} as const;

export const RELAY_CONSTANTS = {
  ONE_MINUTE_MS: 60000,
  ONE_HOUR_MS: 3600000,
  MAX_LATENCY_MS: 1000,
  MAX_PACKET_LOSS: 0.1,
  MAX_JITTER_MS: 100,
  TARGET_BANDWIDTH_KBPS: 1000,
  STABILITY_THRESHOLD_USES: 10,
  STABILITY_MAX_SCORE: 0.9,
  SMOOTHING_FACTOR: 0.2,
  CONNECTION_SMOOTHING: 0.7,
} as const;
