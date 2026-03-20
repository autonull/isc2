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

const INVITE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

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
    if (typeof window !== 'undefined')
      window.addEventListener('hashchange', () => this.checkUrlForInvite());
  }

  createPeerInvite(
    peerId: string,
    name?: string,
    description?: string,
    options?: { expiresAt?: number; maxUses?: number }
  ): InviteLink {
    const data: InviteData = {
      type: 'peer',
      id: peerId,
      name,
      description,
      expiresAt: options?.expiresAt ?? Date.now() + this.config.defaultExpiryMs,
      maxUses: options?.maxUses,
      currentUses: 0,
      createdBy: peerId,
      createdAt: Date.now(),
    };
    const link = this.buildLink(data);
    this.createdInvites.set(link.shortCode!, link);
    this.saveToStorage();
    this.emitUpdate();
    return link;
  }

  createChannelInvite(
    channelId: string,
    channelName: string,
    description?: string,
    options?: { expiresAt?: number; maxUses?: number }
  ): InviteLink {
    const data: InviteData = {
      type: 'channel',
      id: channelId,
      name: channelName,
      description,
      expiresAt: options?.expiresAt ?? Date.now() + this.config.defaultExpiryMs,
      maxUses: options?.maxUses,
      currentUses: 0,
      createdBy: 'current-user',
      createdAt: Date.now(),
    };
    const link = this.buildLink(data);
    this.createdInvites.set(link.shortCode!, link);
    this.saveToStorage();
    this.emitUpdate();
    return link;
  }

  private buildLink(data: InviteData): InviteLink {
    const shortCode = this.generateShortCode();
    const url = this.buildUrl('invite', shortCode);
    return { url, data, shortCode };
  }

  createDirectJoinLink(peerId: string): string {
    return this.buildUrl('join', peerId);
  }

  parseInvite(url: string): InviteData | null {
    try {
      const urlObj = new URL(url, window.location.href);
      const hash = urlObj.hash.slice(1);
      if (hash.startsWith('join/'))
        return {
          type: 'peer',
          id: hash.slice(5),
          currentUses: 0,
          createdBy: hash.slice(5),
          createdAt: Date.now(),
        };
      if (hash.startsWith('channel/'))
        return {
          type: 'channel',
          id: hash.slice(8),
          currentUses: 0,
          createdBy: 'unknown',
          createdAt: Date.now(),
        };
      if (hash.startsWith('invite/')) return this.createdInvites.get(hash.slice(7))?.data ?? null;
    } catch {
      /* Invalid URL */
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
    if ((invite.data.expiresAt ?? Infinity) < Date.now()) return false;
    if ((invite.data.maxUses ?? Infinity) < invite.data.currentUses) return false;
    invite.data.currentUses++;
    this.saveToStorage();
    return true;
  }

  getInvites(): InviteLink[] {
    return [...this.createdInvites.values()];
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
      if (typeof window !== 'undefined')
        window.dispatchEvent(new CustomEvent('isc:invite-received', { detail: invite }));
    }
  }

  private buildUrl(type: string, value: string): string {
    return `${this.config.baseUrl.split('#')[0]}#${type}/${value}`;
  }

  private generateShortCode(): string {
    return Array.from(
      { length: 8 },
      () => INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)]
    ).join('');
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;
      const invites: InviteLink[] = JSON.parse(stored);
      invites.forEach((invite) => {
        if (invite.shortCode) this.createdInvites.set(invite.shortCode, invite);
      });
    } catch {
      /* Ignore */
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify([...this.createdInvites.values()])
      );
    } catch {
      /* Ignore */
    }
  }

  private emitUpdate(): void {
    this.listeners.forEach((listener) => listener([...this.createdInvites.values()]));
  }

  getStatus() {
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
