/**
 * Metrics Calculator Service
 */

import type { LatencySample, LatencyStats } from '../types/health.js';

export class MetricsCalculator {
  /**
   * Calculate percentile from sorted array
   */
  static percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate latency statistics
   */
  static calculateLatencyStats(samples: LatencySample[]): LatencyStats {
    if (samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
    const sum = latencies.reduce((acc, val) => acc + val, 0);

    return {
      p50: this.percentile(latencies, 50),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
      avg: sum / latencies.length,
      min: latencies[0],
      max: latencies[latencies.length - 1],
    };
  }

  /**
   * Calculate success rate
   */
  static calculateSuccessRate(
    total: number,
    successful: number
  ): number {
    return total > 0 ? successful / total : 1;
  }

  /**
   * Calculate health score (0-1)
   */
  static calculateHealthScore(
    successRate: number,
    latencyStats: LatencyStats,
    resources: { memoryUsageMB: number; cpuUsagePercent: number },
    thresholds: {
      healthyMaxP95: number;
      degradedMaxP95: number;
      healthyMaxP99: number;
      maxMemoryMB: number;
      maxCpuPercent: number;
    }
  ): number {
    const successScore = successRate * 0.5;

    let latencyScore = 1.0;
    if (latencyStats.p95 > thresholds.healthyMaxP95) {
      latencyScore *= 0.7;
    }
    if (latencyStats.p95 > thresholds.degradedMaxP95) {
      latencyScore *= 0.7;
    }
    if (latencyStats.p99 > thresholds.healthyMaxP99) {
      latencyScore *= 0.8;
    }
    const latencyComponent = latencyScore * 0.3;

    let resourceScore = 1.0;
    if (resources.memoryUsageMB > thresholds.maxMemoryMB * 0.8) {
      resourceScore *= 0.8;
    }
    if (resources.cpuUsagePercent > thresholds.maxCpuPercent * 0.8) {
      resourceScore *= 0.8;
    }
    const resourceComponent = resourceScore * 0.2;

    return successScore + latencyComponent + resourceComponent;
  }
}
