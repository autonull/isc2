export interface RelayCandidate {
  peerID: string;
  multiaddr: string;
  type: 'circuit' | 'turn' | 'stun';
  latency: number;
  successRate: number;
  lastUsed?: number;
  usageCount: number;
  qualityScore: number;
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
  score: number;
  latency: number;
  packetLoss: number;
  jitter: number;
  bandwidth: number;
  stability: number;
  lastUpdated: number;
}

export interface NATTraversalConfig {
  maxRelayPoolSize: number;
  minRelays: number;
  relayRefreshInterval: number;
  connectionTimeout: number;
  maxRetries: number;
  retryBackoff: number;
  minQualityScore: number;
  degradedQualityScore: number;
  turnServers: TURNConfig[];
  stunServers: STUNConfig[];
  latencyWeight: number;
  successRateWeight: number;
  stabilityWeight: number;
}

const DEFAULT_CONFIG: NATTraversalConfig = {
  maxRelayPoolSize: 20,
  minRelays: 3,
  relayRefreshInterval: 60000,
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

  start(): void {
    this.refreshRelayPool();
    this.refreshTimer = setInterval(() => this.refreshRelayPool(), this.config.relayRefreshInterval);
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  addRelay(relay: RelayCandidate): void {
    if (this.relayPool.size >= this.config.maxRelayPoolSize) {
      const lowest = this.getLowestQualityRelay();
      if (lowest && lowest.qualityScore < relay.qualityScore) {
        this.relayPool.delete(lowest.peerID);
      } else {
        return;
      }
    }

    this.relayPool.set(relay.peerID, relay);
    this.updatePreferredRelay();
  }

  removeRelay(peerID: string): void {
    this.relayPool.delete(peerID);
    if (this.preferredRelay?.peerID === peerID) {
      this.updatePreferredRelay();
    }
  }

  updateRelayStats(peerID: string, success: boolean, latency?: number): void {
    const relay = this.relayPool.get(peerID);
    if (!relay) return;

    relay.usageCount++;
    relay.lastUsed = Date.now();

    if (latency !== undefined) {
      relay.latency = relay.latency * 0.8 + latency * 0.2;
    }

    const targetSuccess = success ? 1 : 0;
    relay.successRate = relay.successRate * 0.9 + targetSuccess * 0.1;
    relay.qualityScore = this.calculateRelayQualityScore(relay);

    this.relayPool.set(peerID, relay);
    this.updatePreferredRelay();
  }

  private calculateRelayQualityScore(relay: RelayCandidate): number {
    const { latencyWeight, successRateWeight, stabilityWeight } = this.config;
    const latencyScore = Math.max(0, 1 - relay.latency / 1000);
    const successScore = relay.successRate;
    const stabilityScore = relay.usageCount > 10 ? 0.9 : relay.usageCount / 10;

    return latencyScore * latencyWeight + successScore * successRateWeight + stabilityScore * stabilityWeight;
  }

  getBestRelay(): RelayCandidate | undefined {
    this.updatePreferredRelay();
    return this.preferredRelay;
  }

  getTopRelays(n: number): RelayCandidate[] {
    return Array.from(this.relayPool.values())
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, n);
  }

  private getLowestQualityRelay(): RelayCandidate | undefined {
    let lowest: RelayCandidate | undefined;
    for (const relay of this.relayPool.values()) {
      if (!lowest || relay.qualityScore < lowest.qualityScore) {
        lowest = relay;
      }
    }
    return lowest;
  }

  private updatePreferredRelay(): void {
    const candidates = this.getTopRelays(3);
    if (candidates.length === 0) {
      this.preferredRelay = undefined;
      return;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    for (const candidate of candidates) {
      if (!candidate.lastUsed || candidate.lastUsed < oneMinuteAgo) {
        this.preferredRelay = candidate;
        return;
      }
    }

    this.preferredRelay = candidates[0];
  }

  private refreshRelayPool(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [peerID, relay] of this.relayPool.entries()) {
      if (relay.usageCount === 0 && relay.lastUsed && relay.lastUsed < oneHourAgo) {
        this.relayPool.delete(peerID);
      }
    }

    if (this.relayPool.size < this.config.minRelays) {
      console.log(`Relay pool below minimum: ${this.relayPool.size}/${this.config.minRelays}`);
    }
  }

  recordConnectionQuality(quality: ConnectionQuality): void {
    const existing = this.connectionQualities.get(quality.peerID);

    if (existing) {
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
        stability: quality.score,
      });
    }
  }

  getConnectionQuality(peerID: string): ConnectionQuality | undefined {
    return this.connectionQualities.get(peerID);
  }

  isConnectionAcceptable(peerID: string): boolean {
    const quality = this.connectionQualities.get(peerID);
    return !quality || quality.score >= this.config.minQualityScore;
  }

  isConnectionDegraded(peerID: string): boolean {
    const quality = this.connectionQualities.get(peerID);
    return quality ? quality.score < this.config.degradedQualityScore : false;
  }

  getICEServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [];
    for (const stun of this.config.stunServers) {
      servers.push({ urls: stun.urls });
    }
    for (const turn of this.config.turnServers) {
      servers.push({ urls: turn.urls, username: turn.username, credential: turn.credential });
    }
    return servers;
  }

  addTurnServer(turn: TURNConfig): void {
    this.config.turnServers.push(turn);
  }

  markConnectionActive(peerID: string): void {
    this.activeConnections.add(peerID);
  }

  markConnectionInactive(peerID: string): void {
    this.activeConnections.delete(peerID);
  }

  getActiveConnectionCount(): number {
    return this.activeConnections.size;
  }

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
      acceptableConnections: qualities.filter((q) => q.score >= this.config.minQualityScore).length,
      degradedConnections: qualities.filter((q) => q.score < this.config.degradedQualityScore).length,
    };
  }

  clear(): void {
    this.relayPool.clear();
    this.connectionQualities.clear();
    this.activeConnections.clear();
    this.preferredRelay = undefined;
  }
}

export function createNATTraversalManager(config?: Partial<NATTraversalConfig>): NATTraversalManager {
  return new NATTraversalManager(config);
}

export function calculateConnectionQuality(
  latency: number,
  packetLoss: number,
  jitter: number,
  bandwidth: number
): number {
  const latencyScore = Math.max(0, 1 - latency / 500);
  const packetLossScore = Math.max(0, 1 - packetLoss * 10);
  const jitterScore = Math.max(0, 1 - jitter / 100);
  const bandwidthScore = Math.min(1, bandwidth / 1000);

  return latencyScore * 0.35 + packetLossScore * 0.35 + jitterScore * 0.15 + bandwidthScore * 0.15;
}
