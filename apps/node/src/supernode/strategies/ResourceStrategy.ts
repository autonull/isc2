/**
 * Resource Health Strategy
 */

import type { HealthStrategy } from './HealthStrategy.js';
import type { HealthThresholds, HealthEvaluation, LatencyStats, ResourceUsage } from '../types/health.js';

export class ResourceStrategy implements HealthStrategy {
  evaluate(
    thresholds: HealthThresholds,
    context: {
      successRate: number;
      consecutiveFailures: number;
      latencyStats: LatencyStats;
      resources: ResourceUsage;
    }
  ): HealthEvaluation {
    const { memoryUsageMB, cpuUsagePercent } = context.resources;

    if (memoryUsageMB > thresholds.maxMemoryMB) {
      return {
        status: 'degraded',
        reason: `High memory usage: ${memoryUsageMB.toFixed(0)}MB`,
      };
    }

    if (cpuUsagePercent > thresholds.maxCpuPercent) {
      return {
        status: 'degraded',
        reason: `High CPU usage: ${cpuUsagePercent.toFixed(1)}%`,
      };
    }

    return { status: 'healthy' };
  }
}
