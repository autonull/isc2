/**
 * Delegation Ranking Improvements
 *
 * Multi-factor scoring with uptime, success rate, latency,
 * geographic affinity, and load balancing.
 *
 * References: NEXT_STEPS.md#72-delegation-ranking-improvements
 */

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
  // Performance metrics (40% weight)
  uptimeScore: number; // 0-1
  successRateScore: number; // 0-1
  latencyScore: number; // 0-1

  // Reliability metrics (30% weight)
  consistencyScore: number; // 0-1
  failureRateScore: number; // 0-1

  // Capacity metrics (20% weight)
  loadScore: number; // 0-1 (inverse - lower load = higher score)
  capacityScore: number; // 0-1

  // Network metrics (10% weight)
  geographicScore: number; // 0-1
  networkQualityScore: number; // 0-1
}

export interface SupernodeMetrics {
  peerID: string;

  // Uptime tracking
  firstSeen: number;
  lastSeen: number;
  uptimePercent: number;

  // Success/failure tracking
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  consecutiveFailures: number;

  // Latency tracking
  latencies: number[]; // Recent latencies in ms
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;

  // Load tracking
  currentLoad: number; // Active requests
  maxCapacity: number;
  loadPercent: number;

  // Geographic info
  region?: string;
  country?: string;
  latencyFromUs: number; // ms from current user

  // Network quality
  packetLoss: number; // 0-1
  jitter: number; // ms
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
  decayFactor: number; // For exponential moving average
  sampleSize: number; // Number of samples for statistics
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

export class DelegationRanker {
  private metrics: Map<string, SupernodeMetrics> = new Map();
  private config: RankingConfig;
  private clientRegion?: string;
  private clientCountry?: string;

  constructor(config: RankingConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Set client location for geographic affinity
   */
  setClientLocation(region?: string, country?: string): void {
    this.clientRegion = region;
    this.clientCountry = country;
  }

  /**
   * Update or create metrics for a supernode
   */
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

    // Trim latencies array to sample size
    if (metrics.latencies.length > this.config.sampleSize) {
      metrics.latencies = metrics.latencies.slice(-this.config.sampleSize);
    }

    this.metrics.set(peerID, metrics);
    return metrics;
  }

  /**
   * Record a request result for a supernode
   */
  recordRequest(
    peerID: string,
    latencyMs: number,
    success: boolean
  ): SupernodeMetrics {
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

    // Add latency with exponential moving average
    const decay = this.config.decayFactor;
    existing.avgLatency = existing.avgLatency * (1 - decay) + latencyMs * decay;
    existing.latencies.push(latencyMs);
    
    // Trim latencies
    if (existing.latencies.length > this.config.sampleSize) {
      existing.latencies = existing.latencies.slice(-this.config.sampleSize);
    }

    // Recalculate percentiles
    this.recalculatePercentiles(existing);

    // Update load
    if (!success) {
      existing.currentLoad = Math.max(0, existing.currentLoad - 1);
    }

    this.metrics.set(peerID, existing);
    return existing;
  }

  /**
   * Update load for a supernode
   */
  updateLoad(peerID: string, delta: number): void {
    const metrics = this.metrics.get(peerID);
    if (!metrics) return;

    metrics.currentLoad = Math.max(0, Math.min(metrics.maxCapacity, metrics.currentLoad + delta));
    metrics.loadPercent = (metrics.currentLoad / metrics.maxCapacity) * 100;
  }

  /**
   * Recalculate latency percentiles
   */
  private recalculatePercentiles(metrics: SupernodeMetrics): void {
    if (metrics.latencies.length === 0) {
      metrics.p50Latency = 0;
      metrics.p95Latency = 0;
      metrics.p99Latency = 0;
      return;
    }

    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const len = sorted.length;
    
    metrics.p50Latency = sorted[Math.floor(len * 0.50)];
    metrics.p95Latency = sorted[Math.floor(len * 0.95)];
    metrics.p99Latency = sorted[Math.floor(len * 0.99)];
  }

  /**
   * Create default metrics for a new supernode
   */
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

  /**
   * Calculate uptime score
   */
  private calculateUptimeScore(metrics: SupernodeMetrics): number {
    if (metrics.uptimePercent >= 99) return 1.0;
    if (metrics.uptimePercent >= 95) return 0.9;
    if (metrics.uptimePercent >= 90) return 0.7;
    if (metrics.uptimePercent >= this.config.minUptimePercent) return 0.5;
    return 0.2;
  }

  /**
   * Calculate success rate score
   */
  private calculateSuccessRateScore(metrics: SupernodeMetrics): number {
    if (metrics.totalRequests === 0) return 0.5; // Default for new nodes
    
    const successRate = metrics.successfulRequests / metrics.totalRequests;
    
    if (successRate >= 0.99) return 1.0;
    if (successRate >= 0.95) return 0.9;
    if (successRate >= 0.90) return 0.7;
    if (successRate >= this.config.minSuccessRate) return 0.5;
    return 0.2;
  }

  /**
   * Calculate latency score
   */
  private calculateLatencyScore(metrics: SupernodeMetrics): number {
    if (metrics.p95Latency === 0) return 0.5;
    
    const ratio = metrics.p95Latency / this.config.maxLatencyMs;
    
    if (ratio <= 0.1) return 1.0;
    if (ratio <= 0.25) return 0.8;
    if (ratio <= 0.5) return 0.6;
    if (ratio <= 0.75) return 0.4;
    return 0.2;
  }

