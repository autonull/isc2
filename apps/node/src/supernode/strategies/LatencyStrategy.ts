/**
 * Latency Health Strategy
 */

import type { HealthStrategy } from './HealthStrategy.js';
import type { HealthThresholds, HealthEvaluation, LatencyStats, ResourceUsage } from '../types/health.js';

export class LatencyStrategy implements HealthStrategy {
  evaluate(
    thresholds: HealthThresholds,
    context: {
      successRate: number;
      consecutiveFailures: number;
      latencyStats: LatencyStats;
      resources: ResourceUsage;
    }
  ): HealthEvaluation {
    const { p95, p99 } = context.latencyStats;

    if (p99 > thresholds.degradedMaxP99 || p95 > thresholds.degradedMaxP95) {
      return {
        status: 'degraded',
        reason: `High latency: P95=${p95.toFixed(0)}ms, P99=${p99.toFixed(0)}ms`,
      };
    }

    return { status: 'healthy' };
  }
}
