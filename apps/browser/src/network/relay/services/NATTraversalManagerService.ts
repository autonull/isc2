/**
 * NAT Traversal Manager Service
 *
 * Main service coordinating NAT traversal, relay selection, and connection quality.
 */

import type { NATTraversalConfig, RelayCandidate, ConnectionQuality, TURNConfig } from '../types/relay.js';
import { RELAY_CONFIG } from '../config/relayConfig.js';
import { RelayPoolManager } from './RelayPoolManager.js';
import { ConnectionQualityTracker } from './ConnectionQualityTracker.js';
import { ICEServerManager } from './ICEServerManager.js';

export class NATTraversalManagerService {
  private config: NATTraversalConfig;
  private relayPool: RelayPoolManager;
  private qualityTracker: ConnectionQualityTracker;
  private iceServerManager: ICEServerManager;
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<NATTraversalConfig> = {}) {
    this.config = { ...RELAY_CONFIG, ...config };
    this.relayPool = new RelayPoolManager();
    this.qualityTracker = new ConnectionQualityTracker();
    this.iceServerManager = new ICEServerManager(
      config.turnServers,
      config.stunServers
    );
  }

  /**
   * Start NAT traversal manager
   */
  start(): void {
    this.refreshRelayPool();
    this.refreshTimer = setInterval(
      () => this.refreshRelayPool(),
      this.config.relayRefreshInterval
    );
  }

  /**
   * Stop NAT traversal manager
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Add relay to pool
   */
  addRelay(relay: RelayCandidate): void {
    this.relayPool.addRelay(relay, this.config.maxRelayPoolSize);
  }

  /**
   * Remove relay from pool
   */
  removeRelay(peerID: string): void {
    this.relayPool.removeRelay(peerID);
  }

  /**
   * Update relay statistics
   */
  updateRelayStats(peerID: string, success: boolean, latency?: number): void {
    this.relayPool.updateRelayStats(peerID, success, latency);
  }

  /**
   * Get best relay
   */
  getBestRelay(): RelayCandidate | undefined {
    return this.relayPool.getBestRelay();
  }

  /**
   * Get top N relays
   */
  getTopRelays(n: number): RelayCandidate[] {
    return this.relayPool.getTopRelays(n);
  }

  /**
   * Record connection quality
   */
  recordConnectionQuality(quality: ConnectionQuality): void {
    this.qualityTracker.record(quality);
  }

  /**
   * Get connection quality
   */
  getConnectionQuality(peerID: string): ConnectionQuality | undefined {
    return this.qualityTracker.get(peerID);
  }

  /**
   * Check if connection is acceptable
   */
  isConnectionAcceptable(peerID: string): boolean {
    return this.qualityTracker.isAcceptable(peerID, this.config.minQualityScore);
  }

  /**
   * Check if connection is degraded
   */
  isConnectionDegraded(peerID: string): boolean {
    return this.qualityTracker.isDegraded(peerID, this.config.degradedQualityScore);
  }

  /**
   * Get ICE servers
   */
  getICEServers(): RTCIceServer[] {
    return this.iceServerManager.getICEServers();
  }

  /**
   * Add TURN server
   */
  addTurnServer(turn: TURNConfig): void {
    this.iceServerManager.addTurnServer(turn);
  }

  /**
   * Mark connection as active
   */
  markConnectionActive(peerID: string): void {
    this.qualityTracker.markActive(peerID);
  }

  /**
   * Mark connection as inactive
   */
  markConnectionInactive(peerID: string): void {
    this.qualityTracker.markInactive(peerID);
  }

  /**
   * Get active connection count
   */
  getActiveConnectionCount(): number {
    return this.qualityTracker.getActiveCount();
  }

  /**
   * Get relay pool statistics
   */
  getRelayPoolStats() {
    return this.relayPool.getStats();
  }

  /**
   * Get connection quality statistics
   */
  getConnectionQualityStats() {
    return this.qualityTracker.getStats();
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.relayPool.clear();
    this.qualityTracker.clear();
    this.iceServerManager.clear();
  }

  /**
   * Refresh relay pool
   */
  private refreshRelayPool(): void {
    this.relayPool.refreshPool(this.config.minRelays);
  }
}
