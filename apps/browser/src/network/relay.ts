/**
 * NAT Traversal Enhancement
 *
 * Circuit relay pool expansion, TURN server fallback,
 * and connection quality scoring for improved P2P connectivity.
 *
 * References: NEXT_STEPS.md#73-nat-traversal-enhancement
 */

export interface RelayCandidate {
  peerID: string;
  multiaddr: string;
  type: 'circuit' | 'turn' | 'stun';
  latency: number; // ms
  successRate: number; // 0-1
  lastUsed?: number;
  usageCount: number;
  qualityScore: number; // 0-1
}

export interface TURNConfig {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface STUNConfig {
  urls: string[];
}

export interface ConnectionQuality {
  peerID: string;
  score: number; // 0-1
  latency: number; // ms
  packetLoss: number; // 0-1
  jitter: number; // ms
  bandwidth: number; // kbps
  stability: number; // 0-1 (consistency over time)
  lastUpdated: number;
}

export interface NATTraversalConfig {
  // Relay pool settings
  maxRelayPoolSize: number;
  minRelays: number;
  relayRefreshInterval: number; // ms
  
  // Connection settings
  connectionTimeout: number; // ms
  maxRetries: number;
  retryBackoff: number; // ms
  
  // Quality thresholds
  minQualityScore: number;
  degradedQualityScore: number;
  
  // TURN/STUN settings
  turnServers: TURNConfig[];
  stunServers: STUNConfig[];
  
  // Scoring weights
  latencyWeight: number;
  successRateWeight: number;
  stabilityWeight: number;
}

const DEFAULT_CONFIG: NATTraversalConfig = {
  maxRelayPoolSize: 20,
  minRelays: 3,
  relayRefreshInterval: 60000, // 1 minute
  
  connectionTimeout: 5000,
  maxRetries: 3,
  retryBackoff: 1000,
  
  minQualityScore: 0.3,
  degradedQualityScore: 0.6,
  
  turnServers: [],
  stunServers: [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['stun:stun1.l.google.com:19302'] },
  ],
  
  latencyWeight: 0.4,
  successRateWeight: 0.4,
  stabilityWeight: 0.2,
};

export class NATTraversalManager {
  private config: NATTraversalConfig;
  private relayPool: Map<string, RelayCandidate> = new Map();
  private connectionQualities: Map<string, ConnectionQuality> = new Map();
  private activeConnections: Set<string> = new Set();
  private preferredRelay?: RelayCandidate;
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<NATTraversalConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the relay pool refresh cycle
   */
  start(): void {
    this.refreshRelayPool();
    this.refreshTimer = setInterval(
      () => this.refreshRelayPool(),
      this.config.relayRefreshInterval
    );
  }

  /**
   * Stop the relay pool refresh cycle
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Add a relay candidate to the pool
   */
  addRelay(relay: RelayCandidate): void {
    if (this.relayPool.size >= this.config.maxRelayPoolSize) {
      // Remove lowest quality relay if pool is full
      const lowest = this.getLowestQualityRelay();
      if (lowest && lowest.qualityScore < relay.qualityScore) {
        this.relayPool.delete(lowest.peerID);
      } else {
        return; // Don't add if pool is full and new relay is worse
      }
    }

    this.relayPool.set(relay.peerID, relay);
    this.updatePreferredRelay();
  }

  /**
   * Remove a relay from the pool
   */
  removeRelay(peerID: string): void {
    this.relayPool.delete(peerID);
    if (this.preferredRelay?.peerID === peerID) {
      this.updatePreferredRelay();
    }
  }

  /**
   * Update relay statistics after use
   */
  updateRelayStats(
    peerID: string,
    success: boolean,
    latency?: number
  ): void {
    const relay = this.relayPool.get(peerID);
    if (!relay) return;

    relay.usageCount++;
    relay.lastUsed = Date.now();

    if (latency !== undefined) {
      // Exponential moving average for latency
      relay.latency = relay.latency * 0.8 + latency * 0.2;
    }

    // Update success rate with EMA
    const targetSuccess = success ? 1 : 0;
    relay.successRate = relay.successRate * 0.9 + targetSuccess * 0.1;

    // Recalculate quality score
    relay.qualityScore = this.calculateRelayQualityScore(relay);

    this.relayPool.set(peerID, relay);
    this.updatePreferredRelay();
  }

