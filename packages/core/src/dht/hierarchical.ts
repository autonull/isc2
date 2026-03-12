/**
 * Hierarchical DHT
 * 
 * Three-level DHT hierarchy for scalable peer discovery:
 * - Local: Geographic shards (~1000 peers)
 * - Regional: Aggregates local shards (~10000 peers)
 * - Global: Root level for cross-region discovery
 */

import type {
  ShardInfo,
  GeoLocation,
  RoutingEntry,
  CrossShardResult,
  ShardStats,
} from './types.js';
import { GeoShard, generateShardID } from './sharding.js';
import { CrossShardRouter } from './routing.js';

/**
 * Hierarchical DHT class
 */
export class HierarchicalDHT {
  private router: CrossShardRouter;
  private globalShard: GeoShard;
  private regionalShards: Map<string, GeoShard> = new Map();
  private localShards: Map<string, GeoShard> = new Map();
  private peerLocation: Map<string, GeoLocation> = new Map();

  constructor() {
    this.router = new CrossShardRouter();

    // Initialize global shard
    this.globalShard = new GeoShard({
      level: 'global',
      shardID: 'global',
      maxPeers: Infinity,
      replicationFactor: 3,
    });

    this.router.registerShard(this.globalShard);
    this.router.setLocalShard('global');
  }

  /**
   * Initialize DHT with peer location
   */
  initialize(peerID: string, location: GeoLocation): void {
    this.peerLocation.set(peerID, location);

    // Join local shard
    const localShardID = generateShardID('local', location);
    this.router.setLocalShard(localShardID);

    // Ensure regional shard exists
    const regionalShardID = generateShardID('regional', location);
    this.getOrCreateRegionalShard(regionalShardID, location);

    // Ensure local shard exists
    this.getOrCreateLocalShard(localShardID, location);
  }

  /**
   * Announce data to DHT
   * 
   * Data is replicated across hierarchy levels based on config
   */
  announce(
    key: string,
    value: any,
    ttl: number,
    location?: GeoLocation,
    replicateGlobal: boolean = false
  ): { success: boolean; shards: string[] } {
    const shards: string[] = [];

    // Store in local shard
    const localShard = this.router.getLocalShard();
    if (localShard) {
      localShard.storeData(key, value, ttl);
      shards.push(localShard.getInfo().shardID);
    }

    // Store in regional shard
    if (location) {
      const regionalShardID = generateShardID('regional', location);
      const regionalShard = this.regionalShards.get(regionalShardID);
      if (regionalShard) {
        regionalShard.storeData(key, value, ttl);
        shards.push(regionalShardID);
      }
    }

    // Optionally replicate to global
    if (replicateGlobal) {
      this.globalShard.storeData(key, value, ttl);
      shards.push('global');
    }

    return { success: shards.length > 0, shards };
  }

  /**
   * Query DHT for data
   * 
   * Uses hierarchical routing: local → regional → global
   */
  query(
    key: string,
    location?: GeoLocation,
    minResults: number = 10
  ): CrossShardResult {
    const queryLocation = location || this.getAverageLocation();

    if (!queryLocation) {
      // Fallback to global query
      const value = this.globalShard.retrieveData(key);
      return {
        localResults: [],
        regionalResults: [],
        globalResults: value ? [value] : [],
        totalResults: value ? 1 : 0,
        queryTime: 1,
        shardsQueried: 1,
      };
    }

    return this.router.routeQuery(key, queryLocation, minResults);
  }

  /**
   * Add peer to DHT
   */
  addPeer(entry: RoutingEntry): { success: boolean; shardID?: string } {
    if (entry.location) {
      this.peerLocation.set(entry.peerID, entry.location);
    }

    const result = this.router.addPeerToShard(entry);

    // Also add to global shard for backup discovery
    if (result.success) {
      this.globalShard.addPeer(entry);
    }

    return {
      success: result.success,
      shardID: result.shardID,
    };
  }

