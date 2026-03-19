/**
 * Cold Start Perception Service
 *
 * Unified service that coordinates all cold-start perception features:
 * - Demo Mode (synthetic peers)
 * - Ghost Peers (expired but recent)
 * - Sleeping State (away messages)
 * - Invite Links (shareable URLs)
 * - Chaos Mode (serendipity slider)
 *
 * Provides a single interface for managing network perception during cold start.
 */

import { getDemoModeService, type DemoModeConfig } from './demoMode.js';
import { getGhostPeersService, type GhostPeerConfig } from './ghostPeers.js';
import { getSleepingStateService, type SleepingStateConfig } from './sleepingState.js';
import { getInviteLinksService, type InviteConfig } from './inviteLinks.js';
import { getChaosModeService, type ChaosModeConfig } from './chaosMode.js';
import type { PeerMatch } from '../services/network.js';

export interface ColdStartConfig {
  demoMode: Partial<DemoModeConfig>;
  ghostPeers: Partial<GhostPeerConfig>;
  sleepingState: Partial<SleepingStateConfig>;
  inviteLinks: Partial<InviteConfig>;
  chaosMode: Partial<ChaosModeConfig>;
}

export interface ColdStartStatus {
  demoMode: {
    active: boolean;
    syntheticPeerCount: number;
  };
  ghostPeers: {
    active: boolean;
    ghostCount: number;
  };
  sleepingState: {
    isActive: boolean;
    isAway: boolean;
  };
  inviteLinks: {
    active: boolean;
    pendingJoin: any;
  };
  chaosMode: {
    active: boolean;
    level: number;
  };
  overallPerceptionScore: number; // 0-100, how "populated" the network feels
}

const DEFAULT_CONFIG: ColdStartConfig = {
  demoMode: {
    enabled: true,
    minRealPeers: 3,
    maxSyntheticPeers: 10,
  },
  ghostPeers: {
    enabled: true,
    gracePeriodMs: 4 * 60 * 60 * 1000,
  },
  sleepingState: {
    enabled: true,
    autoAwayMs: 10 * 60 * 1000,
  },
  inviteLinks: {
    enabled: true,
  },
  chaosMode: {
    enabled: false,
    chaosLevel: 0,
  },
};

export class ColdStartService {
  private config: ColdStartConfig;
  private demoMode = getDemoModeService();
  private ghostPeers = getGhostPeersService();
  private sleepingState = getSleepingStateService();
  private inviteLinks = getInviteLinksService();
  private chaosMode = getChaosModeService();
  private realPeerCount = 0;

