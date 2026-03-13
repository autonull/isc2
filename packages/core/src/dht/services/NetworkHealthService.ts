/**
 * Network Health Service
 *
 * Monitors DHT network health and identifies issues.
 */

import type { NetworkHealth, NetworkStats } from '../types/dht.js';
import { GeoShard } from '../sharding.js';
import { DHT_CONFIG } from '../config/dhtConfig.js';

export class NetworkHealthService {
  /**
   * Get network health status
   */
  getNetworkHealth(shards: GeoShard[], stats: NetworkStats): NetworkHealth {
    const issues: string[] = [];

    // Check for unhealthy shards
    const unhealthyShards = shards.filter(s => s.getHealthScore() < DHT_CONFIG.healthThresholds.CRITICAL);

    if (unhealthyShards.length > 0) {
      issues.push(`${unhealthyShards.length} shards with low health`);
    }

    // Check for overloaded shards
    const overloadedShards = shards.filter(s => s.getStats().loadFactor > DHT_CONFIG.healthThresholds.OVERLOADED_LOAD);

    if (overloadedShards.length > 0) {
      issues.push(`${overloadedShards.length} shards near capacity`);
    }

    // Determine overall status
    let status: NetworkHealth['status'] = 'healthy';
    if (stats.avgHealth < DHT_CONFIG.healthThresholds.CRITICAL) {
      status = 'critical';
    } else if (stats.avgHealth < DHT_CONFIG.healthThresholds.DEGRADED || issues.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      totalShards: stats.totalShards,
      totalPeers: stats.totalPeers,
      avgHealth: stats.avgHealth,
      issues,
    };
  }

  /**
   * Check shard health
   */
  checkShardHealth(shard: GeoShard): {
    healthy: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const stats = shard.getStats();

    if (stats.healthScore < DHT_CONFIG.healthThresholds.CRITICAL) {
      issues.push('Low health score');
    }

    if (stats.loadFactor > DHT_CONFIG.healthThresholds.OVERLOADED_LOAD) {
      issues.push('Near capacity');
    }

    const capacity = shard.getInfo().peerCount >= (shard as any).config?.maxPeers;
    if (capacity) {
      issues.push('At maximum capacity');
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Get shards needing attention
   */
  getShardsNeedingAttention(shards: GeoShard[]): Array<{
    shardID: string;
    issues: string[];
    priority: 'high' | 'medium' | 'low';
  }> {
    return shards
      .map(shard => {
        const health = this.checkShardHealth(shard);
        const stats = shard.getStats();

        let priority: 'high' | 'medium' | 'low' = 'low';
        if (stats.healthScore < DHT_CONFIG.healthThresholds.CRITICAL) {
          priority = 'high';
        } else if (stats.loadFactor > DHT_CONFIG.healthThresholds.OVERLOADED_LOAD) {
          priority = 'medium';
        } else if (health.issues.length > 0) {
          priority = 'low';
        }

        return {
          shardID: shard.getInfo().shardID,
          issues: health.issues,
          priority,
        };
      })
      .filter(s => s.issues.length > 0)
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }
}