  /**
   * Remove peer from DHT
   */
  removePeer(peerID: string): boolean {
    this.peerLocation.delete(peerID);
    this.router.removePeerFromShard(peerID);
    return true;
  }

  /**
   * Get peers near a location
   */
  getNearbyPeers(
    location: GeoLocation,
    maxPeers: number = 20,
    maxDistanceKm: number = 500
  ): RoutingEntry[] {
    const nearbyShards = this.router.getNearbyShards(location, 'local', 5);
    const peers: RoutingEntry[] = [];

    for (const shard of nearbyShards) {
      for (const peer of shard.getAllPeers()) {
        if (!peer.location) continue;

        const distance = this.calculateDistance(location, peer.location);
        if (distance <= maxDistanceKm) {
          peers.push({ ...peer, latency: distance });  // Use distance as latency proxy
        }

        if (peers.length >= maxPeers) {
          return peers;
        }
      }
    }

    return peers;
  }

  /**
   * Get shard statistics
   */
  getShardStats(shardID?: string): ShardStats | undefined {
    if (shardID) {
      const shard = this.router.getPeerShard(shardID) ||
                    this.localShards.get(shardID) ||
                    this.regionalShards.get(shardID);
      if (shard) {
        return shard.getStats();
      }
      return undefined;
    }

    // Return aggregate stats
    const allShards = [
      this.globalShard,
      ...Array.from(this.regionalShards.values()),
      ...Array.from(this.localShards.values()),
    ];

    const stats = allShards.map(s => s.getStats());
    return this.aggregateStats(stats);
  }

