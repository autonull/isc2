/* eslint-disable */
import type {
  ShardConfig,
  ShardInfo,
  GeoLocation,
  GeoBounds,
  RoutingEntry,
  ShardStats,
  SplitEvent,
  ShardLevel,
} from './types.js';

const EARTH_RADIUS_KM = 6371;

export class GeoShard {
  private config: ShardConfig;
  private peers: Map<string, RoutingEntry> = new Map();
  private data: Map<string, any> = new Map();
  private splitHistory: SplitEvent[] = [];

  constructor(config: ShardConfig) {
    this.config = { ...config };
  }

  addPeer(entry: RoutingEntry): boolean {
    if (this.peers.size >= this.config.maxPeers) {return false;}
    this.peers.set(entry.peerID, entry);
    return true;
  }

  removePeer(peerID: string): boolean {
    return this.peers.delete(peerID);
  }

  getPeer(peerID: string): RoutingEntry | undefined {
    return this.peers.get(peerID);
  }

  getAllPeers(): RoutingEntry[] {
    return Array.from(this.peers.values());
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  storeData(key: string, value: any, ttl?: number): void {
    this.data.set(key, {
      value,
      storedAt: Date.now(),
      ttl,
      expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
    });
  }

  retrieveData(key: string): any | undefined {
    const entry = this.data.get(key);
    if (!entry) {return undefined;}

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return undefined;
    }

    return entry.value;
  }

  needsSplit(): boolean {
    return this.peers.size >= this.config.maxPeers;
  }

  getHealthScore(): number {
    const now = Date.now();
    const activePeers = Array.from(this.peers.values()).filter(
      (p) => now - p.lastSeen < 60000
    ).length;

    const availability = activePeers / Math.max(1, this.peers.size);
    const loadFactor = this.peers.size / this.config.maxPeers;
    const loadHealth = 1 - loadFactor ** 2;

    return availability * 0.6 + loadHealth * 0.4;
  }

  getStats(): ShardStats {
    const now = Date.now();
    const activePeers = Array.from(this.peers.values()).filter(
      (p) => now - p.lastSeen < 60000
    ).length;

    const latencies = Array.from(this.peers.values()).map((p) => p.latency);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const loadFactor = this.peers.size / this.config.maxPeers;

    return {
      shardID: this.config.shardID,
      totalPeers: this.peers.size,
      activePeers,
      dataEntries: this.data.size,
      avgLatency,
      healthScore: this.getHealthScore(),
      loadFactor,
      splitHistory: [...this.splitHistory],
    };
  }

  split(_location?: GeoLocation): { shard1: GeoShard; shard2: GeoShard } {
    const peers = this.getAllPeers();

    const shard1Config: ShardConfig = {
      ...this.config,
      shardID: `${this.config.shardID}_a`,
      maxPeers: Math.ceil(this.config.maxPeers / 2),
    };

    const shard2Config: ShardConfig = {
      ...this.config,
      shardID: `${this.config.shardID}_b`,
      maxPeers: Math.floor(this.config.maxPeers / 2),
    };

    const shard1 = new GeoShard(shard1Config);
    const shard2 = new GeoShard(shard2Config);

    peers.forEach((peer, index) => {
      (index % 2 === 0 ? shard1 : shard2).addPeer(peer);
    });

    this.splitHistory.push({
      timestamp: Date.now(),
      originalShard: this.config.shardID,
      newShards: [shard1Config.shardID, shard2Config.shardID],
      reason: 'load',
      peerDistribution: {
        [shard1Config.shardID]: shard1.getPeerCount(),
        [shard2Config.shardID]: shard2.getPeerCount(),
      },
    });

    return { shard1, shard2 };
  }

  getInfo(): ShardInfo {
    return {
      shardID: this.config.shardID,
      level: this.config.level,
      peerCount: this.peers.size,
      health: this.getHealthScore(),
      latency: this.getAverageLatency(),
      location: this.getCenterLocation(),
      bounds: this.config.geoBounds,
      parentShard: this.config.parentShard,
      childShards: this.config.childShards,
    };
  }

  private getAverageLatency(): number {
    const latencies = this.getAllPeers().map((p) => p.latency);
    return latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  }

  private getCenterLocation(): GeoLocation | undefined {
    const peers = this.getAllPeers();
    if (peers.length === 0 || !peers[0].location) {return undefined;}

    const avgLat = peers.reduce((sum, p) => sum + (p.location?.latitude || 0), 0) / peers.length;
    const avgLon = peers.reduce((sum, p) => sum + (p.location?.longitude || 0), 0) / peers.length;

    return { latitude: avgLat, longitude: avgLon };
  }

  cleanupExpiredData(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.data.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.data.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  export(): {
    config: ShardConfig;
    peers: RoutingEntry[];
    data: Map<string, any>;
    splitHistory: SplitEvent[];
  } {
    return {
      config: this.config,
      peers: this.getAllPeers(),
      data: this.data,
      splitHistory: [...this.splitHistory],
    };
  }

  import(state: {
    config: ShardConfig;
    peers: RoutingEntry[];
    data: Map<string, any>;
    splitHistory: SplitEvent[];
  }): void {
    this.config = state.config;
    this.peers = new Map(state.peers.map((p) => [p.peerID, p]));
    this.data = state.data;
    this.splitHistory = [...state.splitHistory];
  }
}

export function calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
  const lat1Rad = (loc1.latitude * Math.PI) / 180;
  const lat2Rad = (loc2.latitude * Math.PI) / 180;
  const deltaLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const deltaLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) ** 2;

  return EARTH_RADIUS_KM * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function isLocationInBounds(location: GeoLocation, bounds: GeoBounds): boolean {
  return (
    location.latitude >= bounds.south &&
    location.latitude <= bounds.north &&
    location.longitude >= bounds.west &&
    location.longitude <= bounds.east
  );
}

export function generateShardID(level: ShardLevel, location: GeoLocation): string {
  const latGrid = Math.floor(location.latitude / 10);
  const lonGrid = Math.floor(location.longitude / 10);
  const latSign = location.latitude >= 0 ? 'N' : 'S';
  const lonSign = location.longitude >= 0 ? 'E' : 'W';

  return `${level}_${Math.abs(latGrid)}${latSign}_${Math.abs(lonGrid)}${lonSign}`;
}
