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
  demoMode: { active: boolean; syntheticPeerCount: number };
  ghostPeers: { active: boolean; ghostCount: number };
  sleepingState: { isActive: boolean; isAway: boolean };
  inviteLinks: { active: boolean; pendingJoin: any };
  chaosMode: { active: boolean; level: number };
  overallPerceptionScore: number;
}

const DEFAULT_CONFIG: ColdStartConfig = {
  demoMode: { enabled: true, minRealPeers: 3, maxSyntheticPeers: 10 },
  ghostPeers: { enabled: true, gracePeriodMs: 4 * 60 * 60 * 1000 },
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
    console.log('[ColdStart] Initializing all perception services...');

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

    this.sleepingState.setNetworkBroadcast((away, message) => {
      console.log('[ColdStart] Away status broadcast:', away ? message : 'back online');
    });

    console.log('[ColdStart] All services initialized');
  }

  stop(): void {
    this.demoMode.stop();
    this.ghostPeers.stop();
    this.sleepingState.stop();
  }

  setRealPeerCount(count: number): void {
    this.realPeerCount = count;
    this.demoMode.setRealPeerCount(count);
  }

  getPeers(realPeers: PeerMatch[], userTopics?: string[]): PeerMatch[] {
    let peers = [...realPeers];
    peers = this.ghostPeers.getPeers(peers);
    peers = this.demoMode.getPeers(peers);
    peers = this.chaosMode.applyChaos(peers, userTopics);
    return peers;
  }

  trackPeerOffline(peer: PeerMatch): void {
    this.ghostPeers.trackPeer(peer);
  }

  trackPeerOnline(peerId: string): void {
    this.ghostPeers.restorePeer(peerId);
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
    const demoStatus = this.demoMode.getStatus();
    const ghostStatus = this.ghostPeers.getStatus();
    const sleepStatus = this.sleepingState.getStatus();
    const inviteStatus = this.inviteLinks.getStatus();
    const chaosStatus = this.chaosMode.getState();

    const perceptionScore = this.calculatePerceptionScore(demoStatus, ghostStatus);

    return {
      demoMode: { active: demoStatus.isActive, syntheticPeerCount: demoStatus.syntheticPeerCount },
      ghostPeers: { active: ghostStatus.ghostCount > 0, ghostCount: ghostStatus.ghostCount },
      sleepingState: { isActive: sleepStatus.isActive, isAway: sleepStatus.isActive && this.sleepingState.getAwayMessage() !== null },
      inviteLinks: { active: inviteStatus.enabled, pendingJoin: inviteStatus.pendingJoin },
      chaosMode: { active: chaosStatus.isActive, level: chaosStatus.chaosLevel },
      overallPerceptionScore: perceptionScore,
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

  private calculatePerceptionScore(demoStatus: any, ghostStatus: any): number {
    const totalPeers = this.realPeerCount + demoStatus.syntheticPeerCount + ghostStatus.ghostCount;
    const peerScore = Math.min(50, (totalPeers / 10) * 50);
    const demoScore = demoStatus.isActive ? 20 : 0;
    const ghostScore = Math.min(15, (ghostStatus.ghostCount / 5) * 15);
    const chaosLevel = this.chaosMode.getState().chaosLevel;
    const chaosScore = (chaosLevel / 100) * 15;
    return Math.round(peerScore + demoScore + ghostScore + chaosScore);
  }
}

let _instance: ColdStartService | null = null;

export function getColdStartService(config?: Partial<ColdStartConfig>): ColdStartService {
  if (!_instance) _instance = new ColdStartService(config);
  return _instance;
}
