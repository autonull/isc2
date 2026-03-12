/**
 * Cross-Shard Router
 * 
 * Routes queries across the shard hierarchy.
 * Optimizes for local-first discovery with fallback to regional/global.
 */

import type {
  ShardInfo,
  GeoLocation,
  RoutingEntry,
  CrossShardResult,
  LoadBalanceDecision,
} from './types.js';
import { GeoShard, calculateDistance, generateShardID } from './sharding.js';

/**
 * Cross-Shard Router class
 */
export class CrossShardRouter {
  private shards: Map<string, GeoShard> = new Map();
  private shardIndex: Map<string, string> = new Map();  // peerID -> shardID
  private localShardID?: string;

  /**
   * Register a shard
   */
  registerShard(shard: GeoShard): void {
    this.shards.set(shard.getInfo().shardID, shard);
  }

  /**
   * Unregister a shard
   */
  unregisterShard(shardID: string): boolean {
    return this.shards.delete(shardID);
  }

  /**
   * Set local shard (current peer's shard)
   */
  setLocalShard(shardID: string): void {
    this.localShardID = shardID;
  }

  /**
   * Get local shard
   */
  getLocalShard(): GeoShard | undefined {
    if (!this.localShardID) return undefined;
    return this.shards.get(this.localShardID);
  }

  /**
   * Find shard for a location
   */
  findShardForLocation(location: GeoLocation, level: 'local' | 'regional' | 'global' = 'local'): GeoShard | undefined {
    const shardID = generateShardID(level, location);
    return this.shards.get(shardID);
  }

  /**
   * Route a query through the hierarchy
   * 
   * Query strategy:
   * 1. Local shard first (fastest, most relevant)
   * 2. Regional shards if not enough results
   * 3. Global shard as fallback
   */
  routeQuery(
    key: string,
    location: GeoLocation,
    minResults: number = 10,
    _maxLatency: number = 500
  ): CrossShardResult {
    const startTime = Date.now();
    const result: CrossShardResult = {
      localResults: [],
      regionalResults: [],
      globalResults: [],
      totalResults: 0,
      queryTime: 0,
      shardsQueried: 0,
    };

    // 1. Query local shard
    const localShard = this.getLocalShard();
    if (localShard) {
      const value = localShard.retrieveData(key);
      if (value) {
        result.localResults.push(value);
      }
      result.shardsQueried++;
    }

    // Check if we have enough results
    if (result.localResults.length >= minResults) {
      result.totalResults = result.localResults.length;
      result.queryTime = Date.now() - startTime;
      return result;
    }

    // 2. Query nearby regional shards
    const regionalShards = this.getNearbyShards(location, 'regional', 5);
    for (const shard of regionalShards) {
      if (result.localResults.length + result.regionalResults.length >= minResults) {
        break;
      }

      const value = shard.retrieveData(key);
      if (value) {
        result.regionalResults.push(value);
      }
      result.shardsQueried++;
    }

    // Check if we have enough results
    if (result.localResults.length + result.regionalResults.length >= minResults) {
      result.totalResults = result.localResults.length + result.regionalResults.length;
      result.queryTime = Date.now() - startTime;
      return result;
    }

    // 3. Query global shard as fallback
    const globalShard = this.shards.get('global');
    if (globalShard) {
      const value = globalShard.retrieveData(key);
      if (value) {
        result.globalResults.push(value);
      }
      result.shardsQueried++;
    }

    result.totalResults =
      result.localResults.length +
      result.regionalResults.length +
      result.globalResults.length;
    result.queryTime = Date.now() - startTime;

    return result;
  }

  /**
   * Get nearby shards for a location
   */
  getNearbyShards(
    location: GeoLocation,
    level: 'local' | 'regional' | 'global',
    maxShards: number = 5
  ): GeoShard[] {
    const shardsWithDistance: Array<{ shard: GeoShard; distance: number }> = [];

    for (const shard of this.shards.values()) {
      const info = shard.getInfo();
      if (info.level !== level) continue;
      if (!info.location) continue;

      const distance = calculateDistance(location, info.location);
      shardsWithDistance.push({ shard, distance });
    }

    // Sort by distance and return closest
    shardsWithDistance.sort((a, b) => a.distance - b.distance);
    return shardsWithDistance.slice(0, maxShards).map(s => s.shard);
  }

  /**
   * Add peer to appropriate shard
   */
  addPeerToShard(entry: RoutingEntry): { success: boolean; shardID?: string; error?: string } {
    if (!entry.location) {
      return { success: false, error: 'Peer location required' };
    }

    // Find or create local shard
    const shardID = generateShardID('local', entry.location);
    let shard = this.shards.get(shardID);

    if (!shard) {
      // Create new shard
      const config = {
        level: 'local' as const,
        shardID,
        parentShard: 'global',
        maxPeers: 1000,
        replicationFactor: 1,
        geoBounds: this.calculateShardBounds(entry.location),
      };
      shard = new GeoShard(config);
      this.registerShard(shard);
    }

    // Try to add peer
    if (shard.addPeer(entry)) {
      this.shardIndex.set(entry.peerID, shardID);

      // Check if shard needs splitting
      if (shard.needsSplit()) {
        this.handleShardSplit(shard);
      }

      return { success: true, shardID };
    }

    return { success: false, error: 'Shard is full' };
  }