  constructor(config: Partial<ColdStartConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize all cold start services
   */
  start(): void {
    console.log('[ColdStart] Initializing all perception services...');

    // Start each service with its config
    this.demoMode.configure(this.config.demoMode);
    this.demoMode.start();

    this.ghostPeers.configure(this.config.ghostPeers);
    this.ghostPeers.start();

    this.sleepingState.configure(this.config.sleepingState);
    this.sleepingState.start();

    this.inviteLinks.configure(this.config.inviteLinks);
    this.inviteLinks.start();

    this.chaosMode.configure(this.config.chaosMode);
    this.chaosMode.start();

    // Setup sleeping state network broadcast
    this.sleepingState.setNetworkBroadcast((away, message) => {
      console.log('[ColdStart] Away status broadcast:', away ? message : 'back online');
    });

    console.log('[ColdStart] All services initialized');
  }

  /**
   * Stop all cold start services
   */
  stop(): void {
    this.demoMode.stop();
    this.ghostPeers.stop();
    this.sleepingState.stop();
    // inviteLinks and chaosMode don't have stop methods
  }

  /**
   * Update real peer count (triggers demo mode adjustments)
   */
  setRealPeerCount(count: number): void {
    this.realPeerCount = count;
    this.demoMode.setRealPeerCount(count);
  }

  /**
   * Get combined peer list with all perception enhancements
   */
  getPeers(realPeers: PeerMatch[], userTopics?: string[]): PeerMatch[] {
    let peers = [...realPeers];

    // 1. Add ghost peers
    peers = this.ghostPeers.getPeers(peers);

    // 2. Add synthetic peers (demo mode)
    peers = this.demoMode.getPeers(peers);

    // 3. Apply chaos mode adjustments
    peers = this.chaosMode.applyChaos(peers, userTopics);

    return peers;
  }

  /**
   * Track peer going offline (for ghost peers)
   */
  trackPeerOffline(peer: PeerMatch): void {
    this.ghostPeers.trackPeer(peer);
  }

  /**
   * Track peer coming back online
   */
  trackPeerOnline(peerId: string): void {
    this.ghostPeers.restorePeer(peerId);
  }

  /**
   * Record user activity (for sleeping state)
   */
  recordActivity(): void {
    this.sleepingState.recordActivity();
  }

  /**
   * Set away status
   */
  setAway(message?: string): void {
    this.sleepingState.setAway(message);
  }

  /**
   * Clear away status
   */
  clearAway(): void {
    this.sleepingState.clearAway();
  }

  /**
   * Create invite link
   */
  createInvite(peerId: string, name?: string, description?: string) {
    return this.inviteLinks.createPeerInvite(peerId, name, description);
  }

  /**
   * Get pending invite from URL
   */
  getPendingInvite() {
    return this.inviteLinks.getPendingJoin();
  }

  /**
   * Clear pending invite
   */
  clearPendingInvite() {
    this.inviteLinks.clearPendingJoin();
  }

  /**
   * Set chaos level
   */
  setChaosLevel(level: number): void {
    this.chaosMode.setChaosLevel(level);
  }

  /**
   * Get comprehensive status
   */
  getStatus(): ColdStartStatus {
    const demoStatus = this.demoMode.getStatus();
    const ghostStatus = this.ghostPeers.getStatus();
    const sleepStatus = this.sleepingState.getStatus();
    const inviteStatus = this.inviteLinks.getStatus();
    const chaosStatus = this.chaosMode.getState();

    // Calculate overall perception score
    const perceptionScore = this.calculatePerceptionScore(demoStatus, ghostStatus);

    return {
      demoMode: {
        active: demoStatus.isActive,
        syntheticPeerCount: demoStatus.syntheticPeerCount,
      },
      ghostPeers: {
        active: ghostStatus.ghostCount > 0,
        ghostCount: ghostStatus.ghostCount,
      },
      sleepingState: {
        isActive: sleepStatus.isActive,
        isAway: sleepStatus.isActive && this.sleepingState.getAwayMessage() !== null,
      },
      inviteLinks: {
        active: inviteStatus.enabled,
        pendingJoin: inviteStatus.pendingJoin,
      },
      chaosMode: {
        active: chaosStatus.isActive,
        level: chaosStatus.chaosLevel,
      },
      overallPerceptionScore: perceptionScore,
    };
  }

  /**
   * Get individual service instances for advanced usage
   */
  getServices() {
    return {
      demoMode: this.demoMode,
      ghostPeers: this.ghostPeers,
      sleepingState: this.sleepingState,
      inviteLinks: this.inviteLinks,
      chaosMode: this.chaosMode,
    };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ColdStartConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.demoMode) this.demoMode.configure(config.demoMode);
    if (config.ghostPeers) this.ghostPeers.configure(config.ghostPeers);
    if (config.sleepingState) this.sleepingState.configure(config.sleepingState);
    if (config.inviteLinks) this.inviteLinks.configure(config.inviteLinks);
    if (config.chaosMode) this.chaosMode.configure(config.chaosMode);

    console.log('[ColdStart] Configuration updated:', this.config);
  }

  /**
   * Calculate overall perception score (0-100)
   */
  private calculatePerceptionScore(
    demoStatus: any,
    ghostStatus: any
  ): number {
    const totalPeers = this.realPeerCount + demoStatus.syntheticPeerCount + ghostStatus.ghostCount;
    
    // Base score from peer count (max 50 points)
    const peerScore = Math.min(50, (totalPeers / 10) * 50);

    // Demo mode activity (max 20 points)
    const demoScore = demoStatus.isActive ? 20 : 0;

    // Ghost peers provide continuity (max 15 points)
    const ghostScore = Math.min(15, (ghostStatus.ghostCount / 5) * 15);

    // Chaos mode adds variety (max 15 points)
    const chaosLevel = this.chaosMode.getState().chaosLevel;
    const chaosScore = (chaosLevel / 100) * 15;

    return Math.round(peerScore + demoScore + ghostScore + chaosScore);
  }
}

// Singleton instance
let _instance: ColdStartService | null = null;

export function getColdStartService(config?: Partial<ColdStartConfig>): ColdStartService {
  if (!_instance) {
    _instance = new ColdStartService(config);
  }
  return _instance;
}