  /**
   * Calculate consistency score (low variance in latency)
   */
  private calculateConsistencyScore(metrics: SupernodeMetrics): number {
    if (metrics.latencies.length < 10) return 0.5;
    
    const mean = metrics.avgLatency;
    const variance = metrics.latencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / metrics.latencies.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // Coefficient of variation
    
    if (cv <= 0.1) return 1.0;
    if (cv <= 0.2) return 0.8;
    if (cv <= 0.3) return 0.6;
    if (cv <= 0.5) return 0.4;
    return 0.2;
  }

  /**
   * Calculate failure rate score (penalize consecutive failures)
   */
  private calculateFailureRateScore(metrics: SupernodeMetrics): number {
    if (metrics.consecutiveFailures >= 10) return 0.1;
    if (metrics.consecutiveFailures >= 5) return 0.3;
    if (metrics.consecutiveFailures >= 3) return 0.5;
    if (metrics.consecutiveFailures >= 1) return 0.7;
    return 1.0;
  }

  /**
   * Calculate load score (inverse - lower load is better)
   */
  private calculateLoadScore(metrics: SupernodeMetrics): number {
    const loadRatio = metrics.loadPercent / 100;
    
    if (loadRatio <= 0.3) return 1.0;
    if (loadRatio <= 0.5) return 0.8;
    if (loadRatio <= 0.7) return 0.6;
    if (loadRatio <= this.config.maxLoadPercent / 100) return 0.4;
    return 0.1;
  }

  /**
   * Calculate capacity score
   */
  private calculateCapacityScore(metrics: SupernodeMetrics): number {
    if (metrics.maxCapacity >= 1000) return 1.0;
    if (metrics.maxCapacity >= 500) return 0.8;
    if (metrics.maxCapacity >= 100) return 0.6;
    return 0.4;
  }

  /**
   * Calculate geographic affinity score
   */
  private calculateGeographicScore(metrics: SupernodeMetrics): number {
    if (!this.clientRegion || !metrics.region) return 0.5;
    
    // Same country
    if (this.clientCountry && metrics.country === this.clientCountry) {
      return 1.0;
    }
    
    // Same region
    if (metrics.region === this.clientRegion) {
      return 0.8;
    }
    
    // Different region but low latency
    if (metrics.latencyFromUs < 100) {
      return 0.6;
    }
    
    return 0.3;
  }

  /**
   * Calculate network quality score
   */
  private calculateNetworkQualityScore(metrics: SupernodeMetrics): number {
    const packetLossScore = 1 - metrics.packetLoss;
    const jitterScore = metrics.jitter < 10 ? 1.0 : metrics.jitter < 50 ? 0.7 : 0.4;
    
    return (packetLossScore + jitterScore) / 2;
  }

  /**
   * Calculate overall ranking for a supernode
   */
  rankSupernode(peerID: string): SupernodeRanking | null {
    const metrics = this.metrics.get(peerID);
    if (!metrics) return null;

    // Check minimum requirements
    if (metrics.uptimePercent < this.config.minUptimePercent) return null;
    if (metrics.successfulRequests / metrics.totalRequests < this.config.minSuccessRate) return null;
    if (metrics.loadPercent > this.config.maxLoadPercent) return null;

    const weights = this.config.weights;

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

    const geographicAffinity = components.geographicScore;
    const loadFactor = 1 - components.loadScore; // Inverse

    return {
      peerID,
      overallScore,
      components,
      geographicAffinity,
      loadFactor,
      rank: 0, // Will be set when ranking multiple nodes
    };
  }

  /**
   * Rank all known supernodes
   */
  rankAll(): SupernodeRanking[] {
    const rankings: SupernodeRanking[] = [];

    for (const peerID of this.metrics.keys()) {
      const ranking = this.rankSupernode(peerID);
      if (ranking) {
        rankings.push(ranking);
      }
    }

    // Sort by overall score descending
    rankings.sort((a, b) => b.overallScore - a.overallScore);

    // Assign ranks
    rankings.forEach((r, i) => {
      r.rank = i + 1;
    });

    return rankings;
  }

  /**
   * Get top N supernodes for delegation
   */
  getTopN(n: number): SupernodeRanking[] {
    const rankings = this.rankAll();
    return rankings.slice(0, n);
  }

  /**
   * Get best supernode for delegation
   */
  getBest(): SupernodeRanking | null {
    const rankings = this.rankAll();
    return rankings.length > 0 ? rankings[0] : null;
  }

  /**
   * Get metrics for a supernode
   */
  getMetrics(peerID: string): SupernodeMetrics | undefined {
    return this.metrics.get(peerID);
  }

  /**
   * Remove a supernode from tracking
   */
  remove(peerID: string): void {
    this.metrics.delete(peerID);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get ranking statistics
   */
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
    const avgLatency = rankings.reduce((sum, r) => {
      const metrics = this.metrics.get(r.peerID);
      return sum + (metrics?.p95Latency ?? 0);
    }, 0) / rankings.length;
    
    const avgSuccessRate = rankings.reduce((sum, r) => {
      const metrics = this.metrics.get(r.peerID);
      if (!metrics || metrics.totalRequests === 0) return sum;
      return sum + metrics.successfulRequests / metrics.totalRequests;
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

/**
 * Create ranker with default configuration
 */
export function createDelegationRanker(
  config?: Partial<RankingConfig>
): DelegationRanker {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  return new DelegationRanker(finalConfig);
}