  /**
   * Remove peer from shard
   */
  removePeerFromShard(peerID: string): boolean {
    const shardID = this.shardIndex.get(peerID);
    if (!shardID) return false;

    const shard = this.shards.get(shardID);
    if (!shard) return false;

    const success = shard.removePeer(peerID);
    if (success) {
      this.shardIndex.delete(peerID);
    }

    return success;
  }

  /**
   * Get peer's shard
   */
  getPeerShard(peerID: string): GeoShard | undefined {
    const shardID = this.shardIndex.get(peerID);
    if (!shardID) return undefined;
    return this.shards.get(shardID);
  }

  /**
   * Handle shard splitting
   */
  private handleShardSplit(shard: GeoShard): void {
    const info = shard.getInfo();
    if (info.level === 'global') return;  // Don't split global

    const { shard1, shard2 } = shard.split();

    // Register new shards
    this.registerShard(shard1);
    this.registerShard(shard2);

    // Update parent shard's child list
    if (info.parentShard) {
      const parent = this.shards.get(info.parentShard);
      if (parent) {
        // Would update parent's child shards here
        // const _config = parent.getInfo();
      }
    }

    // Remove old shard
    this.unregisterShard(info.shardID);

    // Update peer index
    shard1.getAllPeers().forEach(p => {
      this.shardIndex.set(p.peerID, shard1.getInfo().shardID);
    });
    shard2.getAllPeers().forEach(p => {
      this.shardIndex.set(p.peerID, shard2.getInfo().shardID);
    });
  }

  /**
   * Calculate geographic bounds for a shard
   */
  private calculateShardBounds(location: GeoLocation, gridSize: number = 10): any {
    return {
      north: Math.min(90, location.latitude + gridSize / 2),
      south: Math.max(-90, location.latitude - gridSize / 2),
      east: Math.min(180, location.longitude + gridSize / 2),
      west: Math.max(-180, location.longitude - gridSize / 2),
    };
  }

  /**
   * Make load balancing decision
   */
  makeLoadBalanceDecision(): LoadBalanceDecision[] {
    const decisions: LoadBalanceDecision[] = [];

    for (const shard of this.shards.values()) {
      const stats = shard.getStats();

      // Check if shard needs splitting
      if (stats.loadFactor > 0.9) {
        decisions.push({
          action: 'split',
          sourceShard: stats.shardID,
          reason: `High load factor: ${stats.loadFactor.toFixed(2)}`,
          priority: Math.floor(stats.loadFactor * 10),
        });
      }

      // Check if shard is unhealthy
      if (stats.healthScore < 0.5) {
        decisions.push({
          action: 'migrate',
          sourceShard: stats.shardID,
          reason: `Low health score: ${stats.healthScore.toFixed(2)}`,
          priority: Math.floor((1 - stats.healthScore) * 10),
        });
      }
    }

    // Sort by priority
    decisions.sort((a, b) => b.priority - a.priority);

    return decisions;
  }

  /**
   * Get all shard info
   */
  getAllShardInfo(): ShardInfo[] {
    return Array.from(this.shards.values()).map(s => s.getInfo());
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): {
    totalShards: number;
    totalPeers: number;
    avgHealth: number;
    avgLatency: number;
    shardDistribution: Record<string, number>;
  } {
    const shards = this.getAllShardInfo();
    const totalPeers = shards.reduce((sum, s) => sum + s.peerCount, 0);
    const avgHealth = shards.reduce((sum, s) => sum + s.health, 0) / shards.length;
    const avgLatency = shards.reduce((sum, s) => sum + s.latency, 0) / shards.length;

    const shardDistribution: Record<string, number> = {};
    for (const shard of shards) {
      shardDistribution[shard.shardID] = shard.peerCount;
    }

    return {
      totalShards: shards.length,
      totalPeers,
      avgHealth,
      avgLatency,
      shardDistribution,
    };
  }

  /**
   * Export router state
   */
  export(): {
    shards: Map<string, any>;
    shardIndex: Map<string, string>;
    localShardID?: string;
  } {
    const shardExports = new Map();
    for (const [id, shard] of this.shards.entries()) {
      shardExports.set(id, shard.export());
    }

    return {
      shards: shardExports,
      shardIndex: new Map(this.shardIndex),
      localShardID: this.localShardID,
    };
  }

  /**
   * Import router state
   */
  import(state: {
    shards: Map<string, any>;
    shardIndex: Map<string, string>;
    localShardID?: string;
  }): void {
    this.shards.clear();
    for (const [id, shardData] of state.shards.entries()) {
      const shard = new GeoShard(shardData.config);
      shard.import(shardData);
      this.shards.set(id, shard);
    }

    this.shardIndex = new Map(state.shardIndex);
    this.localShardID = state.localShardID;
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.shards.clear();
    this.shardIndex.clear();
    this.localShardID = undefined;
  }
}
