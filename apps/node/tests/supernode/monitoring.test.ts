/* eslint-disable */
/**
 * Supernode Health Monitoring Tests
 *
 * Tests for Phase 7: Performance & Scale - Health Metrics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SupernodeMonitor,
  createSupernodeMonitor,
  type HealthMetrics,
  type HealthThresholds,
} from '../../src/supernode/monitoring';

describe('SupernodeMonitor', () => {
  let monitor: SupernodeMonitor;

  beforeEach(() => {
    monitor = createSupernodeMonitor('peer_test');
  });

  describe('recordRequest', () => {
    it('should record successful request with latency', () => {
      monitor.recordRequest(100, true, 'delegation');
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should record failed request', () => {
      monitor.recordRequest(500, false, 'delegation');
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
    });

    it('should track consecutive failures', () => {
      monitor.recordRequest(100, false);
      monitor.recordRequest(100, false);
      monitor.recordRequest(100, false);
      
      const metrics = monitor.getMetrics();
      expect(metrics.failedRequests).toBe(3);
    });

    it('should reset consecutive failures on success', () => {
      monitor.recordRequest(100, false);
      monitor.recordRequest(100, false);
      monitor.recordRequest(100, true);
      
      const metrics = monitor.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return complete health metrics', () => {
      monitor.recordRequest(100, true);
      monitor.recordRequest(150, true);
      monitor.recordRequest(200, true);
      
      const metrics = monitor.getMetrics();
      
      expect(metrics).toHaveProperty('peerID');
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('latencyP50');
      expect(metrics).toHaveProperty('latencyP95');
      expect(metrics).toHaveProperty('latencyP99');
      expect(metrics).toHaveProperty('healthScore');
      expect(metrics).toHaveProperty('status');
    });

    it('should calculate correct success rate', () => {
      monitor.recordRequest(100, true);
      monitor.recordRequest(100, true);
      monitor.recordRequest(100, false);
      monitor.recordRequest(100, true);
      
      const metrics = monitor.getMetrics();
      expect(metrics.successRate).toBeCloseTo(0.75, 2);
    });

    it('should return 100% success rate with no requests', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.successRate).toBe(1);
    });

    it('should calculate latency percentiles', () => {
      // Record 100 requests with known latencies
      for (let i = 1; i <= 100; i++) {
        monitor.recordRequest(i, true);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.latencyP50).toBeGreaterThan(0);
      expect(metrics.latencyP95).toBeGreaterThan(metrics.latencyP50);
      expect(metrics.latencyP99).toBeGreaterThanOrEqual(metrics.latencyP95);
    });

    it('should track request volume over time', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest(100, true);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.requestsLastMinute).toBe(10);
      expect(metrics.requestsLastHour).toBe(10);
      expect(metrics.requestsLast24h).toBe(10);
    });
  });

  describe('health status', () => {
    it('should be healthy with good metrics', () => {
      for (let i = 0; i < 20; i++) {
        monitor.recordRequest(100, true);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.status).toBe('healthy');
      expect(metrics.healthScore).toBeGreaterThan(0.7);
    });

    it('should be degraded with moderate success rate', () => {
      // Create monitor with lower thresholds for testing
      const customMonitor = createSupernodeMonitor('peer_test', {
        healthyMinSuccessRate: 0.95,
        degradedMinSuccessRate: 0.70,
      });
      
      // 75% success rate
      for (let i = 0; i < 15; i++) {
        customMonitor.recordRequest(100, i < 12);
      }
      
      const metrics = customMonitor.getMetrics();
      expect(metrics.status).toBe('degraded');
    });

    it('should be unhealthy with many consecutive failures', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordRequest(100, false);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.status).toBe('unhealthy');
      expect(metrics.degradationReason).toContain('Consecutive failures');
    });

    it('should be unhealthy with very low success rate', () => {
      const customMonitor = createSupernodeMonitor('peer_test', {
        degradedMinSuccessRate: 0.80,
      });
      
      // 50% success rate
      for (let i = 0; i < 20; i++) {
        customMonitor.recordRequest(100, i < 10);
      }
      
      const metrics = customMonitor.getMetrics();
      expect(metrics.status).toBe('unhealthy');
    });
  });

  describe('isHealthy', () => {
    it('should return true for healthy supernode', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest(100, true);
      }
      
      expect(monitor.isHealthy()).toBe(true);
    });

    it('should return false for unhealthy supernode', () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordRequest(100, false);
      }
      
      expect(monitor.isHealthy()).toBe(false);
    });
  });

  describe('isDegraded', () => {
    it('should return true for degraded supernode', () => {
      const customMonitor = createSupernodeMonitor('peer_test', {
        healthyMinSuccessRate: 0.95,
        degradedMinSuccessRate: 0.70,
      });
      
      for (let i = 0; i < 20; i++) {
        customMonitor.recordRequest(100, i < 16);
      }
      
      expect(customMonitor.isDegraded()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest(100, i < 8);
      }
      
      monitor.reset();
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successRate).toBe(1);
      expect(metrics.uptime).toBeLessThan(1); // Just reset
    });
  });

  describe('getSuccessRate', () => {
    it('should return overall success rate', () => {
      monitor.recordRequest(100, true);
      monitor.recordRequest(100, true);
      monitor.recordRequest(100, false);
      
      const rate = monitor.getSuccessRate();
      expect(rate).toBeCloseTo(0.667, 2);
    });

    it('should return 1 with no requests', () => {
      const rate = monitor.getSuccessRate();
      expect(rate).toBe(1);
    });
  });

  describe('getAvgLatency', () => {
    it('should return average latency', () => {
      monitor.recordRequest(100, true);
      monitor.recordRequest(200, true);
      monitor.recordRequest(300, true);
      
      const avg = monitor.getAvgLatency();
      expect(avg).toBeCloseTo(200, 0);
    });

    it('should return 0 with no requests', () => {
      const avg = monitor.getAvgLatency();
      expect(avg).toBe(0);
    });
  });
});

describe('HealthThresholds', () => {
  it('should use default thresholds', () => {
    const monitor = createSupernodeMonitor('peer_test');
    const metrics = monitor.getMetrics();
    
    expect(metrics).toBeDefined();
  });

  it('should accept custom thresholds', () => {
    const customThresholds: Partial<HealthThresholds> = {
      healthyMinSuccessRate: 0.99,
      maxLatencyMs: 500,
    };
    
    const monitor = createSupernodeMonitor('peer_test', customThresholds);
    const metrics = monitor.getMetrics();
    
    expect(metrics).toBeDefined();
  });
});

describe('SupernodeMonitor - Edge Cases', () => {
  it('should handle rapid requests', () => {
    const monitor = createSupernodeMonitor('peer_test');
    
    for (let i = 0; i < 1000; i++) {
      monitor.recordRequest(Math.random() * 500, Math.random() > 0.1);
    }
    
    const metrics = monitor.getMetrics();
    expect(metrics.totalRequests).toBe(1000);
    expect(metrics.latencyP99).toBeGreaterThan(0);
  });

  it('should handle varying latency patterns', () => {
    const monitor = createSupernodeMonitor('peer_test');
    
    // Low latency requests
    for (let i = 0; i < 50; i++) {
      monitor.recordRequest(50, true);
    }
    
    // High latency requests
    for (let i = 0; i < 10; i++) {
      monitor.recordRequest(1000, true);
    }
    
    const metrics = monitor.getMetrics();
    expect(metrics.latencyP95).toBeGreaterThan(metrics.latencyP50);
  });

  it('should trim old samples', () => {
    const monitor = createSupernodeMonitor('peer_test');
    
    // Record many requests
    for (let i = 0; i < 1000; i++) {
      monitor.recordRequest(100, true);
    }
    
    // Samples should be trimmed
    const metrics = monitor.getMetrics();
    expect(metrics.totalRequests).toBe(1000);
  });
});
