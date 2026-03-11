/**
 * Supernode Health Monitoring System
 *
 * Real-time health monitoring with success rate tracking,
 * latency percentiles, and automatic degradation.
 *
 * References: NEXT_STEPS.md#71-supernode-health-metrics
 */

export interface HealthMetrics {
  // Basic metrics
  peerID: string;
  timestamp: number;
  uptime: number; // seconds

  // Success rate
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number; // 0-1
  consecutiveFailures: number;

  // Latency percentiles (milliseconds)
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  latencyAvg: number;
  latencyMin: number;
  latencyMax: number;

  // Request volume
  requestsLastMinute: number;
  requestsLastHour: number;
  requestsLast24h: number;

  // Resource usage
  memoryUsageMB: number;
  cpuUsagePercent: number;
  activeConnections: number;

  // Health status
  healthScore: number; // 0-1
  status: 'healthy' | 'degraded' | 'unhealthy';
  degradationReason?: string;
}

export interface LatencySample {
  latencyMs: number;
  timestamp: number;
  success: boolean;
  requestType: string;
}

export interface HealthThresholds {
  // Success rate thresholds
  healthyMinSuccessRate: number;
  degradedMinSuccessRate: number;
  
  // Latency thresholds (ms)
  healthyMaxP95: number;
  degradedMaxP95: number;
  healthyMaxP99: number;
  degradedMaxP99: number;
  
  // Resource thresholds
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxConnections: number;
  
  // Degradation triggers
  consecutiveFailures: number;
  timeWindowMs: number;
}

const DEFAULT_THRESHOLDS: HealthThresholds = {
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
  timeWindowMs: 60000, // 1 minute
};

export class SupernodeMonitor {
  private peerID: string;
  private samples: LatencySample[] = [];
  private startTime: number;
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private consecutiveFailures: number = 0;
  private thresholds: HealthThresholds;
  private requestCounts: {
    lastMinute: number[];
    lastHour: number[];
    last24h: number[];
  };

  constructor(
    peerID: string,
    thresholds: HealthThresholds = DEFAULT_THRESHOLDS
  ) {
    this.peerID = peerID;
    this.startTime = Date.now();
    this.thresholds = thresholds;
    this.requestCounts = {
      lastMinute: new Array(60).fill(0),
      lastHour: new Array(60).fill(0),
      last24h: new Array(24).fill(0),
    };
  }

  /**
   * Record a request completion
   */
  recordRequest(
    latencyMs: number,
    success: boolean,
    requestType: string = 'delegation'
  ): void {
    const now = Date.now();
    
    this.samples.push({
      latencyMs,
      timestamp: now,
      success,
      requestType,
    });

    this.totalRequests++;
    
    if (success) {
      this.successfulRequests++;
      this.consecutiveFailures = 0;
    } else {
      this.failedRequests++;
      this.consecutiveFailures++;
    }

    // Update request counts
    this.updateRequestCounts(now);

    // Trim old samples (keep last 10 minutes)
    this.trimSamples(now);
  }

  /**
   * Update request count buckets
   */
  private updateRequestCounts(now: number): void {
    const secondIndex = Math.floor(now / 1000) % 60;
    const minuteIndex = Math.floor(now / 60000) % 60;
    const hourIndex = Math.floor(now / 3600000) % 24;

    // Reset buckets if needed
    const currentSecond = Math.floor(Date.now() / 1000);
    if (currentSecond % 60 !== this.requestCounts.lastMinute.findIndex((c) => c > 0)) {
      this.requestCounts.lastMinute.fill(0);
    }
    this.requestCounts.lastMinute[secondIndex]++;

    const currentMinute = Math.floor(Date.now() / 60000);
    if (currentMinute % 60 !== this.requestCounts.lastHour.findIndex((c) => c > 0)) {
      this.requestCounts.lastHour.fill(0);
    }
    this.requestCounts.lastHour[minuteIndex]++;

    const currentHour = Math.floor(Date.now() / 3600000);
    if (currentHour % 24 !== this.requestCounts.last24h.findIndex((c) => c > 0)) {
      this.requestCounts.last24h.fill(0);
    }
    this.requestCounts.last24h[hourIndex]++;
  }

