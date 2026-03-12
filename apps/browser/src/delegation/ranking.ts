import { Config } from '@isc/core';

export interface SupernodeRanking {
  peerID: string;
  overallScore: number;
  components: RankingComponents;
  geographicAffinity: number;
  loadFactor: number;
  rank: number;
}

export interface RankingComponents {
  uptimeScore: number;
  successRateScore: number;
  latencyScore: number;
  consistencyScore: number;
  failureRateScore: number;
  loadScore: number;
  capacityScore: number;
  geographicScore: number;
  networkQualityScore: number;
}

export interface SupernodeMetrics {
  peerID: string;
  firstSeen: number;
  lastSeen: number;
  uptimePercent: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  latencies: number[];
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  currentLoad: number;
  maxCapacity: number;
  loadPercent: number;
  region?: string;
  country?: string;
  latencyFromUs: number;
  packetLoss: number;
  jitter: number;
}

export interface RankingWeights {
  uptimeWeight: number;
  successRateWeight: number;
  latencyWeight: number;
  consistencyWeight: number;
  failureRateWeight: number;
  loadWeight: number;
  capacityWeight: number;
  geographicWeight: number;
  networkQualityWeight: number;
}

export interface RankingConfig {
  weights: RankingWeights;
  minUptimePercent: number;
  minSuccessRate: number;
  maxLatencyMs: number;
  maxLoadPercent: number;
  decayFactor: number;
  sampleSize: number;
}

const DEFAULT_CONFIG: RankingConfig = {
  weights: {
    uptimeWeight: Config.delegation.weights.uptime,
    successRateWeight: Config.delegation.weights.successRate,
    latencyWeight: Config.delegation.weights.latency,
    consistencyWeight: Config.delegation.weights.consistency,
    failureRateWeight: Config.delegation.weights.failureRate,
    loadWeight: Config.delegation.weights.load,
    capacityWeight: Config.delegation.weights.capacity,
    geographicWeight: Config.delegation.weights.geographic,
    networkQualityWeight: Config.delegation.weights.networkQuality,
  },
  minUptimePercent: Config.delegation.minUptimePercent,
  minSuccessRate: Config.delegation.minSuccessRate,
  maxLatencyMs: Config.delegation.maxLatencyMs,
  maxLoadPercent: Config.delegation.maxLoadPercent,
  decayFactor: Config.delegation.decayFactor,
  sampleSize: Config.delegation.sampleSize,
};

const SCORE_THRESHOLDS = {
  uptime: [
    { min: 99, score: 1.0 },
    { min: 95, score: 0.9 },
    { min: 90, score: 0.7 },
    { min: 0, score: 0.5 },
  ],
  successRate: [
    { min: 0.99, score: 1.0 },
    { min: 0.95, score: 0.9 },
    { min: 0.90, score: 0.7 },
    { min: 0, score: 0.5 },
  ],
  latency: [
    { max: 0.1, score: 1.0 },
    { max: 0.25, score: 0.8 },
    { max: 0.5, score: 0.6 },
    { max: 0.75, score: 0.4 },
    { max: Infinity, score: 0.2 },
  ],
  consistency: [
    { max: 0.1, score: 1.0 },
    { max: 0.2, score: 0.8 },
    { max: 0.3, score: 0.6 },
    { max: 0.5, score: 0.4 },
    { max: Infinity, score: 0.2 },
  ],
  load: [
    { max: 0.3, score: 1.0 },
    { max: 0.5, score: 0.8 },
    { max: 0.7, score: 0.6 },
    { max: Infinity, score: 0.4 },
  ],
  capacity: [
    { min: 1000, score: 1.0 },
    { min: 500, score: 0.8 },
    { min: 100, score: 0.6 },
    { min: 0, score: 0.4 },
  ],
  consecutiveFailures: [
    { max: 0, score: 1.0 },
    { max: 1, score: 0.7 },
    { max: 3, score: 0.5 },
    { max: 5, score: 0.3 },
    { max: Infinity, score: 0.1 },
  ],
};

export class DelegationRanker {
  private metrics: Map<string, SupernodeMetrics> = new Map();
  private config: RankingConfig;
  private clientRegion?: string;
  private clientCountry?: string;

