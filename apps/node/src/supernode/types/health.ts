/**
 * Supernode Health Monitoring Types
 */

export interface HealthMetrics {
  peerID: string;
  timestamp: number;
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  consecutiveFailures: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  latencyAvg: number;
  latencyMin: number;
  latencyMax: number;
  requestsLastMinute: number;
  requestsLastHour: number;
  requestsLast24h: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  activeConnections: number;
  healthScore: number;
  status: HealthStatus;
  degradationReason?: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface LatencySample {
  latencyMs: number;
  timestamp: number;
  success: boolean;
  requestType: string;
}

export interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

export interface ResourceUsage {
  memoryUsageMB: number;
  cpuUsagePercent: number;
  activeConnections: number;
}

export interface HealthEvaluation {
  status: HealthStatus;
  reason?: string;
}

export interface HealthThresholds {
  healthyMinSuccessRate: number;
  degradedMinSuccessRate: number;
  healthyMaxP95: number;
  degradedMaxP95: number;
  healthyMaxP99: number;
  degradedMaxP99: number;
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxConnections: number;
  consecutiveFailures: number;
  timeWindowMs: number;
}
