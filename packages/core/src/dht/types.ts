/* eslint-disable */
/**
 * Hierarchical DHT Type Definitions
 */

/**
 * Geographic location
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number; // meters
}

/**
 * Shard level in hierarchy
 */
export type ShardLevel = 'local' | 'regional' | 'global';

/**
 * Shard configuration
 */
export interface ShardConfig {
  level: ShardLevel;
  shardID: string;
  parentShard?: string;      // Parent shard ID (for local/regional)
  childShards?: string[];    // Child shard IDs (for regional/global)
  geoBounds?: GeoBounds;     // Geographic boundaries
  maxPeers: number;          // Maximum peers before splitting
  replicationFactor: number; // Data replication factor
}

/**
 * Geographic boundaries for a shard
 */
export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Shard information
 */
export interface ShardInfo {
  shardID: string;
  level: ShardLevel;
  peerCount: number;
  health: number;            // 0-1 health score
  latency: number;           // Average latency in ms
  location?: GeoLocation;
  bounds?: GeoBounds;
  parentShard?: string;
  childShards?: string[];
}

/**
 * Routing table entry
 */
export interface RoutingEntry {
  peerID: string;
  shardID: string;
  location?: GeoLocation;
  lastSeen: number;
  latency: number;
  capabilities: string[];
}

/**
 * Shard statistics
 */
export interface ShardStats {
  shardID: string;
  totalPeers: number;
  activePeers: number;
  dataEntries: number;
  avgLatency: number;
  healthScore: number;
  loadFactor: number;      // 0-1, how loaded the shard is
  splitHistory: SplitEvent[];
}

/**
 * Shard split event
 */
export interface SplitEvent {
  timestamp: number;
  originalShard: string;
  newShards: string[];
  reason: 'load' | 'geo' | 'manual';
  peerDistribution: Record<string, number>;
}

/**
 * Cross-shard query result
 */
export interface CrossShardResult {
  localResults: any[];
  regionalResults: any[];
  globalResults: any[];
  totalResults: number;
  queryTime: number;
  shardsQueried: number;
}

/**
 * Shard health metrics
 */
export interface ShardHealth {
  shardID: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  peerAvailability: number;    // 0-1
  dataIntegrity: number;       // 0-1
  networkLatency: number;      // ms
  lastCheck: number;
  issues: string[];
}

/**
 * Load balancing decision
 */
export interface LoadBalanceDecision {
  action: 'none' | 'migrate' | 'split' | 'merge';
  sourceShard?: string;
  targetShard?: string;
  reason: string;
  priority: number;  // 0-10, higher = more urgent
}
