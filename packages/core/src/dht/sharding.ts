/**
 * Geographic Sharding
 * 
 * Divides peers into geographic shards for efficient local discovery.
 * Supports dynamic shard splitting based on load.
 */

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

/**
 * Earth radius in kilometers
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Geographic Shard class
 */
export class GeoShard {
  private config: ShardConfig;
  private peers: Map<string, RoutingEntry> = new Map();
  private data: Map<string, any> = new Map();
  private splitHistory: SplitEvent[] = [];

  constructor(config: ShardConfig) {
    this.config = { ...config };
  }

  /**
   * Add a peer to the shard
   */
  addPeer(entry: RoutingEntry): boolean {
    if (this.peers.size >= this.config.maxPeers) {
      return false;  // Shard is full
    }

    this.peers.set(entry.peerID, entry);
    return true;
  }

  /**
   * Remove a peer from the shard
   */
  removePeer(peerID: string): boolean {
    return this.peers.delete(peerID);
  }

  /**
   * Get peer entry
   */
  getPeer(peerID: string): RoutingEntry | undefined {
    return this.peers.get(peerID);
  }

  /**
   * Get all peers in shard
   */
  getAllPeers(): RoutingEntry[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Store data in shard
   */
  storeData(key: string, value: any, ttl?: number): void {
    this.data.set(key, {
      value,
      storedAt: Date.now(),
      ttl,
      expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
    });
  }

  /**
   * Retrieve data from shard
   */
  retrieveData(key: string): any | undefined {
    const entry = this.data.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Check if shard needs splitting
   */
  needsSplit(): boolean {
    return this.peers.size >= this.config.maxPeers;
  }

  /**
   * Calculate shard health score
   */
  getHealthScore(): number {
    const now = Date.now();
    const activePeers = Array.from(this.peers.values()).filter(
      p => now - p.lastSeen < 60000  // Active in last minute
    ).length;

    const availability = activePeers / Math.max(1, this.peers.size);
    const loadFactor = this.peers.size / this.config.maxPeers;

    // Health decreases as load approaches max
    const loadHealth = 1 - Math.pow(loadFactor, 2);

    return (availability * 0.6 + loadHealth * 0.4);
  }

  /**
   * Get shard statistics
   */
  getStats(): ShardStats {
    const now = Date.now();
    const activePeers = Array.from(this.peers.values()).filter(
      p => now - p.lastSeen < 60000
    ).length;

    const latencies = Array.from(this.peers.values()).map(p => p.latency);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

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

  /**
   * Split shard into two
   */
  split(_location?: GeoLocation): { shard1: GeoShard; shard2: GeoShard } {
    const peers = this.getAllPeers();
    
    // Create two new shards
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

    // Distribute peers (simple alternating for now, could be geo-based)
    peers.forEach((peer, index) => {
      if (index % 2 === 0) {
        shard1.addPeer(peer);
      } else {
        shard2.addPeer(peer);
      }
    });

    // Record split event
    const splitEvent: SplitEvent = {
      timestamp: Date.now(),
      originalShard: this.config.shardID,
      newShards: [shard1Config.shardID, shard2Config.shardID],
      reason: 'load',
      peerDistribution: {
        [shard1Config.shardID]: shard1.getPeerCount(),
        [shard2Config.shardID]: shard2.getPeerCount(),
      },
    };
    this.splitHistory.push(splitEvent);

    return { shard1, shard2 };
  }

  /**
   * Get shard info
   */
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

  /**
   * Get average latency of peers
   */
  private getAverageLatency(): number {
    const latencies = Array.from(this.peers.values()).map(p => p.latency);
    if (latencies.length === 0) return 0;
    return latencies.reduce((a, b) => a + b, 0) / latencies.length;
  }

  /**
   * Get center location of shard
   */
  private getCenterLocation(): GeoLocation | undefined {
    const peers = this.getAllPeers();
    if (peers.length === 0 || !peers[0].location) return undefined;

    const avgLat = peers.reduce((sum, p) => sum + (p.location?.latitude || 0), 0) / peers.length;
    const avgLon = peers.reduce((sum, p) => sum + (p.location?.longitude || 0), 0) / peers.length;

    return { latitude: avgLat, longitude: avgLon };
  }

  /**
   * Clean up expired data
   */
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

  /**
   * Export shard state
   */
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

  /**
   * Import shard state
   */
  import(state: {
    config: ShardConfig;
    peers: RoutingEntry[];
    data: Map<string, any>;
    splitHistory: SplitEvent[];
  }): void {
    this.config = state.config;
    this.peers = new Map(state.peers.map(p => [p.peerID, p]));
    this.data = state.data;
    this.splitHistory = [...state.splitHistory];
  }
}

/**
 * Calculate distance between two locations (Haversine formula)
 */
export function calculateDistance(loc1: GeoLocation, loc2: GeoLocation): number {
  const lat1Rad = (loc1.latitude * Math.PI) / 180;
  const lat2Rad = (loc2.latitude * Math.PI) / 180;
  const deltaLat = ((loc2.latitude - loc1.latitude) * Math.PI) / 180;
  const deltaLon = ((loc2.longitude - loc1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Check if location is within bounds
 */
export function isLocationInBounds(location: GeoLocation, bounds: GeoBounds): boolean {
  return (
    location.latitude >= bounds.south &&
    location.latitude <= bounds.north &&
    location.longitude >= bounds.west &&
    location.longitude <= bounds.east
  );
}

/**
 * Generate shard ID from location
 */
export function generateShardID(level: ShardLevel, location: GeoLocation): string {
  const latGrid = Math.floor(location.latitude / 10);  // 10-degree grid
  const lonGrid = Math.floor(location.longitude / 10);
  const latSign = location.latitude >= 0 ? 'N' : 'S';
  const lonSign = location.longitude >= 0 ? 'E' : 'W';

  return `${level}_${Math.abs(latGrid)}${latSign}_${Math.abs(lonGrid)}${lonSign}`;
}
