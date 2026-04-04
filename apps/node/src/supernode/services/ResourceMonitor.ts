/* eslint-disable */
/**
 * Resource Monitor Service
 */

import type { ResourceUsage } from '../types/health.js';

export class ResourceMonitor {
  private activeConnections = 0;

  getConnectionCount(): number {
    return this.activeConnections;
  }

  setConnectionCount(count: number): void {
    this.activeConnections = count;
  }

  incrementConnections(): void {
    this.activeConnections++;
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  getUsage(): ResourceUsage {
    if (typeof process === 'undefined') {
      return {
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
        activeConnections: this.activeConnections,
      };
    }

    const memUsage = process.memoryUsage();
    const memoryMB = memUsage.heapUsed / (1024 * 1024);

    return {
      memoryUsageMB: memoryMB,
      cpuUsagePercent: 0,
      activeConnections: this.activeConnections,
    };
  }
}
