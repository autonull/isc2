/**
 * Shard Factory
 *
 * Creates GeoShard instances with proper configuration
 * for different hierarchy levels.
 */

import type { ShardConfig, GeoLocation, GeoBounds } from '../types/dht.js';
import { GeoShard } from '../sharding.js';
import { DHT_CONFIG } from '../config/dhtConfig.js';

export class ShardFactory {
  /**
   * Create a shard for a specific level
   */
  static createShard(
    level: 'local' | 'regional' | 'global',
    shardID: string,
    location?: GeoLocation
  ): GeoShard {
    const config = this.getShardConfig(level, shardID, location);
    return new GeoShard(config);
  }

  /**
   * Create global shard
   */
  static createGlobalShard(): GeoShard {
    return new GeoShard({
      level: DHT_CONFIG.shardLevels.GLOBAL,
      shardID: DHT_CONFIG.shardLevels.GLOBAL,
      maxPeers: DHT_CONFIG.shardCapacity.GLOBAL_MAX_PEERS,
      replicationFactor: DHT_CONFIG.replicationFactor.GLOBAL,
    });
  }

  /**
   * Create regional shard
   */
  static createRegionalShard(shardID: string, location: GeoLocation): GeoShard {
    return new GeoShard({
      level: DHT_CONFIG.shardLevels.REGIONAL,
      shardID,
      parentShard: DHT_CONFIG.shardLevels.GLOBAL,
      maxPeers: DHT_CONFIG.shardCapacity.REGIONAL_MAX_PEERS,
      replicationFactor: DHT_CONFIG.replicationFactor.REGIONAL,
      geoBounds: this.calculateShardBounds(location, DHT_CONFIG.gridSize.REGIONAL_DEGREES),
    });
  }

  /**
   * Create local shard
   */
  static createLocalShard(shardID: string, location: GeoLocation, parentShard: string): GeoShard {
    return new GeoShard({
      level: DHT_CONFIG.shardLevels.LOCAL,
      shardID,
      parentShard,
      maxPeers: DHT_CONFIG.shardCapacity.LOCAL_MAX_PEERS,
      replicationFactor: DHT_CONFIG.replicationFactor.LOCAL,
      geoBounds: this.calculateShardBounds(location, DHT_CONFIG.gridSize.LOCAL_DEGREES),
    });
  }

  /**
   * Get shard configuration
   */
  private static getShardConfig(
    level: 'local' | 'regional' | 'global',
    shardID: string,
    location?: GeoLocation,
    parentShard?: string
  ): ShardConfig {
    switch (level) {
      case 'global':
        return {
          level: DHT_CONFIG.shardLevels.GLOBAL,
          shardID: DHT_CONFIG.shardLevels.GLOBAL,
          maxPeers: DHT_CONFIG.shardCapacity.GLOBAL_MAX_PEERS,
          replicationFactor: DHT_CONFIG.replicationFactor.GLOBAL,
        };
      case 'regional':
        if (!location) {
          throw new Error('Location required for regional shard');
        }
        return {
          level: DHT_CONFIG.shardLevels.REGIONAL,
          shardID,
          parentShard: DHT_CONFIG.shardLevels.GLOBAL,
          maxPeers: DHT_CONFIG.shardCapacity.REGIONAL_MAX_PEERS,
          replicationFactor: DHT_CONFIG.replicationFactor.REGIONAL,
          geoBounds: this.calculateShardBounds(location, DHT_CONFIG.gridSize.REGIONAL_DEGREES),
        };
      case 'local':
        if (!location || !parentShard) {
          throw new Error('Location and parentShard required for local shard');
        }
        return {
          level: DHT_CONFIG.shardLevels.LOCAL,
          shardID,
          parentShard,
          maxPeers: DHT_CONFIG.shardCapacity.LOCAL_MAX_PEERS,
          replicationFactor: DHT_CONFIG.replicationFactor.LOCAL,
          geoBounds: this.calculateShardBounds(location, DHT_CONFIG.gridSize.LOCAL_DEGREES),
        };
      default:
        throw new Error(`Unknown shard level: ${level}`);
    }
  }

  /**
   * Calculate shard geographic bounds
   */
  static calculateShardBounds(location: GeoLocation, gridSize: number): GeoBounds {
    return {
      north: Math.min(90, location.latitude + gridSize / 2),
      south: Math.max(-90, location.latitude - gridSize / 2),
      east: Math.min(180, location.longitude + gridSize / 2),
      west: Math.max(-180, location.longitude - gridSize / 2),
    };
  }
}
