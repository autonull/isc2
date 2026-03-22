/**
 * Cold Start Perception Service
 *
 * Unified service coordinating all cold-start perception features.
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
  sleepingState: { isActive: boolean; isAway: boolean };
  inviteLinks: { active: boolean; pendingJoin: any };
  chaosMode: { active: boolean; level: number };
}

const DEFAULT_CONFIG: ColdStartConfig = {
  demoMode: { enabled: false, minRealPeers: 3, maxSyntheticPeers: 10 },
  ghostPeers: { enabled: false, gracePeriodMs: 4 * 60 * 60 * 1000 },
  sleepingState: { enabled: true, autoAwayMs: 10 * 60 * 1000 },
  inviteLinks: { enabled: true },
  chaosMode: { enabled: false, chaosLevel: 0 },
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

  start(): void {
    console.log('[ColdStart] Initializing perception services...');

    this.sleepingState.configure(this.config.sleepingState);
    this.sleepingState.start();

    this.inviteLinks.configure(this.config.inviteLinks);
    this.inviteLinks.start();

    this.chaosMode.configure(this.config.chaosMode);
    this.chaosMode.start();

    this.sleepingState.setNetworkBroadcast((away, message) => {
      console.log('[ColdStart] Away status broadcast:', away ? message : 'back online');
    });

    console.log('[ColdStart] Services initialized');
  }

  stop(): void {
    this.sleepingState.stop();
  }

  setRealPeerCount(count: number): void {
    this.realPeerCount = count;
  }

  getPeers(realPeers: PeerMatch[], userTopics?: string[]): PeerMatch[] {
    let peers = [...realPeers];
    peers = this.chaosMode.applyChaos(peers, userTopics);
    return peers;
  }


  recordActivity(): void {
    this.sleepingState.recordActivity();
  }

  setAway(message?: string): void {
    this.sleepingState.setAway(message);
  }

  clearAway(): void {
    this.sleepingState.clearAway();
  }

  createInvite(peerId: string, name?: string, description?: string) {
    return this.inviteLinks.createPeerInvite(peerId, name, description);
  }

  getPendingInvite() {
    return this.inviteLinks.getPendingJoin();
  }

  clearPendingInvite() {
    this.inviteLinks.clearPendingJoin();
  }

  setChaosLevel(level: number): void {
    this.chaosMode.setChaosLevel(level);
  }

  getStatus(): ColdStartStatus {
    const sleepStatus = this.sleepingState.getStatus();
    const inviteStatus = this.inviteLinks.getStatus();
    const chaosStatus = this.chaosMode.getState();

    return {
      sleepingState: { isActive: sleepStatus.isActive, isAway: sleepStatus.isActive && this.sleepingState.getAwayMessage() !== null },
      inviteLinks: { active: inviteStatus.enabled, pendingJoin: inviteStatus.pendingJoin },
      chaosMode: { active: chaosStatus.isActive, level: chaosStatus.chaosLevel },
    };
  }

  getServices() {
    return {
      demoMode: this.demoMode,
      ghostPeers: this.ghostPeers,
      sleepingState: this.sleepingState,
      inviteLinks: this.inviteLinks,
      chaosMode: this.chaosMode,
    };
  }

  configure(config: Partial<ColdStartConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.demoMode) this.demoMode.configure(config.demoMode);
    if (config.ghostPeers) this.ghostPeers.configure(config.ghostPeers);
    if (config.sleepingState) this.sleepingState.configure(config.sleepingState);
    if (config.inviteLinks) this.inviteLinks.configure(config.inviteLinks);
    if (config.chaosMode) this.chaosMode.configure(config.chaosMode);
  }

}

let _instance: ColdStartService | null = null;

export function getColdStartService(config?: Partial<ColdStartConfig>): ColdStartService {
  if (!_instance) _instance = new ColdStartService(config);
  return _instance;
}