  /**
   * Get network health
   */
  getNetworkHealth(): {
    status: 'healthy' | 'degraded' | 'critical';
    totalShards: number;
    totalPeers: number;
    avgHealth: number;
    issues: string[];
  } {
    const networkStats = this.router.getNetworkStats();
    const issues: string[] = [];

    // Check for unhealthy shards
    const unhealthyShards = Array.from(this.localShards.values())
      .filter(s => s.getHealthScore() < 0.5);

    if (unhealthyShards.length > 0) {
      issues.push(`${unhealthyShards.length} shards with low health`);
    }

    // Check for overloaded shards
    const overloadedShards = Array.from(this.localShards.values())
      .filter(s => s.getStats().loadFactor > 0.9);

    if (overloadedShards.length > 0) {
      issues.push(`${overloadedShards.length} shards near capacity`);
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (networkStats.avgHealth < 0.5) {
      status = 'critical';
    } else if (networkStats.avgHealth < 0.7 || issues.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      totalShards: networkStats.totalShards,
      totalPeers: networkStats.totalPeers,
      avgHealth: networkStats.avgHealth,
      issues,
    };
  }

  /**
   * Get load balancing decisions
   */
  getLoadBalanceDecisions() {
    return this.router.makeLoadBalanceDecision();
  }

  /**
   * Execute load balancing
   */
  executeLoadBalancing(): { migrated: number; split: number } {
    const decisions = this.getLoadBalanceDecisions();
    let migrated = 0;
    let split = 0;

    for (const decision of decisions) {
      if (decision.action === 'split' && decision.sourceShard) {
        // Shard splitting is handled automatically in addPeerToShard
        split++;
      } else if (decision.action === 'migrate' && decision.sourceShard) {
        // Would migrate peers to healthier shard
        migrated++;
      }
    }

    return { migrated, split };
  }

  /**
   * Get all shard info
   */
  getAllShardInfo(): ShardInfo[] {
    return this.router.getAllShardInfo();
  }

  /**
   * Helper: Get or create regional shard
   */
  private getOrCreateRegionalShard(shardID: string, location: GeoLocation): GeoShard {
    let shard = this.regionalShards.get(shardID);

    if (!shard) {
      shard = new GeoShard({
        level: 'regional',
        shardID,
        parentShard: 'global',
        maxPeers: 10000,
        replicationFactor: 2,
        geoBounds: this.calculateShardBounds(location, 30),  // 30-degree grid
      });

      this.regionalShards.set(shardID, shard);
      this.router.registerShard(shard);
    }

    return shard;
  }

  /**
   * Helper: Get or create local shard
   */
  private getOrCreateLocalShard(shardID: string, location: GeoLocation): GeoShard {
    let shard = this.localShards.get(shardID);

    if (!shard) {
      shard = new GeoShard({
        level: 'local',
        shardID,
        parentShard: generateShardID('regional', location),
        maxPeers: 1000,
        replicationFactor: 1,
        geoBounds: this.calculateShardBounds(location, 10),  // 10-degree grid
      });

      this.localShards.set(shardID, shard);
      this.router.registerShard(shard);
    }

    return shard;
  }

  /**
   * Helper: Calculate shard bounds
   */
  private calculateShardBounds(location: GeoLocation, gridSize: number): any {
    return {
      north: Math.min(90, location.latitude + gridSize / 2),
      south: Math.max(-90, location.latitude - gridSize / 2),
      east: Math.min(180, location.longitude + gridSize / 2),
      west: Math.max(-180, location.longitude - gridSize / 2),
    };
  }

  /**
   * Helper: Calculate distance
   */
  private calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
    const R = 6371;  // Earth radius in km
    const dLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
    const dLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;
    const lat1 = (loc1.latitude * Math.PI) / 180;
    const lat2 = (loc2.latitude * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Helper: Get average location of all peers
   */
  private getAverageLocation(): GeoLocation | undefined {
    if (this.peerLocation.size === 0) return undefined;

    let sumLat = 0;
    let sumLon = 0;

    for (const loc of this.peerLocation.values()) {
      sumLat += loc.latitude;
      sumLon += loc.longitude;
    }

    const count = this.peerLocation.size;
    return {
      latitude: sumLat / count,
      longitude: sumLon / count,
    };
  }

  /**
   * Helper: Aggregate stats
   */
  private aggregateStats(stats: ShardStats[]): ShardStats {
    if (stats.length === 0) {
      return {
        shardID: 'aggregate',
        totalPeers: 0,
        activePeers: 0,
        dataEntries: 0,
        avgLatency: 0,
        healthScore: 0,
        loadFactor: 0,
        splitHistory: [],
      };
    }

    return {
      shardID: 'aggregate',
      totalPeers: stats.reduce((sum, s) => sum + s.totalPeers, 0),
      activePeers: stats.reduce((sum, s) => sum + s.activePeers, 0),
      dataEntries: stats.reduce((sum, s) => sum + s.dataEntries, 0),
      avgLatency: stats.reduce((sum, s) => sum + s.avgLatency, 0) / stats.length,
      healthScore: stats.reduce((sum, s) => sum + s.healthScore, 0) / stats.length,
      loadFactor: stats.reduce((sum, s) => sum + s.loadFactor, 0) / stats.length,
      splitHistory: stats.flatMap(s => s.splitHistory),
    };
  }

  /**
   * Export DHT state
   */
  export(): any {
    return {
      router: this.router.export(),
      regionalShards: Array.from(this.regionalShards.entries()).map(([id, s]) => [id, s.export()]),
      localShards: Array.from(this.localShards.entries()).map(([id, s]) => [id, s.export()]),
      peerLocation: Array.from(this.peerLocation.entries()),
    };
  }

  /**
   * Import DHT state
   */
  import(state: any): void {
    this.router.import(state.router);

    this.regionalShards.clear();
    for (const [id, shardData] of state.regionalShards) {
      const shard = new GeoShard(shardData.config);
      shard.import(shardData);
      this.regionalShards.set(id, shard);
    }

    this.localShards.clear();
    for (const [id, shardData] of state.localShards) {
      const shard = new GeoShard(shardData.config);
      shard.import(shardData);
      this.localShards.set(id, shard);
    }

    this.peerLocation.clear();
    for (const [peerID, location] of state.peerLocation) {
      this.peerLocation.set(peerID, location);
    }
  }
}