  constructor(config: RankingConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  setClientLocation(region?: string, country?: string): void {
    this.clientRegion = region;
    this.clientCountry = country;
  }

  updateMetrics(peerID: string, update: Partial<SupernodeMetrics>): SupernodeMetrics {
    const existing = this.metrics.get(peerID);

    const metrics: SupernodeMetrics = {
      peerID,
      firstSeen: existing?.firstSeen ?? Date.now(),
      lastSeen: Date.now(),
      uptimePercent: update.uptimePercent ?? existing?.uptimePercent ?? 100,
      totalRequests: update.totalRequests ?? existing?.totalRequests ?? 0,
      successfulRequests: update.successfulRequests ?? existing?.successfulRequests ?? 0,
      failedRequests: update.failedRequests ?? existing?.failedRequests ?? 0,
      consecutiveFailures: update.consecutiveFailures ?? existing?.consecutiveFailures ?? 0,
      latencies: update.latencies ?? existing?.latencies ?? [],
      avgLatency: update.avgLatency ?? existing?.avgLatency ?? 0,
      p50Latency: update.p50Latency ?? existing?.p50Latency ?? 0,
      p95Latency: update.p95Latency ?? existing?.p95Latency ?? 0,
      p99Latency: update.p99Latency ?? existing?.p99Latency ?? 0,
      currentLoad: update.currentLoad ?? existing?.currentLoad ?? 0,
      maxCapacity: update.maxCapacity ?? existing?.maxCapacity ?? 100,
      loadPercent: update.loadPercent ?? existing?.loadPercent ?? 0,
      region: update.region ?? existing?.region,
      country: update.country ?? existing?.country,
      latencyFromUs: update.latencyFromUs ?? existing?.latencyFromUs ?? 0,
      packetLoss: update.packetLoss ?? existing?.packetLoss ?? 0,
      jitter: update.jitter ?? existing?.jitter ?? 0,
    };

    metrics.latencies = metrics.latencies.slice(-this.config.sampleSize);

    this.metrics.set(peerID, metrics);
    return metrics;
  }

  recordRequest(peerID: string, latencyMs: number, success: boolean): SupernodeMetrics {
    const existing = this.metrics.get(peerID) ?? this.createDefaultMetrics(peerID);

    existing.totalRequests++;
    existing.lastSeen = Date.now();

    if (success) {
      existing.successfulRequests++;
      existing.consecutiveFailures = 0;
    } else {
      existing.failedRequests++;
      existing.consecutiveFailures++;
    }

    const decay = this.config.decayFactor;
    existing.avgLatency = existing.avgLatency * (1 - decay) + latencyMs * decay;
    existing.latencies = [...existing.latencies, latencyMs].slice(-this.config.sampleSize);

    this.recalculatePercentiles(existing);
    if (!success) {
      existing.currentLoad = Math.max(0, existing.currentLoad - 1);
    }

    this.metrics.set(peerID, existing);
    return existing;
  }

  updateLoad(peerID: string, delta: number): void {
    const metrics = this.metrics.get(peerID);
    if (!metrics) return;

    metrics.currentLoad = Math.max(0, Math.min(metrics.maxCapacity, metrics.currentLoad + delta));
    metrics.loadPercent = (metrics.currentLoad / metrics.maxCapacity) * 100;
  }

  private recalculatePercentiles(metrics: SupernodeMetrics): void {
    if (metrics.latencies.length === 0) {
      metrics.p50Latency = metrics.p95Latency = metrics.p99Latency = 0;
      return;
    }

    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const len = sorted.length;

    metrics.p50Latency = sorted[Math.floor(len * 0.50)];
    metrics.p95Latency = sorted[Math.floor(len * 0.95)];
    metrics.p99Latency = sorted[Math.floor(len * 0.99)];
  }

  private createDefaultMetrics(peerID: string): SupernodeMetrics {
    return {
      peerID,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      uptimePercent: 100,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      latencies: [],
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      currentLoad: 0,
      maxCapacity: 100,
      loadPercent: 0,
      latencyFromUs: 0,
      packetLoss: 0,
      jitter: 0,
    };
  }

  private scoreFromThresholds(value: number, thresholds: Array<{ min?: number; max?: number; score: number }>): number {
    for (const { min, max, score } of thresholds) {
      if (min !== undefined && value >= min) return score;
      if (max !== undefined && value <= max) return score;
    }
    return thresholds.at(-1)?.score ?? 0.5;
  }

  private calculateUptimeScore(metrics: SupernodeMetrics): number {
    return this.scoreFromThresholds(metrics.uptimePercent, SCORE_THRESHOLDS.uptime);
  }

  private calculateSuccessRateScore(metrics: SupernodeMetrics): number {
    if (metrics.totalRequests === 0) return 0.5;

    const successRate = metrics.successfulRequests / metrics.totalRequests;
    return this.scoreFromThresholds(successRate, SCORE_THRESHOLDS.successRate);
  }

  private calculateLatencyScore(metrics: SupernodeMetrics): number {
    if (metrics.p95Latency === 0) return 0.5;

    const ratio = metrics.p95Latency / this.config.maxLatencyMs;
    return this.scoreFromThresholds(ratio, SCORE_THRESHOLDS.latency);
  }

  private calculateConsistencyScore(metrics: SupernodeMetrics): number {
    if (metrics.latencies.length < 10) return 0.5;

    const mean = metrics.avgLatency;
    const variance = metrics.latencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / metrics.latencies.length;
    const cv = Math.sqrt(variance) / mean;

    return this.scoreFromThresholds(cv, SCORE_THRESHOLDS.consistency);
  }

  private calculateFailureRateScore(metrics: SupernodeMetrics): number {
    return this.scoreFromThresholds(metrics.consecutiveFailures, SCORE_THRESHOLDS.consecutiveFailures);
  }

  private calculateLoadScore(metrics: SupernodeMetrics): number {
    return this.scoreFromThresholds(metrics.loadPercent / 100, SCORE_THRESHOLDS.load);
  }

  private calculateCapacityScore(metrics: SupernodeMetrics): number {
    return this.scoreFromThresholds(metrics.maxCapacity, SCORE_THRESHOLDS.capacity);
  }

  private calculateGeographicScore(metrics: SupernodeMetrics): number {
    if (!this.clientRegion || !metrics.region) return 0.5;
    if (this.clientCountry && metrics.country === this.clientCountry) return 1.0;
    if (metrics.region === this.clientRegion) return 0.8;
    if (metrics.latencyFromUs < 100) return 0.6;
    return 0.3;
  }

  private calculateNetworkQualityScore(metrics: SupernodeMetrics): number {
    const packetLossScore = 1 - metrics.packetLoss;
    const jitterScore = metrics.jitter < 10 ? 1.0 : metrics.jitter < 50 ? 0.7 : 0.4;
    return (packetLossScore + jitterScore) / 2;
  }

  rankSupernode(peerID: string): SupernodeRanking | null {
    const metrics = this.metrics.get(peerID);
    if (!metrics) return null;

    const successRate = metrics.totalRequests > 0 ? metrics.successfulRequests / metrics.totalRequests : 0;
    if (
      metrics.uptimePercent < this.config.minUptimePercent ||
      successRate < this.config.minSuccessRate ||
      metrics.loadPercent > this.config.maxLoadPercent
    ) {
      return null;
    }

    const { weights } = this.config;
    const components: RankingComponents = {
      uptimeScore: this.calculateUptimeScore(metrics),
      successRateScore: this.calculateSuccessRateScore(metrics),
      latencyScore: this.calculateLatencyScore(metrics),
      consistencyScore: this.calculateConsistencyScore(metrics),
      failureRateScore: this.calculateFailureRateScore(metrics),
      loadScore: this.calculateLoadScore(metrics),
      capacityScore: this.calculateCapacityScore(metrics),
      geographicScore: this.calculateGeographicScore(metrics),
      networkQualityScore: this.calculateNetworkQualityScore(metrics),
    };

    const overallScore =
      components.uptimeScore * weights.uptimeWeight +
      components.successRateScore * weights.successRateWeight +
      components.latencyScore * weights.latencyWeight +
      components.consistencyScore * weights.consistencyWeight +
      components.failureRateScore * weights.failureRateWeight +
      components.loadScore * weights.loadWeight +
      components.capacityScore * weights.capacityWeight +
      components.geographicScore * weights.geographicWeight +
      components.networkQualityScore * weights.networkQualityWeight;

    return {
      peerID,
      overallScore,
      components,
      geographicAffinity: components.geographicScore,
      loadFactor: 1 - components.loadScore,
      rank: 0,
    };
  }

  rankAll(): SupernodeRanking[] {
    const rankings = Array.from(this.metrics.keys())
      .map((peerID) => this.rankSupernode(peerID))
      .filter((r): r is SupernodeRanking => r !== null)
      .sort((a, b) => b.overallScore - a.overallScore);

    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rankings;
  }

  getTopN(n: number): SupernodeRanking[] {
    return this.rankAll().slice(0, n);
  }

  getBest(): SupernodeRanking | null {
    const rankings = this.rankAll();
    return rankings[0] ?? null;
  }

  getMetrics(peerID: string): SupernodeMetrics | undefined {
    return this.metrics.get(peerID);
  }

  remove(peerID: string): void {
    this.metrics.delete(peerID);
  }

  clear(): void {
    this.metrics.clear();
  }

  getStats(): {
    totalSupernodes: number;
    eligibleSupernodes: number;
    avgScore: number;
    avgLatency: number;
    avgSuccessRate: number;
  } {
    const rankings = this.rankAll();

    if (rankings.length === 0) {
      return {
        totalSupernodes: this.metrics.size,
        eligibleSupernodes: 0,
        avgScore: 0,
        avgLatency: 0,
        avgSuccessRate: 0,
      };
    }

    const avgScore = rankings.reduce((sum, r) => sum + r.overallScore, 0) / rankings.length;
    const avgLatency =
      rankings.reduce((sum, r) => sum + (this.metrics.get(r.peerID)?.p95Latency ?? 0), 0) / rankings.length;
    const avgSuccessRate =
      rankings.reduce((sum, r) => {
        const metrics = this.metrics.get(r.peerID);
        return metrics && metrics.totalRequests > 0
          ? sum + metrics.successfulRequests / metrics.totalRequests
          : sum;
      }, 0) / rankings.length;

    return {
      totalSupernodes: this.metrics.size,
      eligibleSupernodes: rankings.length,
      avgScore,
      avgLatency,
      avgSuccessRate,
    };
  }
}

export function createDelegationRanker(config?: Partial<RankingConfig>): DelegationRanker {
  return new DelegationRanker({ ...DEFAULT_CONFIG, ...config });
}
