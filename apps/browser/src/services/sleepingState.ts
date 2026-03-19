/**
 * Sleeping State Service
 *
 * Allows users to stay visible while away with custom messages.
 */

export interface AwayMessage {
  enabled: boolean;
  message: string;
  autoReply: boolean;
  autoReplyMessage: string;
  setAt: number;
  expiresAt?: number;
  reason?: 'manual' | 'auto' | 'scheduled';
}

export interface SleepingState {
  isActive: boolean;
  lastActive: number;
  awayThresholdMs: number;
  awayMessage: AwayMessage | null;
  quickReplies: string[];
}

export interface SleepingStateConfig {
  enabled: boolean;
  autoAwayMs: number;
  broadcastAway: boolean;
  storageKey: string;
}

const DEFAULT_CONFIG: SleepingStateConfig = {
  enabled: true,
  autoAwayMs: 10 * 60 * 1000,
  broadcastAway: true,
  storageKey: 'isc:sleeping-state',
};

const DEFAULT_AWAY_MESSAGES = [
  'Away from keyboard', 'Taking a break', 'In a meeting',
  'Out for a walk', 'Sleeping', 'Focus mode', 'Be back soon',
];

const DEFAULT_QUICK_REPLIES = [
  'Thanks! I\'ll get back to you soon.',
  'I\'m away right now but saw your message.',
  'In focus mode - will respond later.',
];

export class SleepingStateService {
  private config: SleepingStateConfig;
  private state: SleepingState;
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<(state: SleepingState) => void> = new Set();
  private networkBroadcastFn: ((away: boolean, message: string) => void) | null = null;

  constructor(config: Partial<SleepingStateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.loadFromStorage() || this.createInitialState();
  }

  setNetworkBroadcast(broadcastFn: (away: boolean, message: string) => void): void {
    this.networkBroadcastFn = broadcastFn;
  }

  private createInitialState(): SleepingState {
    return {
      isActive: false,
      lastActive: Date.now(),
      awayThresholdMs: this.config.autoAwayMs,
      awayMessage: null,
      quickReplies: [...DEFAULT_QUICK_REPLIES],
    };
  }

  start(): void {
    if (!this.config.enabled) return;
    console.log('[SleepingState] Starting with config:', this.config);
    this.setupActivityTracking();
    if (this.state.awayMessage?.enabled) {
      this.setAway(this.state.awayMessage.message, this.state.awayMessage.reason || 'manual');
    }
  }

  stop(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    this.saveToStorage();
  }

  recordActivity(): void {
    if (!this.config.enabled) return;

    const wasAway = this.state.isActive;
    this.state.lastActive = Date.now();
    this.state.isActive = false;

    if (wasAway && this.state.awayMessage?.enabled) {
      this.clearAway();
    }

    this.saveToStorage();
    this.emitUpdate();
    this.resetActivityTimer();
  }

  setAway(message?: string, reason: 'manual' | 'scheduled' | 'auto' = 'manual'): void {
    if (!this.config.enabled) return;

    const awayMessage: AwayMessage = {
      enabled: true,
      message: message || DEFAULT_AWAY_MESSAGES[Math.floor(Math.random() * DEFAULT_AWAY_MESSAGES.length)],
      autoReply: true,
      autoReplyMessage: DEFAULT_QUICK_REPLIES[0],
      setAt: Date.now(),
      reason,
    };

    this.state.awayMessage = awayMessage;
    this.state.isActive = true;
    this.state.lastActive = Date.now();
    this.saveToStorage();
    this.emitUpdate();
    
    if (this.config.broadcastAway && this.networkBroadcastFn) {
      this.networkBroadcastFn(true, awayMessage.message);
    }
  }

  clearAway(): void {
    if (!this.config.enabled) return;
    this.state.awayMessage = null;
    this.state.isActive = false;
    this.state.lastActive = Date.now();
    this.saveToStorage();
    this.emitUpdate();
    
    if (this.config.broadcastAway && this.networkBroadcastFn) {
      this.networkBroadcastFn(false, '');
    }
  }

  toggleAway(): void {
    if (this.state.isActive) this.clearAway();
    else this.setAway();
  }

  getStatus(): { isActive: boolean; isAway: boolean; awayMessage: string | null; timeAway: number | null; timeInactive: number } {
    const now = Date.now();
    return {
      isActive: this.state.isActive,
      isAway: this.state.awayMessage?.enabled ?? false,
      awayMessage: this.state.awayMessage?.message ?? null,
      timeAway: this.state.awayMessage?.setAt ? now - this.state.awayMessage.setAt : null,
      timeInactive: now - this.state.lastActive,
    };
  }

  getAwayMessage(): AwayMessage | null {
    return this.state.awayMessage;
  }

  updateAwayMessage(message: string): void {
    if (!this.state.awayMessage) {
      this.state.awayMessage = {
        enabled: true, message, autoReply: true,
        autoReplyMessage: DEFAULT_QUICK_REPLIES[0], setAt: Date.now(), reason: 'manual',
      };
    } else {
      this.state.awayMessage.message = message;
    }
    this.saveToStorage();
    this.emitUpdate();
  }

  getQuickReplies(): string[] {
    return [...this.state.quickReplies];
  }

  addQuickReply(reply: string): void {
    if (!this.state.quickReplies.includes(reply)) {
      this.state.quickReplies.push(reply);
      this.saveToStorage();
      this.emitUpdate();
    }
  }

  removeQuickReply(reply: string): void {
    this.state.quickReplies = this.state.quickReplies.filter(r => r !== reply);
    this.saveToStorage();
    this.emitUpdate();
  }

  onUpdate(callback: (state: SleepingState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private setupActivityTracking(): void {
    if (typeof window === 'undefined') return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => this.recordActivity();

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true, capture: true });
    });

    this.resetActivityTimer();

    window.addEventListener('unload', () => {
      events.forEach(event => window.removeEventListener(event, handleActivity, { capture: true }));
    });
  }

  private resetActivityTimer(): void {
    if (this.activityTimer) clearTimeout(this.activityTimer);
    this.activityTimer = setTimeout(() => this.checkAutoAway(), this.config.autoAwayMs);
  }

  private checkAutoAway(): void {
    const now = Date.now();
    const timeInactive = now - this.state.lastActive;
    if (timeInactive >= this.config.autoAwayMs && !this.state.awayMessage?.enabled) {
      this.setAway(DEFAULT_AWAY_MESSAGES[0], 'auto');
    }
  }

  private emitUpdate(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  private loadFromStorage(): SleepingState | null {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return { ...this.createInitialState(), ...parsed, quickReplies: parsed.quickReplies || [...DEFAULT_QUICK_REPLIES] };
    } catch {
      return null;
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.state));
    } catch {
      // Ignore storage errors
    }
  }

  getServiceStatus(): { enabled: boolean; isActive: boolean; config: SleepingStateConfig } {
    return { enabled: this.config.enabled, isActive: this.state.isActive, config: { ...this.config } };
  }

  configure(updates: Partial<SleepingStateConfig>): void {
    this.config = { ...this.config, ...updates };
    this.state.awayThresholdMs = this.config.autoAwayMs;
  }
}

let _instance: SleepingStateService | null = null;

export function getSleepingStateService(config?: Partial<SleepingStateConfig>): SleepingStateService {
  if (!_instance) _instance = new SleepingStateService(config);
  return _instance;
}