  /**
   * Trim samples older than time window
   */
  private trimSamples(now: number): void {
    const cutoff = now - this.thresholds.timeWindowMs * 10; // Keep 10x window
    this.samples = this.samples.filter((s) => s.timestamp > cutoff);
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate latency statistics
   */
  private calculateLatencyStats(): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  } {
    const recentSamples = this.getRecentSamples();
    
    if (recentSamples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const latencies = recentSamples.map((s) => s.latencyMs).sort((a, b) => a - b);
    
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
   * Get samples within time window
   */
  private getRecentSamples(): LatencySample[] {
    const now = Date.now();
    const cutoff = now - this.thresholds.timeWindowMs;
    return this.samples.filter((s) => s.timestamp > cutoff);
  }

  /**
   * Get current resource usage (Node.js specific)
   */
  private getResourceUsage(): {
    memoryUsageMB: number;
    cpuUsagePercent: number;
    activeConnections: number;
  } {
    // In browser, these would be unavailable
    if (typeof process === 'undefined') {
      return {
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
        activeConnections: 0,
      };
    }

    const memUsage = process.memoryUsage();
    const memoryMB = memUsage.heapUsed / (1024 * 1024);

    return {
      memoryUsageMB: memoryMB,
      cpuUsagePercent: 0, // Would need external library for accurate CPU
      activeConnections: 0, // Would track connections separately
    };
  }

  /**
   * Determine health status based on metrics
   */
  private determineHealthStatus(
    successRate: number,
    p95: number,
    p99: number,
    resources: { memoryUsageMB: number; cpuUsagePercent: number }
  ): { status: 'healthy' | 'degraded' | 'unhealthy'; reason?: string } {
    // Check consecutive failures
    if (this.consecutiveFailures >= this.thresholds.consecutiveFailures) {
      return {
        status: 'unhealthy',
        reason: `Consecutive failures: ${this.consecutiveFailures}`,
      };
    }

    // Check success rate
    if (successRate < this.thresholds.degradedMinSuccessRate) {
      return {
        status: 'unhealthy',
        reason: `Success rate too low: ${(successRate * 100).toFixed(1)}%`,
      };
    }

    if (successRate < this.thresholds.healthyMinSuccessRate) {
      return {
        status: 'degraded',
        reason: `Success rate degraded: ${(successRate * 100).toFixed(1)}%`,
      };
    }

    // Check latency
    if (p99 > this.thresholds.degradedMaxP99 || p95 > this.thresholds.degradedMaxP95) {
      return {
        status: 'degraded',
        reason: `High latency: P95=${p95.toFixed(0)}ms, P99=${p99.toFixed(0)}ms`,
      };
    }

    // Check resources
    if (resources.memoryUsageMB > this.thresholds.maxMemoryMB) {
      return {
        status: 'degraded',
        reason: `High memory usage: ${resources.memoryUsageMB.toFixed(0)}MB`,
      };
    }

    if (resources.cpuUsagePercent > this.thresholds.maxCpuPercent) {
      return {
        status: 'degraded',
        reason: `High CPU usage: ${resources.cpuUsagePercent.toFixed(1)}%`,
      };
    }

    return { status: 'healthy' };
  }

  /**
   * Calculate overall health score (0-1)
   */
  private calculateHealthScore(
    successRate: number,
    latencyStats: ReturnType<typeof this.calculateLatencyStats>,
    resources: { memoryUsageMB: number; cpuUsagePercent: number }
  ): number {
    // Success rate component (50% weight)
    const successScore = successRate * 0.5;

    // Latency component (30% weight)
    let latencyScore = 1.0;
    if (latencyStats.p95 > this.thresholds.healthyMaxP95) {
      latencyScore *= 0.7;
    }
    if (latencyStats.p95 > this.thresholds.degradedMaxP95) {
      latencyScore *= 0.7;
    }
    if (latencyStats.p99 > this.thresholds.healthyMaxP99) {
      latencyScore *= 0.8;
    }
    const latencyComponent = latencyScore * 0.3;

    // Resource component (20% weight)
    let resourceScore = 1.0;
    if (resources.memoryUsageMB > this.thresholds.maxMemoryMB * 0.8) {
      resourceScore *= 0.8;
    }
    if (resources.cpuUsagePercent > this.thresholds.maxCpuPercent * 0.8) {
      resourceScore *= 0.8;
    }
    const resourceComponent = resourceScore * 0.2;

    return successScore + latencyComponent + resourceComponent;
  }

  /**
   * Get current health metrics
   */
  getMetrics(): HealthMetrics {
    const latencyStats = this.calculateLatencyStats();
    const resources = this.getResourceUsage();
    const successRate =
      this.totalRequests > 0 ? this.successfulRequests / this.totalRequests : 1;

    const { status, reason } = this.determineHealthStatus(
      successRate,
      latencyStats.p95,
      latencyStats.p99,
      resources
    );

    const healthScore = this.calculateHealthScore(successRate, latencyStats, resources);

    return {
      peerID: this.peerID,
      timestamp: Date.now(),
      uptime: (Date.now() - this.startTime) / 1000,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate,
      latencyP50: latencyStats.p50,
      latencyP95: latencyStats.p95,
      latencyP99: latencyStats.p99,
      latencyAvg: latencyStats.avg,
      latencyMin: latencyStats.min,
      latencyMax: latencyStats.max,
      requestsLastMinute: this.requestCounts.lastMinute.reduce((a, b) => a + b, 0),
      requestsLastHour: this.requestCounts.lastHour.reduce((a, b) => a + b, 0),
      requestsLast24h: this.requestCounts.last24h.reduce((a, b) => a + b, 0),
      memoryUsageMB: resources.memoryUsageMB,
      cpuUsagePercent: resources.cpuUsagePercent,
      activeConnections: resources.activeConnections,
      consecutiveFailures: this.consecutiveFailures,
      healthScore,
      status,
      degradationReason: reason,
    };
  }

  /**
   * Check if supernode should be marked as unhealthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    return metrics.status === 'healthy';
  }

  /**
   * Check if supernode is degraded but still usable
   */
  isDegraded(): boolean {
    const metrics = this.getMetrics();
    return metrics.status === 'degraded';
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.samples = [];
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.consecutiveFailures = 0;
    this.startTime = Date.now();
    this.requestCounts = {
      lastMinute: new Array(60).fill(0),
      lastHour: new Array(60).fill(0),
      last24h: new Array(24).fill(0),
    };
  }

  /**
   * Get success rate over time window
   */
  getSuccessRate(windowMs?: number): number {
    if (!windowMs) {
      return this.totalRequests > 0
        ? this.successfulRequests / this.totalRequests
        : 1;
    }

    const recentSamples = this.getRecentSamples();
    if (recentSamples.length === 0) return 1;

    const successful = recentSamples.filter((s) => s.success).length;
    return successful / recentSamples.length;
  }

  /**
   * Get average latency over time window
   */
  getAvgLatency(windowMs?: number): number {
    const recentSamples = this.getRecentSamples();
    if (recentSamples.length === 0) return 0;

    const sum = recentSamples.reduce((acc, s) => acc + s.latencyMs, 0);
    return sum / recentSamples.length;
  }
}

/**
 * Create monitor with default configuration
 */
export function createSupernodeMonitor(
  peerID: string,
  customThresholds?: Partial<HealthThresholds>
): SupernodeMonitor {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...customThresholds };
  return new SupernodeMonitor(peerID, thresholds);
}
