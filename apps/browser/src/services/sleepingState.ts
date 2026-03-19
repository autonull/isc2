/**
 * Sleeping State / Away Messages Service
 *
 * Allows users to stay visible in the network while away.
 * Shows custom away messages to peers trying to connect.
 *
 * Features:
 * - Set away status with custom message
 * - Auto-away after inactivity
 * - Away message broadcast to network
 * - Quick replies for when user returns
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
  autoAwayMs: number; // Time before auto-away (default: 10 minutes)
  broadcastAway: boolean; // Broadcast away status to network
  storageKey: string;
}

const DEFAULT_CONFIG: SleepingStateConfig = {
  enabled: true,
  autoAwayMs: 10 * 60 * 1000, // 10 minutes
  broadcastAway: true,
  storageKey: 'isc:sleeping-state',
};

const DEFAULT_AWAY_MESSAGES = [
  'Away from keyboard',
  'Taking a break',
  'In a meeting',
  'Out for a walk',
  'Sleeping',
  'Focus mode',
  'Be back soon',
];

const DEFAULT_QUICK_REPLIES = [
  'Thanks for the message! I\'ll get back to you soon.',
  'I\'m away right now but saw your message.',
  'In focus mode - will respond later.',
  'Thanks for reaching out! Catch you later.',
];

export class SleepingStateService {
  private config: SleepingStateConfig;
  private state: SleepingState;
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<(state: SleepingState) => void> = new Set();
  private networkBroadcast: ((away: boolean, message: string) => void) | null = null;

  constructor(config: Partial<SleepingStateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.loadFromStorage() || this.createInitialState();
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

  /**
   * Initialize sleeping state service
   */
  start(): void {
    if (!this.config.enabled) return;

    console.log('[SleepingState] Starting with config:', this.config);

    // Setup activity tracking
    this.setupActivityTracking();

    // Restore any saved away state
    if (this.state.awayMessage?.enabled) {
      this.setAway(this.state.awayMessage.message, this.state.awayMessage.reason || 'manual');
    }
  }

  /**
   * Stop sleeping state service
   */
  stop(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    this.saveToStorage();
  }

  /**
   * Record user activity
   */
  recordActivity(): void {
    if (!this.config.enabled) return;

    const wasAway = this.state.isActive;
    this.state.lastActive = Date.now();
    this.state.isActive = false;

    // If coming back from away, clear away message
    if (wasAway && this.state.awayMessage?.enabled) {
      this.clearAway();
    }

    this.saveToStorage();
    this.emitUpdate();
    this.resetActivityTimer();
  }

  /**
   * Set away status manually
   */
  setAway(message?: string, reason: 'manual' | 'scheduled' = 'manual'): void {
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
    this.broadcastAwayStatus(true, awayMessage.message);

    console.log('[SleepingState] Set away:', awayMessage.message);
  }

  /**
   * Clear away status
   */
  clearAway(): void {
    if (!this.config.enabled) return;

    this.state.awayMessage = null;
    this.state.isActive = false;
    this.state.lastActive = Date.now();

    this.saveToStorage();
    this.emitUpdate();
    this.broadcastAwayStatus(false, '');

    console.log('[SleepingState] Cleared away status');
  }

  /**
   * Toggle away status
   */
  toggleAway(): void {
    if (this.state.isActive) {
      this.clearAway();
    } else {
      this.setAway();
    }
  }

  /**
   * Get current away status
   */
  getStatus(): {
    isActive: boolean;
    isAway: boolean;
    awayMessage: string | null;
    timeAway: number | null; // ms since went away
    timeInactive: number; // ms since last activity
  } {
    const now = Date.now();
    const timeInactive = now - this.state.lastActive;
    const timeAway = this.state.awayMessage?.setAt
      ? now - this.state.awayMessage.setAt
      : null;

    return {
      isActive: this.state.isActive,
      isAway: this.state.awayMessage?.enabled ?? false,
      awayMessage: this.state.awayMessage?.message ?? null,
      timeAway,
      timeInactive,
    };
  }

  /**
   * Get away message for display
   */
  getAwayMessage(): AwayMessage | null {
    return this.state.awayMessage;
  }

  /**
   * Update away message
   */
  updateAwayMessage(message: string): void {
    if (!this.state.awayMessage) {
      this.state.awayMessage = {
        enabled: true,
        message,
        autoReply: true,
        autoReplyMessage: DEFAULT_QUICK_REPLIES[0],
        setAt: Date.now(),
        reason: 'manual',
      };
    } else {
      this.state.awayMessage.message = message;
    }

    this.saveToStorage();
    this.emitUpdate();
    this.broadcastAwayStatus(true, message);
  }

  /**
   * Set auto-reply message
   */
  setAutoReply(message: string): void {
    if (!this.state.awayMessage) {
      this.state.awayMessage = {
        enabled: false,
        message: '',
        autoReply: true,
        autoReplyMessage: message,
        setAt: Date.now(),
        reason: 'manual',
      };
    } else {
      this.state.awayMessage.autoReply = true;
      this.state.awayMessage.autoReplyMessage = message;
    }

    this.saveToStorage();
    this.emitUpdate();
  }

  /**
   * Get quick replies
   */
  getQuickReplies(): string[] {
    return [...this.state.quickReplies];
  }

  /**
   * Add quick reply
   */
  addQuickReply(reply: string): void {
    if (!this.state.quickReplies.includes(reply)) {
      this.state.quickReplies.push(reply);
      this.saveToStorage();
      this.emitUpdate();
    }
  }

  /**
   * Remove quick reply
   */
  removeQuickReply(reply: string): void {
    this.state.quickReplies = this.state.quickReplies.filter(r => r !== reply);
    this.saveToStorage();
    this.emitUpdate();
  }

  /**
   * Subscribe to state updates
   */
  onUpdate(callback: (state: SleepingState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Set network broadcast function
   */
  setNetworkBroadcast(broadcast: (away: boolean, message: string) => void): void {
    this.networkBroadcast = broadcast;
  }

  private setupActivityTracking(): void {
    if (typeof window === 'undefined') return;

    // Track various activity events
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      this.recordActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true, capture: true });
    });

    // Initial timer setup
    this.resetActivityTimer();

    // Cleanup on unload
    window.addEventListener('unload', () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity, { capture: true });
      });
    });
  }

  private resetActivityTimer(): void {
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
    }

    this.activityTimer = setTimeout(() => {
      this.checkAutoAway();
    }, this.config.autoAwayMs);
  }

  private checkAutoAway(): void {
    const now = Date.now();
    const timeInactive = now - this.state.lastActive;

    if (timeInactive >= this.config.autoAwayMs && !this.state.awayMessage?.enabled) {
      console.log('[SleepingState] Auto-away triggered');
      this.setAway(DEFAULT_AWAY_MESSAGES[0], 'auto');
    }
  }

  private broadcastAwayStatus(away: boolean, message: string): void {
    if (!this.config.broadcastAway || !this.networkBroadcast) return;
    this.networkBroadcast(away, message);
  }

  private emitUpdate(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  private loadFromStorage(): SleepingState | null {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      
      // Validate and merge with defaults
      return {
        ...this.createInitialState(),
        ...parsed,
        quickReplies: parsed.quickReplies || [...DEFAULT_QUICK_REPLIES],
      };
    } catch {
      return null;
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.state));
    } catch (err) {
      console.warn('[SleepingState] Failed to save state:', err);
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(): {
    enabled: boolean;
    isActive: boolean;
    config: SleepingStateConfig;
  } {
    return {
      enabled: this.config.enabled,
      isActive: this.state.isActive,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration
   */
  configure(updates: Partial<SleepingStateConfig>): void {
    this.config = { ...this.config, ...updates };
    this.state.awayThresholdMs = this.config.autoAwayMs;
    console.log('[SleepingState] Config updated:', this.config);
  }
}

// Singleton instance
let _instance: SleepingStateService | null = null;

export function getSleepingStateService(config?: Partial<SleepingStateConfig>): SleepingStateService {
  if (!_instance) {
    _instance = new SleepingStateService(config);
  }
  return _instance;
}
