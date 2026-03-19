/**
 * Ghost Peers Service
 *
 * Shows expired-but-recent peers (within 4 hours) as dimmed.
 */

import type { PeerMatch } from '../services/network.js';

export interface GhostPeer extends PeerMatch {
  isGhost: true;
  expiredAt: number;
  lastSeen: number;
  wasOnline: boolean;
  ghostOpacity: number;
}

export interface GhostPeerConfig {
  enabled: boolean;
  gracePeriodMs: number;
  maxGhostPeers: number;
  opacityDecayMs: number;
}

const DEFAULT_CONFIG: GhostPeerConfig = {
  enabled: true,
  gracePeriodMs: 4 * 60 * 60 * 1000,
  maxGhostPeers: 20,
  opacityDecayMs: 2 * 60 * 60 * 1000,
};

export class GhostPeersService {
  private config: GhostPeerConfig;
  private ghostPeers = new Map<string, GhostPeer>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(ghosts: GhostPeer[]) => void> = new Set();

  constructor(config: Partial<GhostPeerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (!this.config.enabled) return;
    console.log('[GhostPeers] Starting with config:', this.config);
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredGhosts();
      this.updateGhostOpacities();
    }, 60000);
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.ghostPeers.clear();
    this.emitUpdate();
  }

  trackPeer(peer: PeerMatch): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    const ghost: GhostPeer = {
      ...peer,
      isGhost: true,
      expiredAt: now + this.config.gracePeriodMs,
      lastSeen: now,
      wasOnline: peer.online ?? true,
      ghostOpacity: 0.7,
      online: false,
    };

    if (this.ghostPeers.size >= this.config.maxGhostPeers) {
      const oldest = Array.from(this.ghostPeers.entries())
        .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
      if (oldest) this.ghostPeers.delete(oldest[0]);
    }

    this.ghostPeers.set(peer.peerId, ghost);
    this.emitUpdate();
  }

  restorePeer(peerId: string): void {
    if (this.ghostPeers.delete(peerId)) {
      this.emitUpdate();
    }
  }

  getPeers(activePeers: PeerMatch[]): PeerMatch[] {
    if (!this.config.enabled) return activePeers;
    const ghosts = Array.from(this.ghostPeers.values());
    return [...activePeers, ...ghosts];
  }

  getGhosts(): GhostPeer[] {
    return Array.from(this.ghostPeers.values());
  }

  isGhost(peerId: string): boolean {
    return this.ghostPeers.has(peerId);
  }

  getTimeSinceLastSeen(peerId: string): number | null {
    const ghost = this.ghostPeers.get(peerId);
    if (!ghost) return null;
    return Date.now() - ghost.lastSeen;
  }

  onUpdate(callback: (ghosts: GhostPeer[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private cleanupExpiredGhosts(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, ghost] of this.ghostPeers.entries()) {
      if (ghost.expiredAt < now) {
        this.ghostPeers.delete(id);
        changed = true;
      }
    }
    if (changed) this.emitUpdate();
  }

  private updateGhostOpacities(): void {
    const now = Date.now();
    let changed = false;

    for (const [, ghost] of this.ghostPeers.entries()) {
      const timeSinceExpiry = now - (ghost.expiredAt - this.config.gracePeriodMs);
      const progress = Math.min(1, timeSinceExpiry / this.config.opacityDecayMs);
      const newOpacity = 0.7 - (progress * 0.4);

      if (Math.abs(newOpacity - ghost.ghostOpacity) > 0.01) {
        ghost.ghostOpacity = Math.max(0.3, newOpacity);
        changed = true;
      }
    }

    if (changed) this.emitUpdate();
  }

  private emitUpdate(): void {
    const ghosts = Array.from(this.ghostPeers.values());
    this.listeners.forEach(listener => listener(ghosts));
  }

  getStatus(): { enabled: boolean; ghostCount: number; oldestGhost: number | null } {
    const ghosts = Array.from(this.ghostPeers.values());
    const oldestGhost = ghosts.length > 0
      ? Math.max(...ghosts.map(g => Date.now() - g.lastSeen)) / 60000
      : null;
    return { enabled: this.config.enabled, ghostCount: ghosts.length, oldestGhost };
  }

  configure(updates: Partial<GhostPeerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  clear(): void {
    this.ghostPeers.clear();
    this.emitUpdate();
  }
}

let _instance: GhostPeersService | null = null;

export function getGhostPeersService(config?: Partial<GhostPeerConfig>): GhostPeersService {
  if (!_instance) _instance = new GhostPeersService(config);
  return _instance;
}
