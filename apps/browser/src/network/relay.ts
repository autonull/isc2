/**
 * NAT Traversal & Relay Management
 *
 * Manages relay selection, connection quality tracking, and ICE server configuration.
 *
 * Facade module re-exporting relay functionality.
 */

export type {
  RelayCandidate,
  TURNConfig,
  STUNConfig,
  ConnectionQuality,
  NATTraversalConfig,
  RelayPoolStats,
  ConnectionQualityStats,
  RelayType,
} from './relay/types/relay.js';

export {
  RELAY_CONFIG,
  QUALITY_WEIGHTS,
  RELAY_SCORE_WEIGHTS,
  RELAY_CONSTANTS,
  DEFAULT_TURN_SERVERS,
  DEFAULT_STUN_SERVERS,
} from './relay/config/relayConfig.js';

export type { RelaySelectionStrategy } from './relay/strategies/RelaySelectionStrategy.js';
export { QualityBasedRelayStrategy } from './relay/strategies/QualityBasedRelayStrategy.js';

export { RelayPoolManager } from './relay/services/RelayPoolManager.js';
export { ConnectionQualityTracker } from './relay/services/ConnectionQualityTracker.js';
export { ICEServerManager } from './relay/services/ICEServerManager.js';
export { NATTraversalManagerService } from './relay/services/NATTraversalManagerService.js';

export {
  calculateConnectionQuality,
  calculateRelayQualityScore,
  smoothValue,
  isAcceptable,
  isDegraded,
} from './relay/utils/qualityCalculator.js';

// Re-export for backward compatibility
import type {
  RelayCandidate,
  NATTraversalConfig,
  ConnectionQuality,
  RelayPoolStats,
  ConnectionQualityStats,
  TURNConfig,
} from './relay/types/relay.js';
import { RELAY_CONFIG } from './relay/config/relayConfig.js';
import { NATTraversalManagerService } from './relay/services/NATTraversalManagerService.js';
import { calculateConnectionQuality as calcConnectionQuality } from './relay/utils/qualityCalculator.js';

export class NATTraversalManager {
  private service: NATTraversalManagerService;

  constructor(config: Partial<NATTraversalConfig> = {}) {
    this.service = new NATTraversalManagerService(config);
  }

  start(): void {
    this.service.start();
  }

  stop(): void {
    this.service.stop();
  }

  addRelay(relay: RelayCandidate): void {
    this.service.addRelay(relay);
  }

  removeRelay(peerID: string): void {
    this.service.removeRelay(peerID);
  }

  updateRelayStats(peerID: string, success: boolean, latency?: number): void {
    this.service.updateRelayStats(peerID, success, latency);
  }

  getBestRelay(): RelayCandidate | undefined {
    return this.service.getBestRelay();
  }

  getTopRelays(n: number): RelayCandidate[] {
    return this.service.getTopRelays(n);
  }

  recordConnectionQuality(quality: ConnectionQuality): void {
    this.service.recordConnectionQuality(quality);
  }

  getConnectionQuality(peerID: string): ConnectionQuality | undefined {
    return this.service.getConnectionQuality(peerID);
  }

  isConnectionAcceptable(peerID: string): boolean {
    return this.service.isConnectionAcceptable(peerID);
  }

  isConnectionDegraded(peerID: string): boolean {
    return this.service.isConnectionDegraded(peerID);
  }

  getICEServers(): RTCIceServer[] {
    return this.service.getICEServers();
  }

  addTurnServer(turn: TURNConfig): void {
    this.service.addTurnServer(turn);
  }

  markConnectionActive(peerID: string): void {
    this.service.markConnectionActive(peerID);
  }

  markConnectionInactive(peerID: string): void {
    this.service.markConnectionInactive(peerID);
  }

  getActiveConnectionCount(): number {
    return this.service.getActiveConnectionCount();
  }

  getRelayPoolStats(): RelayPoolStats {
    return this.service.getRelayPoolStats();
  }

  getConnectionQualityStats(): ConnectionQualityStats {
    return this.service.getConnectionQualityStats();
  }

  clear(): void {
    this.service.clear();
  }
}

export function createNATTraversalManager(config?: Partial<NATTraversalConfig>): NATTraversalManager {
  return new NATTraversalManager(config);
}
