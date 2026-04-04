/* eslint-disable */
/**
 * Health Evaluator Service
 */

import type { HealthThresholds, HealthEvaluation, LatencyStats, ResourceUsage, HealthStatus } from '../types/health.js';
import { SuccessRateStrategy } from '../strategies/SuccessRateStrategy.js';
import { LatencyStrategy } from '../strategies/LatencyStrategy.js';
import { ResourceStrategy } from '../strategies/ResourceStrategy.js';

export class HealthEvaluator {
  private successRateStrategy: SuccessRateStrategy;
  private latencyStrategy: LatencyStrategy;
  private resourceStrategy: ResourceStrategy;

  constructor() {
    this.successRateStrategy = new SuccessRateStrategy();
    this.latencyStrategy = new LatencyStrategy();
    this.resourceStrategy = new ResourceStrategy();
  }

  evaluate(
    thresholds: HealthThresholds,
    context: {
      successRate: number;
      consecutiveFailures: number;
      latencyStats: LatencyStats;
      resources: ResourceUsage;
    }
  ): HealthEvaluation {
    const successRateResult = this.successRateStrategy.evaluate(thresholds, context);

    if (successRateResult.status !== 'healthy') {
      return successRateResult;
    }

    const latencyResult = this.latencyStrategy.evaluate(thresholds, context);

    if (latencyResult.status !== 'healthy') {
      return latencyResult;
    }

    return this.resourceStrategy.evaluate(thresholds, context);
  }

  determineOverallStatus(evaluations: HealthEvaluation[]): {
    status: HealthStatus;
    reason?: string;
  } {
    const unhealthy = evaluations.find((e) => e.status === 'unhealthy');
    if (unhealthy) {
      return unhealthy;
    }

    const degraded = evaluations.find((e) => e.status === 'degraded');
    if (degraded) {
      return degraded;
    }

    return { status: 'healthy' };
  }
}
