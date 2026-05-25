/* eslint-disable */
/**
 * Supernode Health Monitoring System
 *
 * Real-time health monitoring with strategy-based evaluation,
 * success rate tracking, latency percentiles, and automatic degradation.
 *
 * References: NEXT_STEPS.md#71-supernode-health-metrics
 */

export type {
  HealthMetrics,
  HealthStatus,
  LatencySample,
  LatencyStats,
  ResourceUsage,
  HealthEvaluation,
  HealthThresholds,
} from './types/health.js';

export { HEALTH_CONFIG, DEFAULT_THRESHOLDS, HEALTH_SCORE_WEIGHTS, TIME_BUCKETS } from './config/healthConfig.js';

export type { HealthStrategy } from './strategies/HealthStrategy.js';
export { SuccessRateStrategy } from './strategies/SuccessRateStrategy.js';
export { LatencyStrategy } from './strategies/LatencyStrategy.js';
export { ResourceStrategy } from './strategies/ResourceStrategy.js';

export { MetricsCalculator } from './services/MetricsCalculator.js';
export { HealthEvaluator } from './services/HealthEvaluator.js';
export { RequestTracker } from './services/RequestTracker.js';
export { ResourceMonitor } from './services/ResourceMonitor.js';

import type { HealthMetrics, HealthThresholds, LatencyStats, ResourceUsage } from './types/health.js';
import { DEFAULT_THRESHOLDS, HEALTH_CONFIG } from './config/healthConfig.js';
import { HealthEvaluator } from './services/HealthEvaluator.js';
import { MetricsCalculator } from './services/MetricsCalculator.js';
import { RequestTracker } from './services/RequestTracker.js';
import { ResourceMonitor } from './services/ResourceMonitor.js';

export class SupernodeMonitor {
  private peerID: string;
  private startTime: number;
  private thresholds: HealthThresholds;
  private tracker: RequestTracker;
  private resourceMonitor: ResourceMonitor;
  private evaluator: HealthEvaluator;

  constructor(
    peerID: string,
    thresholds: HealthThresholds = DEFAULT_THRESHOLDS
  ) {
    this.peerID = peerID;
    this.startTime = Date.now();
    this.thresholds = thresholds;
    this.tracker = new RequestTracker(thresholds);
    this.resourceMonitor = new ResourceMonitor();
    this.evaluator = new HealthEvaluator();
  }

  recordRequest(
    latencyMs: number,
    success: boolean,
    requestType: string = 'delegation'
  ): void {
    this.tracker.recordRequest(latencyMs, success, requestType);
  }

  getMetrics(): HealthMetrics {
    const samples = this.tracker.getRecentSamples();
    const latencyStats = MetricsCalculator.calculateLatencyStats(samples);
    const resources = this.resourceMonitor.getUsage();
    const successRate = MetricsCalculator.calculateSuccessRate(
      this.tracker.getTotalRequests(),
      this.tracker.getSuccessfulRequests()
    );

    const { status, reason } = this.evaluator.evaluate(this.thresholds, {
      successRate,
      consecutiveFailures: this.tracker.getConsecutiveFailures(),
      latencyStats,
      resources,
    });

    const requestCounts = this.tracker.getRequestCounts();
    const healthScore = MetricsCalculator.calculateHealthScore(
      successRate,
      latencyStats,
      resources,
      this.thresholds
    );

    return {
      peerID: this.peerID,
      timestamp: Date.now(),
      uptime: (Date.now() - this.startTime) / 1000,
      totalRequests: this.tracker.getTotalRequests(),
      successfulRequests: this.tracker.getSuccessfulRequests(),
      failedRequests: this.tracker.getFailedRequests(),
      successRate,
      consecutiveFailures: this.tracker.getConsecutiveFailures(),
      latencyP50: latencyStats.p50,
      latencyP95: latencyStats.p95,
      latencyP99: latencyStats.p99,
      latencyAvg: latencyStats.avg,
      latencyMin: latencyStats.min,
      latencyMax: latencyStats.max,
      requestsLastMinute: requestCounts.lastMinute,
      requestsLastHour: requestCounts.lastHour,
      requestsLast24h: requestCounts.last24h,
      memoryUsageMB: resources.memoryUsageMB,
      cpuUsagePercent: resources.cpuUsagePercent,
      activeConnections: resources.activeConnections,
      healthScore,
      status,
      degradationReason: reason,
    };
  }

  isHealthy(): boolean {
    return this.getMetrics().status === 'healthy';
  }

  isDegraded(): boolean {
    return this.getMetrics().status === 'degraded';
  }

  reset(): void {
    this.tracker.reset();
    this.startTime = Date.now();
  }

  getSuccessRate(windowMs?: number): number {
    if (!windowMs) {
      return MetricsCalculator.calculateSuccessRate(
        this.tracker.getTotalRequests(),
        this.tracker.getSuccessfulRequests()
      );
    }

    const samples = this.tracker.getRecentSamples(windowMs);
    if (samples.length === 0) return 1;

    const successful = samples.filter((s) => s.success).length;
    return successful / samples.length;
  }

  getAvgLatency(windowMs?: number): number {
    const samples = this.tracker.getRecentSamples(windowMs);
    if (samples.length === 0) return 0;

    const sum = samples.reduce((acc, s) => acc + s.latencyMs, 0);
    return sum / samples.length;
  }

  setConnectionCount(count: number): void {
    this.resourceMonitor.setConnectionCount(count);
  }

  incrementConnections(): void {
    this.resourceMonitor.incrementConnections();
  }

  decrementConnections(): void {
    this.resourceMonitor.decrementConnections();
  }
}

export function createSupernodeMonitor(
  peerID: string,
  customThresholds?: Partial<HealthThresholds>
): SupernodeMonitor {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  return new SupernodeMonitor(peerID, thresholds);
}
