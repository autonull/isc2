/**
 * Health Strategy Interface
 */

import type { HealthThresholds, HealthEvaluation, LatencyStats, ResourceUsage } from '../types/health.js';

export interface HealthStrategy {
  evaluate(
    thresholds: HealthThresholds,
    context: {
      successRate: number;
      consecutiveFailures: number;
      latencyStats: LatencyStats;
      resources: ResourceUsage;
    }
  ): HealthEvaluation;
}
