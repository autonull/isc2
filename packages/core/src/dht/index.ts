/**
 * ISC Phase 2.4: Hierarchical DHT
 * 
 * Geographic sharding for scalable peer discovery.
 * Three-level hierarchy: Local → Regional → Global
 */

// Re-export DHT modules
export { HierarchicalDHT } from './hierarchical.js';
export { GeoShard } from './sharding.js';
export { CrossShardRouter } from './routing.js';

// Types
export type {
  ShardConfig,
  ShardInfo,
  ShardLevel,
  GeoLocation,
  RoutingEntry,
  ShardStats,
} from './types.js';

// Constants
export const DHT_VERSION = '2.0.0';
export const DEFAULT_SHARD_RADIUS_KM = 500;
