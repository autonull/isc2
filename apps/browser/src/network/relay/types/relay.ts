/* eslint-disable */
/**
 * Relay Type Definitions
 */

export type RelayType = 'circuit' | 'turn' | 'stun';

export interface RelayCandidate {
  peerID: string;
  multiaddr: string;
  type: RelayType;
  latency: number;
  successRate: number;
  lastUsed?: number;
  usageCount: number;
  qualityScore: number;
}

export interface TURNConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface STUNConfig {
  urls: string[];
}

export interface ConnectionQuality {
  peerID: string;
  score: number;
  latency: number;
  packetLoss: number;
  jitter: number;
  bandwidth: number;
  stability: number;
  lastUpdated: number;
}

export interface NATTraversalConfig {
  maxRelayPoolSize: number;
  minRelays: number;
  relayRefreshInterval: number;
  connectionTimeout: number;
  maxRetries: number;
  retryBackoff: number;
  minQualityScore: number;
  degradedQualityScore: number;
  turnServers: TURNConfig[];
  stunServers: STUNConfig[];
  latencyWeight: number;
  successRateWeight: number;
  stabilityWeight: number;
}

export interface RelayPoolStats {
  totalRelays: number;
  circuitRelays: number;
  turnRelays: number;
  stunRelays: number;
  avgQualityScore: number;
  avgLatency: number;
  avgSuccessRate: number;
}

export interface ConnectionQualityStats {
  totalConnections: number;
  activeConnections: number;
  avgScore: number;
  avgLatency: number;
  avgPacketLoss: number;
  acceptableConnections: number;
  degradedConnections: number;
}
