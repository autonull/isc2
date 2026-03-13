/**
 * DHT Configuration
 */

export const DHT_CONFIG = {
  shardLevels: {
    LOCAL: 'local',
    REGIONAL: 'regional',
    GLOBAL: 'global',
  },
  shardCapacity: {
    LOCAL_MAX_PEERS: 1000,
    REGIONAL_MAX_PEERS: 10000,
    GLOBAL_MAX_PEERS: Infinity,
  },
  replicationFactor: {
    LOCAL: 1,
    REGIONAL: 2,
    GLOBAL: 3,
  },
  gridSize: {
    LOCAL_DEGREES: 10,
    REGIONAL_DEGREES: 30,
  },
  healthThresholds: {
    CRITICAL: 0.5,
    DEGRADED: 0.7,
    OVERLOADED_LOAD: 0.9,
  },
  queryDefaults: {
    MIN_RESULTS: 10,
    MAX_NEARBY_PEERS: 20,
    MAX_DISTANCE_KM: 500,
  },
  earthRadiusKm: 6371,
} as const;

export type ShardLevel = 'local' | 'regional' | 'global';
