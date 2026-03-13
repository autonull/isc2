/**
 * Relay Pool Manager Service
 *
 * Manages relay pool lifecycle, selection, and statistics.
 */

import type { RelayCandidate, RelayPoolStats } from '../types/relay.js';
import { RELAY_CONFIG, RELAY_CONSTANTS } from '../config/relayConfig.js';
import { calculateRelayQualityScore } from '../utils/qualityCalculator.js';
import { QualityBasedRelayStrategy } from '../strategies/QualityBasedRelayStrategy.js';

export class RelayPoolManager {
  private relayPool: Map<string, RelayCandidate> = new Map();
  private strategy: QualityBasedRelayStrategy;
  private preferredRelay?: RelayCandidate;

  constructor() {
    this.strategy = new QualityBasedRelayStrategy();
  }

  /**
   * Add relay to pool
   */
  addRelay(relay: RelayCandidate, maxPoolSize: number = RELAY_CONFIG.maxRelayPoolSize): boolean {
    if (this.relayPool.size >= maxPoolSize) {
      const lowest = this.getLowestQualityRelay();
      if (lowest && lowest.qualityScore < relay.qualityScore) {
        this.relayPool.delete(lowest.peerID);
      } else {
        return false;
      }
    }

    this.relayPool.set(relay.peerID, relay);
    this.updatePreferredRelay();
    return true;
  }

  /**
   * Remove relay from pool
   */
  removeRelay(peerID: string): void {
    this.relayPool.delete(peerID);
    if (this.preferredRelay?.peerID === peerID) {
      this.updatePreferredRelay();
    }
  }

  /**
   * Update relay statistics
   */
  updateRelayStats(peerID: string, success: boolean, latency?: number): void {
    const relay = this.relayPool.get(peerID);
    if (!relay) return;

    relay.usageCount++;
    relay.lastUsed = Date.now();

    if (latency !== undefined) {
      relay.latency = RELAY_CONSTANTS.SMOOTHING_FACTOR * latency + (1 - RELAY_CONSTANTS.SMOOTHING_FACTOR) * relay.latency;
    }

    const targetSuccess = success ? 1 : 0;
    relay.successRate = RELAY_CONSTANTS.SMOOTHING_FACTOR * targetSuccess + (1 - RELAY_CONSTANTS.SMOOTHING_FACTOR) * relay.successRate;
    relay.qualityScore = calculateRelayQualityScore(
      relay.latency,
      relay.successRate,
      relay.usageCount,
      {
        latency: RELAY_CONFIG.latencyWeight,
        successRate: RELAY_CONFIG.successRateWeight,
        stability: RELAY_CONFIG.stabilityWeight,
      }
    );

    this.relayPool.set(peerID, relay);
    this.updatePreferredRelay();
  }

  /**
   * Get best relay
   */
  getBestRelay(): RelayCandidate | undefined {
    this.updatePreferredRelay();
    return this.preferredRelay;
  }

  /**
   * Get top N relays
   */
  getTopRelays(n: number): RelayCandidate[] {
    return this.strategy.rank(Array.from(this.relayPool.values())).slice(0, n);
  }

  /**
   * Get all relays
   */
  getAllRelays(): RelayCandidate[] {
    return Array.from(this.relayPool.values());
  }

  /**
   * Get pool size
   */
  getPoolSize(): number {
    return this.relayPool.size;
  }

  /**
   * Refresh pool (remove stale relays)
   */
  refreshPool(minRelays: number = RELAY_CONFIG.minRelays): void {
    const now = Date.now();
    const oneHourAgo = now - RELAY_CONSTANTS.ONE_HOUR_MS;

    for (const [peerID, relay] of this.relayPool.entries()) {
      if (relay.usageCount === 0 && relay.lastUsed && relay.lastUsed < oneHourAgo) {
        this.relayPool.delete(peerID);
      }
    }

    if (this.relayPool.size < minRelays) {
      console.log(`Relay pool below minimum: ${this.relayPool.size}/${minRelays}`);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): RelayPoolStats {
    const relays = this.getAllRelays();
    if (relays.length === 0) {
      return {
        totalRelays: 0,
        circuitRelays: 0,
        turnRelays: 0,
        stunRelays: 0,
        avgQualityScore: 0,
        avgLatency: 0,
        avgSuccessRate: 0,
      };
    }

    return {
      totalRelays: relays.length,
      circuitRelays: relays.filter((r) => r.type === 'circuit').length,
      turnRelays: relays.filter((r) => r.type === 'turn').length,
      stunRelays: relays.filter((r) => r.type === 'stun').length,
      avgQualityScore: relays.reduce((sum, r) => sum + r.qualityScore, 0) / relays.length,
      avgLatency: relays.reduce((sum, r) => sum + r.latency, 0) / relays.length,
      avgSuccessRate: relays.reduce((sum, r) => sum + r.successRate, 0) / relays.length,
    };
  }

  /**
   * Clear pool
   */
  clear(): void {
    this.relayPool.clear();
    this.preferredRelay = undefined;
  }

  /**
   * Get lowest quality relay
   */
  private getLowestQualityRelay(): RelayCandidate | undefined {
    let lowest: RelayCandidate | undefined;
    for (const relay of this.relayPool.values()) {
      if (!lowest || relay.qualityScore < lowest.qualityScore) {
        lowest = relay;
      }
    }
    return lowest;
  }

  /**
   * Update preferred relay selection
   */
  private updatePreferredRelay(): void {
    const candidates = this.getTopRelays(3);
    if (candidates.length === 0) {
      this.preferredRelay = undefined;
      return;
    }

    const selected = this.strategy.select(candidates);
    this.preferredRelay = selected;
  }
}
