/**
 * Health Monitoring Configuration
 */

import type { HealthThresholds } from '../types/health.js';

export const HEALTH_CONFIG = {
  SAMPLE_RETENTION_MULTIPLIER: 10,
  MAX_SAMPLES_KEEP: 10000,
} as const;

export const DEFAULT_THRESHOLDS: HealthThresholds = {
  healthyMinSuccessRate: 0.95,
  degradedMinSuccessRate: 0.80,
  healthyMaxP95: 500,
  degradedMaxP95: 1000,
  healthyMaxP99: 1000,
  degradedMaxP99: 2000,
  maxMemoryMB: 1024,
  maxCpuPercent: 80,
  maxConnections: 1000,
  consecutiveFailures: 5,
  timeWindowMs: 60000,
} as const;

export const HEALTH_SCORE_WEIGHTS = {
  SUCCESS_RATE: 0.5,
  LATENCY: 0.3,
  RESOURCES: 0.2,
} as const;

export const TIME_BUCKETS = {
  MINUTE: 60,
  HOUR: 60,
  DAY: 24,
} as const;
