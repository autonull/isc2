/* eslint-disable */
/**
 * Request Tracker Service
 */

import type { LatencySample, HealthThresholds } from '../types/health.js';
import { HEALTH_CONFIG, TIME_BUCKETS } from '../config/healthConfig.js';

export class RequestTracker {
  private samples: LatencySample[] = [];
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private consecutiveFailures = 0;
  private requestCounts: {
    lastMinute: number[];
    lastHour: number[];
    last24h: number[];
  };

  constructor(private thresholds: HealthThresholds) {
    this.requestCounts = {
      lastMinute: new Array(TIME_BUCKETS.MINUTE).fill(0),
      lastHour: new Array(TIME_BUCKETS.HOUR).fill(0),
      last24h: new Array(TIME_BUCKETS.DAY).fill(0),
    };
  }

  recordRequest(latencyMs: number, success: boolean, requestType: string = 'delegation'): void {
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

    this.updateRequestCounts(now);
    this.trimSamples(now);
  }

  private updateRequestCounts(now: number): void {
    const secondIndex = Math.floor(now / 1000) % 60;
    const minuteIndex = Math.floor(now / 60000) % 60;
    const hourIndex = Math.floor(now / 3600000) % 24;

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

  private trimSamples(now: number): void {
    const cutoff = now - this.thresholds.timeWindowMs * HEALTH_CONFIG.SAMPLE_RETENTION_MULTIPLIER;
    const maxSamples = HEALTH_CONFIG.MAX_SAMPLES_KEEP;

    this.samples = this.samples
      .filter((s) => s.timestamp > cutoff)
      .slice(-maxSamples);
  }

  getSamples(): LatencySample[] {
    return this.samples;
  }

  getRecentSamples(timeWindowMs?: number): LatencySample[] {
    const now = Date.now();
    const cutoff = now - (timeWindowMs ?? this.thresholds.timeWindowMs);
    return this.samples.filter((s) => s.timestamp > cutoff);
  }

  getTotalRequests(): number {
    return this.totalRequests;
  }

  getSuccessfulRequests(): number {
    return this.successfulRequests;
  }

  getFailedRequests(): number {
    return this.failedRequests;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  getRequestCounts(): {
    lastMinute: number;
    lastHour: number;
    last24h: number;
  } {
    return {
      lastMinute: this.requestCounts.lastMinute.reduce((a, b) => a + b, 0),
      lastHour: this.requestCounts.lastHour.reduce((a, b) => a + b, 0),
      last24h: this.requestCounts.last24h.reduce((a, b) => a + b, 0),
    };
  }

  reset(): void {
    this.samples = [];
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.consecutiveFailures = 0;
    this.requestCounts = {
      lastMinute: new Array(TIME_BUCKETS.MINUTE).fill(0),
      lastHour: new Array(TIME_BUCKETS.HOUR).fill(0),
      last24h: new Array(TIME_BUCKETS.DAY).fill(0),
    };
  }
}
