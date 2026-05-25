/* eslint-disable */
import type {
  ShardInfo,
  GeoLocation,
  RoutingEntry,
  CrossShardResult,
  LoadBalanceDecision,
} from './types.js';
import { GeoShard, calculateDistance, generateShardID } from './sharding.js';

export class CrossShardRouter {
  private shards: Map<string, GeoShard> = new Map();
  private shardIndex: Map<string, string> = new Map();
  private localShardID?: string;

  registerShard(shard: GeoShard): void {
    this.shards.set(shard.getInfo().shardID, shard);
  }

  unregisterShard(shardID: string): boolean {
    return this.shards.delete(shardID);
  }

  setLocalShard(shardID: string): void {
    this.localShardID = shardID;
  }

  getLocalShard(): GeoShard | undefined {
    return this.localShardID ? this.shards.get(this.localShardID) : undefined;
  }

  findShardForLocation(location: GeoLocation, level: 'local' | 'regional' | 'global' = 'local'): GeoShard | undefined {
    return this.shards.get(generateShardID(level, location));
  }

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

    const localShard = this.getLocalShard();
    if (localShard) {
      const value = localShard.retrieveData(key);
      if (value) {result.localResults.push(value);}
      result.shardsQueried++;
    }

    if (result.localResults.length >= minResults) {
      result.totalResults = result.localResults.length;
      result.queryTime = Date.now() - startTime;
      return result;
    }

    const regionalShards = this.getNearbyShards(location, 'regional', 5);
    for (const shard of regionalShards) {
      if (result.localResults.length + result.regionalResults.length >= minResults) {break;}

      const value = shard.retrieveData(key);
      if (value) {result.regionalResults.push(value);}
      result.shardsQueried++;
    }

    if (result.localResults.length + result.regionalResults.length >= minResults) {
      result.totalResults = result.localResults.length + result.regionalResults.length;
      result.queryTime = Date.now() - startTime;
      return result;
    }

    const globalShard = this.shards.get('global');
    if (globalShard) {
      const value = globalShard.retrieveData(key);
      if (value) {result.globalResults.push(value);}
      result.shardsQueried++;
    }

    result.totalResults =
      result.localResults.length + result.regionalResults.length + result.globalResults.length;
    result.queryTime = Date.now() - startTime;

    return result;
  }

  getNearbyShards(
    location: GeoLocation,
    level: 'local' | 'regional' | 'global',
    maxShards: number = 5
  ): GeoShard[] {
    const shardsWithDistance = Array.from(this.shards.values())
      .filter((shard) => {
        const info = shard.getInfo();
        return info.level === level && info.location !== undefined;
      })
      .map((shard) => ({
        shard,
        distance: calculateDistance(location, shard.getInfo().location!),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxShards)
      .map((s) => s.shard);

    return shardsWithDistance;
  }

  addPeerToShard(entry: RoutingEntry): { success: boolean; shardID?: string; error?: string } {
    if (!entry.location) {return { success: false, error: 'Peer location required' };}

    const shardID = generateShardID('local', entry.location);
    let shard = this.shards.get(shardID);

    if (!shard) {
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

    if (shard.addPeer(entry)) {
      this.shardIndex.set(entry.peerID, shardID);
      if (shard.needsSplit()) {this.handleShardSplit(shard);}
      return { success: true, shardID };
    }

    return { success: false, error: 'Shard is full' };
  }

  removePeerFromShard(peerID: string): boolean {
    const shardID = this.shardIndex.get(peerID);
    if (!shardID) {return false;}

    const shard = this.shards.get(shardID);
    if (!shard) {return false;}

    const success = shard.removePeer(peerID);
    if (success) {this.shardIndex.delete(peerID);}
    return success;
  }

  getPeerShard(peerID: string): GeoShard | undefined {
    const shardID = this.shardIndex.get(peerID);
    return shardID ? this.shards.get(shardID) : undefined;
  }

  private handleShardSplit(shard: GeoShard): void {
    const info = shard.getInfo();
    if (info.level === 'global') {return;}

    const { shard1, shard2 } = shard.split();

    this.registerShard(shard1);
    this.registerShard(shard2);

    if (info.parentShard) {
      this.shards.get(info.parentShard);
    }

    this.unregisterShard(info.shardID);

    shard1.getAllPeers().forEach((p) => {
      this.shardIndex.set(p.peerID, shard1.getInfo().shardID);
    });
    shard2.getAllPeers().forEach((p) => {
      this.shardIndex.set(p.peerID, shard2.getInfo().shardID);
    });
  }

  private calculateShardBounds(location: GeoLocation, gridSize: number = 10): any {
    return {
      north: Math.min(90, location.latitude + gridSize / 2),
      south: Math.max(-90, location.latitude - gridSize / 2),
      east: Math.min(180, location.longitude + gridSize / 2),
      west: Math.max(-180, location.longitude - gridSize / 2),
    };
  }

  makeLoadBalanceDecision(): LoadBalanceDecision[] {
    const decisions = Array.from(this.shards.values())
      .map((shard) => shard.getStats())
      .flatMap((stats) => {
        const decisions: LoadBalanceDecision[] = [];

        if (stats.loadFactor > 0.9) {
          decisions.push({
            action: 'split',
            sourceShard: stats.shardID,
            reason: `High load factor: ${stats.loadFactor.toFixed(2)}`,
            priority: Math.floor(stats.loadFactor * 10),
          });
        }

        if (stats.healthScore < 0.5) {
          decisions.push({
            action: 'migrate',
            sourceShard: stats.shardID,
            reason: `Low health score: ${stats.healthScore.toFixed(2)}`,
            priority: Math.floor((1 - stats.healthScore) * 10),
          });
        }

        return decisions;
      })
      .sort((a, b) => b.priority - a.priority);

    return decisions;
  }

  getAllShardInfo(): ShardInfo[] {
    return Array.from(this.shards.values()).map((s) => s.getInfo());
  }

  getNetworkStats(): {
    totalShards: number;
    totalPeers: number;
    avgHealth: number;
    avgLatency: number;
    shardDistribution: Record<string, number>;
  } {
    const shards = this.getAllShardInfo();
    const totalPeers = shards.reduce((sum, s) => sum + s.peerCount, 0);
    const avgHealth = shards.reduce((sum, s) => sum + s.health, 0) / shards.length || 0;
    const avgLatency = shards.reduce((sum, s) => sum + s.latency, 0) / shards.length || 0;

    const shardDistribution: Record<string, number> = Object.fromEntries(
      shards.map((s) => [s.shardID, s.peerCount])
    );

    return {
      totalShards: shards.length,
      totalPeers,
      avgHealth,
      avgLatency,
      shardDistribution,
    };
  }

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

  clear(): void {
    this.shards.clear();
    this.shardIndex.clear();
    this.localShardID = undefined;
  }
}
