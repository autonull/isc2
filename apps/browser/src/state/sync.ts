/**
 * Application State Synchronization Service
 * 
 * Provides cross-component state synchronization using:
 * - localStorage events for cross-tab sync
 * - Custom events for in-tab communication
 * - IndexedDB for persistent state
 */

export interface AppState {
  channels: ChannelState[];
  conversations: ConversationState[];
  messages: Map<string, MessageState[]>;
  identity: IdentityState | null;
  network: NetworkState;
  settings: SettingsState;
}

export interface ChannelState {
  id: string;
  name: string;
  description: string;
  active: boolean;
  updatedAt: number;
}

export interface ConversationState {
  peerId: string;
  channelID: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
}

export interface MessageState {
  id: string;
  channelID: string;
  msg: string;
  timestamp: number;
  sender: string;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
}

export interface IdentityState {
  peerId: string;
  publicKeyFingerprint: string;
  isInitialized: boolean;
}

export interface NetworkState {
  isConnected: boolean;
  peerCount: number;
  lastSyncTime: number;
}

export interface SettingsState {
  notifications: boolean;
  delegation: boolean;
  theme: 'light' | 'dark' | 'system';
}

const STORAGE_KEYS = {
  CHANNELS: 'isc-channels',
  CONVERSATIONS: 'isc-conversations',
  IDENTITY: 'isc-identity',
  SETTINGS: 'isc-settings',
};

const EVENT_PREFIX = 'isc-';

class StateSyncServiceClass {
  private subscribers = new Map<string, Set<(state: any) => void>>();
  private stateCache = new Map<string, any>();

  constructor() {
    this.setupStorageListener();
    this.setupCustomEventListeners();
  }

  /**
   * Subscribe to state changes for a specific key
   */
  subscribe<T>(key: string, callback: (state: T) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Get state from cache or storage
   */
  getState<T>(key: string): T | null {
    // Check cache first
    if (this.stateCache.has(key)) {
      return this.stateCache.get(key);
    }

    // Load from storage
    try {
      const stored = localStorage.getItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.stateCache.set(key, parsed);
        return parsed as T;
      }
    } catch (err) {
      console.error('[StateSync] Failed to load state:', key, err);
    }

    return null;
  }

  /**
   * Set state and notify subscribers
   */
  setState<T>(key: string, state: T, persist = true): void {
    // Update cache
    this.stateCache.set(key, state);

    // Persist to storage
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS], JSON.stringify(state));
      } catch (err) {
        console.error('[StateSync] Failed to persist state:', key, err);
      }
    }

    // Notify subscribers
    this.notifySubscribers(key, state);

    // Dispatch custom event for cross-component communication
    this.dispatchCustomEvent(key, state);
  }

  /**
   * Update state partially (merge with existing)
   */
  updateState<T extends Record<string, any>>(key: string, updates: Partial<T>): void {
    const current = this.getState<T>(key) || {} as T;
    const updated = { ...current, ...updates } as T;
    this.setState(key, updated);
  }

  /**
   * Clear state
   */
  clearState(key: string): void {
    this.stateCache.delete(key);
    localStorage.removeItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]);
    this.notifySubscribers(key, null);
  }

  /**
   * Setup localStorage event listener for cross-tab sync
   */
  private setupStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (!event.key || !event.key.startsWith('isc-')) return;

      const storageKey = event.key.replace('isc-', '');
      const key = Object.entries(STORAGE_KEYS).find(([_, v]) => v === event.key)?.[0];

      if (key) {
        try {
          const newState = event.newValue ? JSON.parse(event.newValue) : null;
          this.stateCache.set(key, newState);
          this.notifySubscribers(key, newState);
        } catch (err) {
          console.error('[StateSync] Failed to parse storage event:', err);
        }
      }
    });
  }

  /**
   * Setup custom event listeners for in-tab communication
   */
  private setupCustomEventListeners(): void {
    window.addEventListener('storagechange', (event: any) => {
      const { key, state } = event.detail || {};
      if (key) {
        this.stateCache.set(key, state);
        this.notifySubscribers(key, state);
      }
    });
  }

  /**
   * Dispatch custom event for state change
   */
  private dispatchCustomEvent(key: string, state: any): void {
    try {
      window.dispatchEvent(new CustomEvent('storagechange', {
        detail: { key, state },
      }));
    } catch (err) {
      console.error('[StateSync] Failed to dispatch custom event:', err);
    }
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(key: string, state: any): void {
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(state);
        } catch (err) {
          console.error('[StateSync] Subscriber callback error:', key, err);
        }
      });
    }
  }

  /**
   * Sync all state from storage to cache
   */
  syncFromStorage(): void {
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          this.stateCache.set(key, JSON.parse(stored));
        }
      } catch (err) {
        console.error('[StateSync] Failed to sync from storage:', key, err);
      }
    });
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkState {
    return {
      isConnected: navigator.onLine,
      peerCount: 0, // Updated by network layer
      lastSyncTime: Date.now(),
    };
  }

  /**
   * Broadcast state to all tabs
   */
  broadcastState(key: string): void {
    const state = this.getState(key);
    if (state) {
      localStorage.setItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS], JSON.stringify(state));
    }
  }
}

// Singleton instance
export const StateSync = new StateSyncServiceClass();

// Convenience functions
export function subscribeState<T>(key: string, callback: (state: T) => void): () => void {
  return StateSync.subscribe<T>(key, callback);
}

export function getState<T>(key: string): T | null {
  return StateSync.getState<T>(key);
}

export function setState<T>(key: string, state: T, persist = true): void {
  StateSync.setState(key, state, persist);
}

export function updateState<T extends Record<string, any>>(key: string, updates: Partial<T>): void {
  StateSync.updateState(key, updates);
}

export function clearState(key: string): void {
  StateSync.clearState(key);
}

export function syncState(): void {
  StateSync.syncFromStorage();
}
