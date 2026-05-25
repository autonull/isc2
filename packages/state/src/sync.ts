/* eslint-disable */
/**
 * Cross-Tab/Device State Sync
 *
 * Synchronizes state across browser tabs and devices.
 */

import type { StateSync, AppState } from './types.js';

/**
 * BroadcastChannel-based sync for cross-tab communication
 */
export class BroadcastChannelSync implements StateSync {
  private channel: BroadcastChannel | null = null;
  private readonly channelName: string;

  constructor(channelName: string = 'isc-state-sync') {
    this.channelName = channelName;
  }

  private init(): void {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    if (!this.channel) {
      this.channel = new BroadcastChannel(this.channelName);
    }
  }

  subscribe(callback: (state: Partial<AppState>) => void): () => void {
    this.init();

    if (!this.channel) {
      return () => {};
    }

    const handler = (event: MessageEvent<Partial<AppState>>) => {
      if (event.data) {
        callback(event.data);
      }
    };

    this.channel.addEventListener('message', handler);

    return () => {
      this.channel?.removeEventListener('message', handler);
    };
  }

  broadcast(state: Partial<AppState>): Promise<void> {
    this.init();
    this.channel?.postMessage(state);
    return Promise.resolve();
  }
}

/**
 * Storage event-based sync (fallback for older browsers)
 */
export class StorageEventSync implements StateSync {
  private readonly storageKey: string;
  private handler?: (event: StorageEvent) => void;

  constructor(storageKey: string = 'isc-state') {
    this.storageKey = storageKey;
  }

  subscribe(callback: (state: Partial<AppState>) => void): () => void {
    this.handler = (event: StorageEvent) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const state = JSON.parse(event.newValue) as Partial<AppState>;
          callback(state);
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', this.handler);

    return () => {
      window.removeEventListener('storage', this.handler!);
    };
  }

  broadcast(state: Partial<AppState>): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch {
      // Storage quota exceeded or not available
    }
    return Promise.resolve();
  }
}

/**
 * WebSocket-based sync for cross-device communication
 */
export class WebSocketSync implements StateSync {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private reconnectDelay: number = 1000;
  private maxReconnectDelay: number = 30000;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private callbacks: Array<(state: Partial<AppState>) => void> = [];
  private shouldReconnect: boolean = true;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (typeof WebSocket === 'undefined') {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
      };

      this.ws.onmessage = (event) => {
        try {
          const state = JSON.parse(String(event.data)) as Partial<AppState>;
          this.callbacks.forEach((cb) => cb(state));
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {return;}

    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.connect();
    }, this.reconnectDelay);
  }

  subscribe(callback: (state: Partial<AppState>) => void): () => void {
    this.callbacks.push(callback);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  broadcast(state: Partial<AppState>): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(state));
    }
    return Promise.resolve();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}

/**
 * Composite sync that combines multiple sync strategies
 */
export class CompositeSync implements StateSync {
  private syncs: StateSync[] = [];

  addSync(sync: StateSync): void {
    this.syncs.push(sync);
  }

  subscribe(callback: (state: Partial<AppState>) => void): () => void {
    const unsubscribers = this.syncs.map((sync) => sync.subscribe(callback));

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }

  broadcast(state: Partial<AppState>): Promise<void> {
    void Promise.all(this.syncs.map((sync) => sync.broadcast(state).catch(console.error)));
    return Promise.resolve();
  }
}

/**
 * Create appropriate sync based on environment
 */
export function createSync(): StateSync {
  const composite = new CompositeSync();

  // Browser environment
  if (typeof window !== 'undefined') {
    if (typeof BroadcastChannel !== 'undefined') {
      composite.addSync(new BroadcastChannelSync());
    } else if (typeof localStorage !== 'undefined') {
      composite.addSync(new StorageEventSync());
    }
  }

  return composite;
}
