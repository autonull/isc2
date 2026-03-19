/**
 * Ghost Peers Service
 *
 * Shows expired-but-recent peers (within 4 hours) as dimmed/ghosted.
 * Helps maintain network perception during temporary disconnections.
 *
 * Features:
 * - Tracks peer expiration times
 * - Shows ghost peers with visual distinction
 * - Configurable grace period
 * - Auto-cleanup of old ghosts
 */

import type { PeerMatch } from '../services/network.js';

export interface GhostPeer extends PeerMatch {
  isGhost: true;
  expiredAt: number;
  lastSeen: number;
  wasOnline: boolean;
  ghostOpacity: number; // 0.3 - 0.7 based on time since expiration
}

export interface GhostPeerConfig {
  enabled: boolean;
  gracePeriodMs: number; // How long to show ghost peers (default: 4 hours)
  maxGhostPeers: number;
  opacityDecayMs: number; // Time for opacity to decay from 0.7 to 0.3
}

const DEFAULT_CONFIG: GhostPeerConfig = {
  enabled: true,
  gracePeriodMs: 4 * 60 * 60 * 1000, // 4 hours
  maxGhostPeers: 20,
  opacityDecayMs: 2 * 60 * 60 * 1000, // 2 hours for full decay
};

export class GhostPeersService {
  private config: GhostPeerConfig;
  private ghostPeers = new Map<string, GhostPeer>();
  private peerHistory = new Map<string, { peer: PeerMatch; lastSeen: number; wasOnline: boolean }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(ghosts: GhostPeer[]) => void> = new Set();

  constructor(config: Partial<GhostPeerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start ghost peer tracking
   */
  start(): void {
    if (!this.config.enabled) return;

    console.log('[GhostPeers] Starting with config:', this.config);

    // Periodic cleanup
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredGhosts();
      this.updateGhostOpacities();
    }, 60000); // Every minute
  }

  /**
   * Stop ghost peer tracking
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.ghostPeers.clear();
    this.emitUpdate();
  }

  /**
   * Track a peer that's going offline
   */
  trackPeer(peer: PeerMatch): void {
    if (!this.config.enabled) return;

    const now = Date.now();
    
    // Store in history
    this.peerHistory.set(peer.peerId, {
      peer,
      lastSeen: now,
      wasOnline: peer.online ?? true,
    });

    // Create ghost peer
    const ghost: GhostPeer = {
      ...peer,
      isGhost: true,
      expiredAt: now + this.config.gracePeriodMs,
      lastSeen: now,
      wasOnline: peer.online ?? true,
      ghostOpacity: 0.7,
      online: false,
    };

    // Limit ghost peers
    if (this.ghostPeers.size >= this.config.maxGhostPeers) {
      // Remove oldest ghost
      const oldest = Array.from(this.ghostPeers.entries())
        .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
      if (oldest) {
        this.ghostPeers.delete(oldest[0]);
      }
    }

    this.ghostPeers.set(peer.peerId, ghost);
    console.log('[GhostPeers] Tracking ghost:', peer.peerId);
    
    this.emitUpdate();
  }

  /**
   * Remove ghost when peer comes back online
   */
  restorePeer(peerId: string): void {
    const ghost = this.ghostPeers.get(peerId);
    if (ghost) {
      this.ghostPeers.delete(peerId);
      console.log('[GhostPeers] Restored peer:', peerId);
      this.emitUpdate();
    }
  }

  /**
   * Get combined peers (active + ghosts)
   */
  getPeers(activePeers: PeerMatch[]): PeerMatch[] {
    if (!this.config.enabled) return activePeers;

    const ghosts = Array.from(this.ghostPeers.values());
    return [...activePeers, ...ghosts];
  }

  /**
   * Get only ghost peers
   */
  getGhosts(): GhostPeer[] {
    return Array.from(this.ghostPeers.values());
  }

  /**
   * Check if a peer is a ghost
   */
  isGhost(peerId: string): boolean {
    return this.ghostPeers.has(peerId);
  }

  /**
   * Get time since peer was last seen
   */
  getTimeSinceLastSeen(peerId: string): number | null {
    const ghost = this.ghostPeers.get(peerId);
    if (!ghost) return null;
    return Date.now() - ghost.lastSeen;
  }

  /**
   * Get formatted time string for ghost peer
   */
  getGhostTimeLabel(peerId: string): string | null {
    const time = this.getTimeSinceLastSeen(peerId);
    if (time === null) return null;

    const minutes = Math.floor(time / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours >= 4) return '4+ hours ago';
    if (hours >= 1) return `${hours}h ago`;
    if (minutes >= 1) return `${minutes}m ago`;
    return 'Just now';
  }

  /**
   * Subscribe to ghost peer updates
   */
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
        console.log('[GhostPeers] Cleanup expired ghost:', id);
        changed = true;
      }
    }

    if (changed) {
      this.emitUpdate();
    }
  }

  private updateGhostOpacities(): void {
    const now = Date.now();
    let changed = false;

    for (const [id, ghost] of this.ghostPeers.entries()) {
      const timeSinceExpiry = now - (ghost.expiredAt - this.config.gracePeriodMs);
      const progress = Math.min(1, timeSinceExpiry / this.config.opacityDecayMs);
      
      // Decay from 0.7 to 0.3
      const newOpacity = 0.7 - (progress * 0.4);
      
      if (Math.abs(newOpacity - ghost.ghostOpacity) > 0.01) {
        ghost.ghostOpacity = Math.max(0.3, newOpacity);
        changed = true;
      }
    }

    if (changed) {
      this.emitUpdate();
    }
  }

  private emitUpdate(): void {
    const ghosts = Array.from(this.ghostPeers.values());
    this.listeners.forEach(listener => listener(ghosts));
  }

  /**
   * Get ghost peers status
   */
  getStatus(): {
    enabled: boolean;
    ghostCount: number;
    oldestGhost: number | null; // Minutes since oldest ghost was seen
    config: GhostPeerConfig;
  } {
    const ghosts = Array.from(this.ghostPeers.values());
    const oldestGhost = ghosts.length > 0
      ? Math.max(...ghosts.map(g => Date.now() - g.lastSeen)) / 60000
      : null;

    return {
      enabled: this.config.enabled,
      ghostCount: ghosts.length,
      oldestGhost,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<GhostPeerConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[GhostPeers] Config updated:', this.config);
  }

  /**
   * Clear all ghost peers
   */
  clear(): void {
    this.ghostPeers.clear();
    this.emitUpdate();
  }
}

// Singleton instance
let _instance: GhostPeersService | null = null;

export function getGhostPeersService(config?: Partial<GhostPeerConfig>): GhostPeersService {
  if (!_instance) {
    _instance = new GhostPeersService(config);
  }
  return _instance;
}
