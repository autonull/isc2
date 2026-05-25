/* eslint-disable */
/**
 * DHT Type Definitions (Extended)
 *
 * Re-exports from types.ts with additional types
 */

export type {
  GeoLocation,
  ShardLevel,
  ShardConfig,
  GeoBounds,
  ShardInfo,
  RoutingEntry,
  ShardStats,
  SplitEvent,
  CrossShardResult,
  ShardHealth,
  LoadBalanceDecision,
} from '../types.js';

export interface NetworkStats {
  totalShards: number;
  totalPeers: number;
  avgHealth: number;
}

export interface NetworkHealth {
  status: 'healthy' | 'degraded' | 'critical';
  totalShards: number;
  totalPeers: number;
  avgHealth: number;
  issues: string[];
}