  /**
   * Calculate quality score for a relay
   */
  private calculateRelayQualityScore(relay: RelayCandidate): number {
    const { latencyWeight, successRateWeight, stabilityWeight } = this.config;

    // Latency score (lower is better)
    const latencyScore = Math.max(0, 1 - relay.latency / 1000);

    // Success rate score
    const successScore = relay.successRate;

    // Stability score (based on usage and consistency)
    const stabilityScore = relay.usageCount > 10 ? 0.9 : relay.usageCount / 10;

    return (
      latencyScore * latencyWeight +
      successScore * successRateWeight +
      stabilityScore * stabilityWeight
    );
  }

  /**
   * Get the best relay for connection
   */
  getBestRelay(): RelayCandidate | undefined {
    this.updatePreferredRelay();
    return this.preferredRelay;
  }

  /**
   * Get top N relays for redundancy
   */
  getTopRelays(n: number): RelayCandidate[] {
    const sorted = Array.from(this.relayPool.values())
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, n);

    return sorted;
  }

  /**
   * Get lowest quality relay (for removal)
   */
  private getLowestQualityRelay(): RelayCandidate | undefined {
    let lowest: RelayCandidate | undefined;
    for (const relay of this.relayPool.values()) {
      if (!lowest || relay.qualityScore < lowest.qualityScore) {
        lowest = relay;
      }
    }
    return lowest;
  }

  /**
   * Update preferred relay selection
   */
  private updatePreferredRelay(): void {
    const candidates = this.getTopRelays(3);
    if (candidates.length === 0) {
      this.preferredRelay = undefined;
      return;
    }

    // Prefer relays that haven't been used recently (load balancing)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    for (const candidate of candidates) {
      if (!candidate.lastUsed || candidate.lastUsed < oneMinuteAgo) {
        this.preferredRelay = candidate;
        return;
      }
    }

    // Fall back to highest quality
    this.preferredRelay = candidates[0];
  }

  /**
   * Refresh relay pool (discover new relays)
   */
  private refreshRelayPool(): void {
    // In real implementation, would discover relays via DHT
    // For now, just age out unused relays
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [peerID, relay] of this.relayPool.entries()) {
      if (relay.usageCount === 0 && relay.lastUsed && relay.lastUsed < oneHourAgo) {
        this.relayPool.delete(peerID);
      }
    }

    // Ensure minimum relay count
    if (this.relayPool.size < this.config.minRelays) {
      // Would trigger relay discovery here
      console.log(`Relay pool below minimum: ${this.relayPool.size}/${this.config.minRelays}`);
    }
  }

  /**
   * Record connection quality for a peer
   */
  recordConnectionQuality(quality: ConnectionQuality): void {
    const existing = this.connectionQualities.get(quality.peerID);

    if (existing) {
      // Update with exponential moving average
      existing.score = existing.score * 0.7 + quality.score * 0.3;
      existing.latency = existing.latency * 0.7 + quality.latency * 0.3;
      existing.packetLoss = existing.packetLoss * 0.7 + quality.packetLoss * 0.3;
      existing.jitter = existing.jitter * 0.7 + quality.jitter * 0.3;
      existing.bandwidth = existing.bandwidth * 0.7 + quality.bandwidth * 0.3;
      existing.stability = existing.stability * 0.8 + quality.stability * 0.2;
      existing.lastUpdated = Date.now();
    } else {
      this.connectionQualities.set(quality.peerID, {
        ...quality,
        stability: quality.score, // Initial stability equals score
      });
    }
  }

  /**
   * Get connection quality for a peer
   */
  getConnectionQuality(peerID: string): ConnectionQuality | undefined {
    return this.connectionQualities.get(peerID);
  }

  /**
   * Check if connection quality is acceptable
   */
  isConnectionAcceptable(peerID: string): boolean {
    const quality = this.connectionQualities.get(peerID);
    if (!quality) return true; // No data, assume acceptable

    return quality.score >= this.config.minQualityScore;
  }

  /**
   * Check if connection quality is degraded
   */
  isConnectionDegraded(peerID: string): boolean {
    const quality = this.connectionQualities.get(peerID);
    if (!quality) return false;

    return quality.score < this.config.degradedQualityScore;
  }

  /**
   * Get ICE servers configuration for WebRTC
   */
  getICEServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [];

    // Add STUN servers
    for (const stun of this.config.stunServers) {
      servers.push({ urls: stun.urls });
    }

    // Add TURN servers
    for (const turn of this.config.turnServers) {
      servers.push({
        urls: turn.urls,
        username: turn.username,
        credential: turn.credential,
      });
    }

    return servers;
  }

  /**
   * Add TURN server dynamically
   */
  addTurnServer(turn: TURNConfig): void {
    this.config.turnServers.push(turn);
  }

  /**
   * Mark connection as active
   */
  markConnectionActive(peerID: string): void {
    this.activeConnections.add(peerID);
  }

  /**
   * Mark connection as inactive
   */
  markConnectionInactive(peerID: string): void {
    this.activeConnections.delete(peerID);
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Get relay pool statistics
   */
  getRelayPoolStats(): {
    totalRelays: number;
    circuitRelays: number;
    turnRelays: number;
    stunRelays: number;
    avgQualityScore: number;
    avgLatency: number;
    avgSuccessRate: number;
  } {
    const relays = Array.from(this.relayPool.values());

    if (relays.length === 0) {
      return {
        totalRelays: 0,
        circuitRelays: 0,
        turnRelays: 0,
        stunRelays: 0,
        avgQualityScore: 0,
        avgLatency: 0,
        avgSuccessRate: 0,
      };
    }

    return {
      totalRelays: relays.length,
      circuitRelays: relays.filter((r) => r.type === 'circuit').length,
      turnRelays: relays.filter((r) => r.type === 'turn').length,
      stunRelays: relays.filter((r) => r.type === 'stun').length,
      avgQualityScore: relays.reduce((sum, r) => sum + r.qualityScore, 0) / relays.length,
      avgLatency: relays.reduce((sum, r) => sum + r.latency, 0) / relays.length,
      avgSuccessRate: relays.reduce((sum, r) => sum + r.successRate, 0) / relays.length,
    };
  }

  /**
   * Get connection quality statistics
   */
  getConnectionQualityStats(): {
    totalConnections: number;
    activeConnections: number;
    avgScore: number;
    avgLatency: number;
    avgPacketLoss: number;
    acceptableConnections: number;
    degradedConnections: number;
  } {
    const qualities = Array.from(this.connectionQualities.values());

    if (qualities.length === 0) {
      return {
        totalConnections: 0,
        activeConnections: this.activeConnections.size,
        avgScore: 0,
        avgLatency: 0,
        avgPacketLoss: 0,
        acceptableConnections: 0,
        degradedConnections: 0,
      };
    }

    return {
      totalConnections: qualities.length,
      activeConnections: this.activeConnections.size,
      avgScore: qualities.reduce((sum, q) => sum + q.score, 0) / qualities.length,
      avgLatency: qualities.reduce((sum, q) => sum + q.latency, 0) / qualities.length,
      avgPacketLoss: qualities.reduce((sum, q) => sum + q.packetLoss, 0) / qualities.length,
      acceptableConnections: qualities.filter(
        (q) => q.score >= this.config.minQualityScore
      ).length,
      degradedConnections: qualities.filter(
        (q) => q.score < this.config.degradedQualityScore
      ).length,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.relayPool.clear();
    this.connectionQualities.clear();
    this.activeConnections.clear();
    this.preferredRelay = undefined;
  }
}

/**
 * Create NAT traversal manager with default configuration
 */
export function createNATTraversalManager(
  config?: Partial<NATTraversalConfig>
): NATTraversalManager {
  return new NATTraversalManager(config);
}

/**
 * Calculate connection quality score from metrics
 */
export function calculateConnectionQuality(
  latency: number,
  packetLoss: number,
  jitter: number,
  bandwidth: number
): number {
  // Latency score (lower is better, target < 100ms)
  const latencyScore = Math.max(0, 1 - latency / 500);

  // Packet loss score (lower is better, target < 1%)
  const packetLossScore = Math.max(0, 1 - packetLoss * 10);

  // Jitter score (lower is better, target < 30ms)
  const jitterScore = Math.max(0, 1 - jitter / 100);

  // Bandwidth score (higher is better, target > 1000 kbps)
  const bandwidthScore = Math.min(1, bandwidth / 1000);

  // Weighted average
  return (
    latencyScore * 0.35 +
    packetLossScore * 0.35 +
    jitterScore * 0.15 +
    bandwidthScore * 0.15
  );
}
