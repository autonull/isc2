/**
 * Shard Manager Service
 *
 * Manages shard lifecycle, creation, and retrieval.
 */

import type { GeoLocation, ShardInfo, ShardStats } from '../types/dht.js';
import { GeoShard } from '../sharding.js';
import { CrossShardRouter } from '../routing.js';
import { ShardFactory } from '../factory/ShardFactory.js';
import { generateShardID } from '../sharding.js';
import { DHT_CONFIG } from '../config/dhtConfig.js';
import { GeoService } from './GeoService.js';

export class ShardManager {
  private router: CrossShardRouter;
  private globalShard: GeoShard;
  private regionalShards: Map<string, GeoShard> = new Map();
  private localShards: Map<string, GeoShard> = new Map();
  private peerLocations: Map<string, GeoLocation> = new Map();

  constructor() {
    this.router = new CrossShardRouter();
    this.globalShard = ShardFactory.createGlobalShard();
    this.router.registerShard(this.globalShard);
    this.router.setLocalShard(DHT_CONFIG.shardLevels.GLOBAL);
  }

  /**
   * Initialize DHT for a peer
   */
  initialize(peerID: string, location: GeoLocation): void {
    this.peerLocations.set(peerID, location);

    const localShardID = generateShardID('local', location);
    this.router.setLocalShard(localShardID);

    const regionalShardID = generateShardID('regional', location);
    this.getOrCreateRegionalShard(regionalShardID, location);
    this.getOrCreateLocalShard(localShardID, location);
  }

  /**
   * Get or create regional shard
   */
  getOrCreateRegionalShard(shardID: string, location: GeoLocation): GeoShard {
    let shard = this.regionalShards.get(shardID);

    if (!shard) {
      shard = ShardFactory.createRegionalShard(shardID, location);
      this.regionalShards.set(shardID, shard);
      this.router.registerShard(shard);
    }

    return shard;
  }

  /**
   * Get or create local shard
   */
  getOrCreateLocalShard(shardID: string, location: GeoLocation): GeoShard {
    let shard = this.localShards.get(shardID);

    if (!shard) {
      const regionalShardID = generateShardID('regional', location);
      shard = ShardFactory.createLocalShard(shardID, location, regionalShardID);
      this.localShards.set(shardID, shard);
      this.router.registerShard(shard);
    }

    return shard;
  }

  /**
   * Get shard by ID
   */
  getShard(shardID: string): GeoShard | undefined {
    return (
      this.localShards.get(shardID) ||
      this.regionalShards.get(shardID) ||
      (shardID === DHT_CONFIG.shardLevels.GLOBAL ? this.globalShard : undefined)
    );
  }

  /**
   * Get all shards
   */
  getAllShards(): GeoShard[] {
    return [
      this.globalShard,
      ...Array.from(this.regionalShards.values()),
      ...Array.from(this.localShards.values()),
    ];
  }

  /**
   * Get all shard info
   */
  getAllShardInfo(): ShardInfo[] {
    return this.getAllShards().map(s => s.getInfo());
  }

  /**
   * Get shard stats
   */
  getShardStats(shardID?: string): ShardStats | undefined {
    if (shardID) {
      const shard = this.getShard(shardID);
      return shard?.getStats();
    }

    const allShards = this.getAllShards();
    const stats = allShards.map(s => s.getStats());
    return this.aggregateStats(stats);
  }

  /**
   * Get router
   */
  getRouter(): CrossShardRouter {
    return this.router;
  }

  /**
   * Get global shard
   */
  getGlobalShard(): GeoShard {
    return this.globalShard;
  }

  /**
   * Get peer location
   */
  getPeerLocation(peerID: string): GeoLocation | undefined {
    return this.peerLocations.get(peerID);
  }

  /**
   * Get all peer locations
   */
  getAllPeerLocations(): Map<string, GeoLocation> {
    return new Map(this.peerLocations);
  }

  /**
   * Get average peer location
   */
  getAveragePeerLocation(): GeoLocation | undefined {
    if (this.peerLocations.size === 0) return undefined;

    const locations = Array.from(this.peerLocations.values());
    return GeoService.calculateAverageLocation(locations);
  }

  /**
   * Aggregate stats from multiple shards
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
   * Export state
   */
  export(): any {
    return {
      router: this.router.export(),
      regionalShards: Array.from(this.regionalShards.entries()).map(([id, s]) => [id, s.export()]),
      localShards: Array.from(this.localShards.entries()).map(([id, s]) => [id, s.export()]),
      peerLocations: Array.from(this.peerLocations.entries()),
    };
  }

  /**
   * Import state
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

    this.peerLocations.clear();
    for (const [peerID, location] of state.peerLocations) {
      this.peerLocations.set(peerID, location);
    }
  }
}
