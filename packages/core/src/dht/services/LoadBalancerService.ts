/* eslint-disable */
/**
 * Load Balancer Service
 *
 * Makes load balancing decisions for shard management.
 */

import type { LoadBalanceDecision } from '../types/dht.js';
import type { GeoShard } from '../sharding.js';
import { DHT_CONFIG } from '../config/dhtConfig.js';

export class LoadBalancerService {
  /**
   * Make load balancing decisions
   */
  makeDecisions(shards: GeoShard[]): LoadBalanceDecision[] {
    const decisions: LoadBalanceDecision[] = [];

    for (const shard of shards) {
      const decision = this.evaluateShard(shard);
      if (decision.action !== 'none') {
        decisions.push(decision);
      }
    }

    return decisions;
  }

  /**
   * Evaluate a single shard
   */
  private evaluateShard(shard: GeoShard): LoadBalanceDecision {
    const stats = shard.getStats();

    // Check if shard needs splitting
    if (stats.loadFactor > DHT_CONFIG.healthThresholds.OVERLOADED_LOAD) {
      return {
        action: 'split',
        sourceShard: shard.getInfo().shardID,
        reason: `Load factor ${stats.loadFactor.toFixed(2)} exceeds threshold`,
        priority: 8,
      };
    }

    // Check if shard is unhealthy and needs migration
    if (stats.healthScore < DHT_CONFIG.healthThresholds.CRITICAL) {
      return {
        action: 'migrate',
        sourceShard: shard.getInfo().shardID,
        reason: `Health score ${stats.healthScore.toFixed(2)} below threshold`,
        priority: 9,
      };
    }

    return {
      action: 'none',
      reason: 'No action needed',
      priority: 0,
    };
  }

  /**
   * Execute load balancing
   */
  executeLoadBalancing(shards: GeoShard[]): { migrated: number; split: number } {
    const decisions = this.makeDecisions(shards);
    let migrated = 0;
    let split = 0;

    for (const decision of decisions) {
      if (decision.action === 'split') {
        // Shard splitting is handled automatically in addPeerToShard
        split++;
      } else if (decision.action === 'migrate') {
        // Would migrate peers to healthier shard
        migrated++;
      }
    }

    return { migrated, split };
  }

  /**
   * Get shard splitting recommendations
   */
  getSplitRecommendations(shards: GeoShard[]): Array<{
    shardID: string;
    recommended: boolean;
    reason: string;
  }> {
    return shards.map(shard => {
      const stats = shard.getStats();
      const shouldSplit = stats.loadFactor > DHT_CONFIG.healthThresholds.OVERLOADED_LOAD;

      return {
        shardID: shard.getInfo().shardID,
        recommended: shouldSplit,
        reason: shouldSplit
          ? `Load factor ${stats.loadFactor.toFixed(2)} exceeds ${DHT_CONFIG.healthThresholds.OVERLOADED_LOAD}`
          : 'Load within acceptable range',
      };
    });
  }
}
