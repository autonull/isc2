/**
 * Invite Links Service
 *
 * Generates shareable URLs that bypass DHT cold-start.
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
  defaultExpiryMs: 7 * 24 * 60 * 60 * 1000,
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

  start(): void {
    if (!this.config.enabled) return;
    console.log('[InviteLinks] Starting with config:', this.config);
    this.checkUrlForInvite();

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => this.checkUrlForInvite());
    }
  }

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
    return link;
  }

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
    return link;
  }

  createDirectJoinLink(peerId: string): string {
    return this.buildUrl('join', peerId);
  }

  parseInvite(url: string): InviteData | null {
    try {
      const urlObj = new URL(url, window.location.href);
      const hash = urlObj.hash.slice(1);

      if (hash.startsWith('join/')) {
        return { type: 'peer', id: hash.slice(5), currentUses: 0, createdBy: hash.slice(5), createdAt: Date.now() };
      }
      if (hash.startsWith('channel/')) {
        return { type: 'channel', id: hash.slice(8), currentUses: 0, createdBy: 'unknown', createdAt: Date.now() };
      }
      if (hash.startsWith('invite/')) {
        const invite = this.createdInvites.get(hash.slice(7));
        if (invite) return invite.data;
      }
    } catch {
      // Invalid URL
    }
    return null;
  }

  getPendingJoin(): InviteData | null {
    return this.pendingJoin;
  }

  clearPendingJoin(): void {
    this.pendingJoin = null;
  }

  useInvite(shortCode: string): boolean {
    const invite = this.createdInvites.get(shortCode);
    if (!invite) return false;

    if (invite.data.expiresAt && invite.data.expiresAt < Date.now()) return false;
    if (invite.data.maxUses && invite.data.currentUses >= invite.data.maxUses) return false;

    invite.data.currentUses++;
    this.saveToStorage();
    return true;
  }

  getInvites(): InviteLink[] {
    return Array.from(this.createdInvites.values());
  }

  revokeInvite(shortCode: string): boolean {
    const deleted = this.createdInvites.delete(shortCode);
    if (deleted) {
      this.saveToStorage();
      this.emitUpdate();
    }
    return deleted;
  }

  onUpdate(callback: (invites: InviteLink[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private checkUrlForInvite(): void {
    if (!this.config.enabled) return;
    const invite = this.parseInvite(window.location.href);
    if (invite) {
      this.pendingJoin = invite;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('isc:invite-received', { detail: invite }));
      }
    }
  }

  private buildUrl(type: string, value: string): string {
    const baseUrl = this.config.baseUrl.split('#')[0];
    return `${baseUrl}#${type}/${value}`;
  }

  private generateShortCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;
      const invites: InviteLink[] = JSON.parse(stored);
      invites.forEach(invite => {
        if (invite.shortCode) this.createdInvites.set(invite.shortCode, invite);
      });
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage(): void {
    try {
      const invites = Array.from(this.createdInvites.values());
      localStorage.setItem(this.config.storageKey, JSON.stringify(invites));
    } catch {
      // Ignore storage errors
    }
  }

  private emitUpdate(): void {
    const invites = Array.from(this.createdInvites.values());
    this.listeners.forEach(listener => listener(invites));
  }

  getStatus(): { enabled: boolean; inviteCount: number; pendingJoin: InviteData | null } {
    return {
      enabled: this.config.enabled,
      inviteCount: this.createdInvites.size,
      pendingJoin: this.pendingJoin,
    };
  }

  configure(updates: Partial<InviteConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

let _instance: InviteLinksService | null = null;

export function getInviteLinksService(config?: Partial<InviteConfig>): InviteLinksService {
  if (!_instance) _instance = new InviteLinksService(config);
  return _instance;
}
