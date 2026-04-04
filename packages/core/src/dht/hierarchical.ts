/* eslint-disable */
/**
 * Hierarchical DHT
 *
 * Three-level DHT hierarchy for scalable peer discovery:
 * - Local: Geographic shards (~1000 peers)
 * - Regional: Aggregates local shards (~10000 peers)
 * - Global: Root level for cross-region discovery
 *
 * Facade that coordinates DHT services.
 */

export type {
  ShardInfo,
  GeoLocation,
  RoutingEntry,
  CrossShardResult,
  ShardStats,
  NetworkStats,
  LoadBalanceDecision,
  GeoBounds,
  ShardConfig,
  ShardLevel,
  NetworkHealth,
} from './types/dht.js';

export { DHT_CONFIG } from './config/dhtConfig.js';

export { ShardFactory } from './factory/ShardFactory.js';

export { GeoService } from './services/GeoService.js';
export { ShardManager } from './services/ShardManager.js';
export { NetworkHealthService } from './services/NetworkHealthService.js';
export { LoadBalancerService } from './services/LoadBalancerService.js';

import type {
  GeoLocation,
  RoutingEntry,
  CrossShardResult,
  ShardInfo,
  ShardStats,
  NetworkHealth,
  LoadBalanceDecision,
} from './types/dht.js';
import { ShardManager } from './services/ShardManager.js';
import { NetworkHealthService } from './services/NetworkHealthService.js';
import { LoadBalancerService } from './services/LoadBalancerService.js';
import { GeoService } from './services/GeoService.js';
import { generateShardID } from './sharding.js';
import { DHT_CONFIG } from './config/dhtConfig.js';

export class HierarchicalDHT {
  private shardManager: ShardManager;
  private healthService: NetworkHealthService;
  private loadBalancer: LoadBalancerService;

  constructor() {
    this.shardManager = new ShardManager();
    this.healthService = new NetworkHealthService();
    this.loadBalancer = new LoadBalancerService();
  }

  /**
   * Initialize DHT with peer location
   */
  initialize(peerID: string, location: GeoLocation): void {
    this.shardManager.initialize(peerID, location);
  }

  /**
   * Announce data to DHT
   */
  announce(
    key: string,
    value: any,
    ttl: number,
    location?: GeoLocation,
    replicateGlobal: boolean = false
  ): { success: boolean; shards: string[] } {
    const shards: string[] = [];
    const router = this.shardManager.getRouter();

    // Store in local shard
    const localShard = router.getLocalShard();
    if (localShard) {
      localShard.storeData(key, value, ttl);
      shards.push(localShard.getInfo().shardID);
    }

    // Store in regional shard
    if (location) {
      const regionalShardID = generateShardID('regional', location);
      const regionalShard = this.shardManager.getShard(regionalShardID);
      if (regionalShard) {
        regionalShard.storeData(key, value, ttl);
        shards.push(regionalShardID);
      }
    }

    // Optionally replicate to global
    if (replicateGlobal) {
      this.shardManager.getGlobalShard().storeData(key, value, ttl);
      shards.push(DHT_CONFIG.shardLevels.GLOBAL);
    }

    return { success: shards.length > 0, shards };
  }

  /**
   * Query DHT for data
   */
  query(
    key: string,
    location?: GeoLocation,
    minResults: number = DHT_CONFIG.queryDefaults.MIN_RESULTS
  ): CrossShardResult {
    const queryLocation = location || this.shardManager.getAveragePeerLocation();

    if (!queryLocation) {
      const value = this.shardManager.getGlobalShard().retrieveData(key);
      return {
        localResults: [],
        regionalResults: [],
        globalResults: value ? [value] : [],
        totalResults: value ? 1 : 0,
        queryTime: 1,
        shardsQueried: 1,
      };
    }

    return this.shardManager.getRouter().routeQuery(key, queryLocation, minResults);
  }

  /**
   * Add peer to DHT
   */
  addPeer(entry: RoutingEntry): { success: boolean; shardID?: string } {
    const result = this.shardManager.getRouter().addPeerToShard(entry);

    // Also add to global shard for backup discovery
    if (result.success) {
      this.shardManager.getGlobalShard().addPeer(entry);
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
    this.shardManager.getRouter().removePeerFromShard(peerID);
    return true;
  }

  /**
   * Get peers near a location
   */
  getNearbyPeers(
    location: GeoLocation,
    maxPeers: number = DHT_CONFIG.queryDefaults.MAX_NEARBY_PEERS,
    maxDistanceKm: number = DHT_CONFIG.queryDefaults.MAX_DISTANCE_KM
  ): RoutingEntry[] {
    const nearbyShards = this.shardManager
      .getRouter()
      .getNearbyShards(location, 'local', 5);

    const peers: RoutingEntry[] = [];

    for (const shard of nearbyShards) {
      for (const peer of shard.getAllPeers()) {
        if (!peer.location) {continue;}

        const distance = GeoService.calculateDistance(location, peer.location);
        if (distance <= maxDistanceKm) {
          peers.push({ ...peer, latency: distance });
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
    return this.shardManager.getShardStats(shardID);
  }

  /**
   * Get network health
   */
  getNetworkHealth(): NetworkHealth {
    const shards = this.shardManager.getAllShards();
    const stats = this.shardManager.getRouter().getNetworkStats();
    return this.healthService.getNetworkHealth(shards, stats);
  }

  /**
   * Get load balancing decisions
   */
  getLoadBalanceDecisions(): LoadBalanceDecision[] {
    const shards = this.shardManager.getAllShards();
    return this.loadBalancer.makeDecisions(shards);
  }

  /**
   * Execute load balancing
   */
  executeLoadBalancing(): { migrated: number; split: number } {
    const shards = this.shardManager.getAllShards();
    return this.loadBalancer.executeLoadBalancing(shards);
  }

  /**
   * Get all shard info
   */
  getAllShardInfo(): ShardInfo[] {
    return this.shardManager.getAllShardInfo();
  }

  /**
   * Export DHT state
   */
  export(): any {
    return this.shardManager.export();
  }

  /**
   * Import DHT state
   */
  import(state: any): void {
    this.shardManager.import(state);
  }
}
