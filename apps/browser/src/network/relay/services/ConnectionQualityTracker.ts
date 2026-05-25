/* eslint-disable */
/**
 * Connection Quality Tracker Service
 *
 * Tracks and manages connection quality metrics.
 */

import type { ConnectionQuality, ConnectionQualityStats } from '../types/relay.ts';
import { RELAY_CONFIG, RELAY_CONSTANTS } from '../config/relayConfig.ts';
import { smoothValue, isAcceptable, isDegraded } from '../utils/qualityCalculator.ts';

export class ConnectionQualityTracker {
  private connectionQualities: Map<string, ConnectionQuality> = new Map();
  private activeConnections: Set<string> = new Set();

  /**
   * Record connection quality update
   */
  record(quality: ConnectionQuality): void {
    const existing = this.connectionQualities.get(quality.peerID);

    if (existing) {
      existing.score = smoothValue(existing.score, quality.score, RELAY_CONSTANTS.CONNECTION_SMOOTHING);
      existing.latency = smoothValue(existing.latency, quality.latency, RELAY_CONSTANTS.CONNECTION_SMOOTHING);
      existing.packetLoss = smoothValue(existing.packetLoss, quality.packetLoss, RELAY_CONSTANTS.CONNECTION_SMOOTHING);
      existing.jitter = smoothValue(existing.jitter, quality.jitter, RELAY_CONSTANTS.CONNECTION_SMOOTHING);
      existing.bandwidth = smoothValue(existing.bandwidth, quality.bandwidth, RELAY_CONSTANTS.CONNECTION_SMOOTHING);
      existing.stability = smoothValue(existing.stability, quality.stability, RELAY_CONSTANTS.SMOOTHING_FACTOR);
      existing.lastUpdated = Date.now();
    } else {
      this.connectionQualities.set(quality.peerID, {
        ...quality,
        stability: quality.score,
      });
    }
  }

  /**
   * Get connection quality for a peer
   */
  get(peerID: string): ConnectionQuality | undefined {
    return this.connectionQualities.get(peerID);
  }

  /**
   * Check if connection is acceptable
   */
  isAcceptable(peerID: string, threshold: number = RELAY_CONFIG.minQualityScore): boolean {
    const quality = this.connectionQualities.get(peerID);
    return !quality || isAcceptable(quality.score, threshold);
  }

  /**
   * Check if connection is degraded
   */
  isDegraded(peerID: string, threshold: number = RELAY_CONFIG.degradedQualityScore): boolean {
    const quality = this.connectionQualities.get(peerID);
    return quality ? isDegraded(quality.score, threshold) : false;
  }

  /**
   * Mark connection as active
   */
  markActive(peerID: string): void {
    this.activeConnections.add(peerID);
  }

  /**
   * Mark connection as inactive
   */
  markInactive(peerID: string): void {
    this.activeConnections.delete(peerID);
  }

  /**
   * Get active connection count
   */
  getActiveCount(): number {
    return this.activeConnections.size;
  }

  /**
   * Get connection quality statistics
   */
  getStats(): ConnectionQualityStats {
    const qualities = Array.from(this.connectionQualities.values());
    if (qualities.length === 0) {
      return {
        totalConnections: 0,
        activeConnections: this.activeConnections.size,
        avgScore: 0,
        avgLatency: 0,
        avgPacketLoss: 0,
        acceptableConnections: 0,
        degradedConnections: 0,
      };
    }

    return {
      totalConnections: qualities.length,
      activeConnections: this.activeConnections.size,
      avgScore: qualities.reduce((sum, q) => sum + q.score, 0) / qualities.length,
      avgLatency: qualities.reduce((sum, q) => sum + q.latency, 0) / qualities.length,
      avgPacketLoss: qualities.reduce((sum, q) => sum + q.packetLoss, 0) / qualities.length,
      acceptableConnections: qualities.filter((q) =>
        isAcceptable(q.score, RELAY_CONFIG.minQualityScore)
      ).length,
      degradedConnections: qualities.filter((q) =>
        isDegraded(q.score, RELAY_CONFIG.degradedQualityScore)
      ).length,
    };
  }

  /**
   * Clear all tracked qualities
   */
  clear(): void {
    this.connectionQualities.clear();
    this.activeConnections.clear();
  }
}
