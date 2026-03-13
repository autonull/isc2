/**
 * Success Rate Health Strategy
 */

import type { HealthStrategy } from './HealthStrategy.js';
import type { HealthThresholds, HealthEvaluation, LatencyStats, ResourceUsage } from '../types/health.js';

export class SuccessRateStrategy implements HealthStrategy {
  evaluate(
    thresholds: HealthThresholds,
    context: {
      successRate: number;
      consecutiveFailures: number;
      latencyStats: LatencyStats;
      resources: ResourceUsage;
    }
  ): HealthEvaluation {
    if (context.consecutiveFailures >= thresholds.consecutiveFailures) {
      return {
        status: 'unhealthy',
        reason: `Consecutive failures: ${context.consecutiveFailures}`,
      };
    }

    if (context.successRate < thresholds.degradedMinSuccessRate) {
      return {
        status: 'unhealthy',
        reason: `Success rate too low: ${(context.successRate * 100).toFixed(1)}%`,
      };
    }

    if (context.successRate < thresholds.healthyMinSuccessRate) {
      return {
        status: 'degraded',
        reason: `Success rate degraded: ${(context.successRate * 100).toFixed(1)}%`,
      };
    }

    return { status: 'healthy' };
  }
}
