/**
 * Shareable Invite Links Service
 *
 * Generates shareable URLs that bypass DHT cold-start.
 * Format: #join/PEER_ID or #channel/CHANNEL_ID
 *
 * Features:
 * - Generate invite links with optional metadata
 * - Parse and validate invite URLs
 * - Auto-join on navigation
 * - Track invite analytics
 */

export interface InviteData {
  type: 'peer' | 'channel';
  id: string;
  name?: string;
  description?: string;
  expiresAt?: number;
  maxUses?: number;
  currentUses: number;
  createdBy: string;
  createdAt: number;
}

export interface InviteLink {
  url: string;
  data: InviteData;
  shortCode?: string;
}

export interface InviteConfig {
  enabled: boolean;
  baseUrl: string;
  defaultExpiryMs: number;
  storageKey: string;
}

const DEFAULT_CONFIG: InviteConfig = {
  enabled: true,
  baseUrl: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
  defaultExpiryMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  storageKey: 'isc:invites',
};

export class InviteLinksService {
  private config: InviteConfig;
  private createdInvites = new Map<string, InviteLink>();
  private pendingJoin: InviteData | null = null;
  private listeners: Set<(invites: InviteLink[]) => void> = new Set();

  constructor(config: Partial<InviteConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
  }

  /**
   * Initialize invite service
   */
  start(): void {
    if (!this.config.enabled) return;

    console.log('[InviteLinks] Starting with config:', this.config);

    // Check for invite in URL
    this.checkUrlForInvite();

    // Listen for hash changes
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.checkUrlForInvite();
      });
    }
  }

  /**
   * Generate invite link for peer
   */
  createPeerInvite(peerId: string, name?: string, description?: string, options?: {
    expiresAt?: number;
    maxUses?: number;
  }): InviteLink {
    const data: InviteData = {
      type: 'peer',
      id: peerId,
      name,
      description,
      expiresAt: options?.expiresAt || Date.now() + this.config.defaultExpiryMs,
      maxUses: options?.maxUses,
      currentUses: 0,
      createdBy: peerId,
      createdAt: Date.now(),
    };

    const shortCode = this.generateShortCode();
    const url = this.buildUrl('invite', shortCode);

    const link: InviteLink = { url, data, shortCode };
    
    this.createdInvites.set(shortCode, link);
    this.saveToStorage();
    this.emitUpdate();

    console.log('[InviteLinks] Created peer invite:', url);
    return link;
  }

  /**
   * Generate invite link for channel
   */
  createChannelInvite(channelId: string, channelName: string, description?: string, options?: {
    expiresAt?: number;
    maxUses?: number;
  }): InviteLink {
    const data: InviteData = {
      type: 'channel',
      id: channelId,
      name: channelName,
      description,
      expiresAt: options?.expiresAt || Date.now() + this.config.defaultExpiryMs,
      maxUses: options?.maxUses,
      currentUses: 0,
      createdBy: 'current-user',
      createdAt: Date.now(),
    };

    const shortCode = this.generateShortCode();
    const url = this.buildUrl('invite', shortCode);

    const link: InviteLink = { url, data, shortCode };
    
    this.createdInvites.set(shortCode, link);
    this.saveToStorage();
    this.emitUpdate();

    console.log('[InviteLinks] Created channel invite:', url);
    return link;
  }

  /**
   * Generate simple direct join link
   */
  createDirectJoinLink(peerId: string): string {
    return this.buildUrl('join', peerId);
  }

  /**
   * Parse invite from URL
   */
  parseInvite(url: string): InviteData | null {
    try {
      const urlObj = new URL(url, window.location.href);
      const hash = urlObj.hash.slice(1); // Remove #

      // Format: #join/PEER_ID
      if (hash.startsWith('join/')) {
        const peerId = hash.slice(5);
        return {
          type: 'peer',
          id: peerId,
          currentUses: 0,
          createdBy: peerId,
          createdAt: Date.now(),
        };
      }

      // Format: #channel/CHANNEL_ID
      if (hash.startsWith('channel/')) {
        const channelId = hash.slice(8);
        return {
          type: 'channel',
          id: channelId,
          currentUses: 0,
          createdBy: 'unknown',
          createdAt: Date.now(),
        };
      }

      // Format: #invite/SHORT_CODE
      if (hash.startsWith('invite/')) {
        const shortCode = hash.slice(7);
        const invite = this.createdInvites.get(shortCode);
        if (invite) {
          return invite.data;
        }
      }
    } catch {
      // Invalid URL
    }

    return null;
  }

  /**
   * Get pending join data (from URL)
   */
  getPendingJoin(): InviteData | null {
    return this.pendingJoin;
  }

  /**
   * Clear pending join
   */
  clearPendingJoin(): void {
    this.pendingJoin = null;
  }

  /**
   * Use an invite (increment counter)
   */
  useInvite(shortCode: string): boolean {
    const invite = this.createdInvites.get(shortCode);
    if (!invite) return false;

    // Check expiry
    if (invite.data.expiresAt && invite.data.expiresAt < Date.now()) {
      console.log('[InviteLinks] Invite expired:', shortCode);
      return false;
    }

    // Check max uses
    if (invite.data.maxUses && invite.data.currentUses >= invite.data.maxUses) {
      console.log('[InviteLinks] Invite max uses reached:', shortCode);
      return false;
    }

    // Increment counter
    invite.data.currentUses++;
    this.saveToStorage();

    console.log('[InviteLinks] Invite used:', shortCode, `(${invite.data.currentUses}/${invite.data.maxUses || '∞'})`);
    return true;
  }

  /**
   * Get all created invites
   */
  getInvites(): InviteLink[] {
    return Array.from(this.createdInvites.values());
  }

  /**
   * Revoke an invite
   */
  revokeInvite(shortCode: string): boolean {
    const deleted = this.createdInvites.delete(shortCode);
    if (deleted) {
      this.saveToStorage();
      this.emitUpdate();
      console.log('[InviteLinks] Revoked invite:', shortCode);
    }
    return deleted;
  }

  /**
   * Subscribe to invite updates
   */
  onUpdate(callback: (invites: InviteLink[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Check URL for invite on load
   */
  private checkUrlForInvite(): void {
    if (!this.config.enabled) return;

    const invite = this.parseInvite(window.location.href);
    if (invite) {
      this.pendingJoin = invite;
      console.log('[InviteLinks] Found pending invite:', invite);
      
      // Dispatch event for app to handle
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('isc:invite-received', {
          detail: invite,
        }));
      }
    }
  }

  /**
   * Build invite URL
   */
  private buildUrl(type: string, value: string): string {
    const baseUrl = this.config.baseUrl.split('#')[0];
    return `${baseUrl}#${type}/${value}`;
  }

  /**
   * Generate short code for invite
   */
  private generateShortCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Load invites from storage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;

      const invites: InviteLink[] = JSON.parse(stored);
      invites.forEach(invite => {
        if (invite.shortCode) {
          this.createdInvites.set(invite.shortCode, invite);
        }
      });

      console.log('[InviteLinks] Loaded', this.createdInvites.size, 'invites from storage');
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Save invites to storage
   */
  private saveToStorage(): void {
    try {
      const invites = Array.from(this.createdInvites.values());
      localStorage.setItem(this.config.storageKey, JSON.stringify(invites));
    } catch (err) {
      console.warn('[InviteLinks] Failed to save invites:', err);
    }
  }

  private emitUpdate(): void {
    const invites = Array.from(this.createdInvites.values());
    this.listeners.forEach(listener => listener(invites));
  }

  /**
   * Get service status
   */
  getStatus(): {
    enabled: boolean;
    inviteCount: number;
    pendingJoin: InviteData | null;
    config: InviteConfig;
  } {
    return {
      enabled: this.config.enabled,
      inviteCount: this.createdInvites.size,
      pendingJoin: this.pendingJoin,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<InviteConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('[InviteLinks] Config updated:', this.config);
  }
}

// Singleton instance
let _instance: InviteLinksService | null = null;

export function getInviteLinksService(config?: Partial<InviteConfig>): InviteLinksService {
  if (!_instance) {
    _instance = new InviteLinksService(config);
  }
  return _instance;
}
