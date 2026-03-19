/**
 * BackgroundWorker Manager
 *
 * Manages connection to BackgroundWorker for persistent network presence.
 */

import { getMessageQueue } from './messageQueue.js';

interface BackgroundWorkerResponse {
  type: 'READY' | 'STATE' | 'MESSAGE_RECEIVED' | 'PEER_DISCOVERED' | 'ERROR';
  payload?: any;
  tabId?: string;
}

export class BackgroundNetworkManager {
  private worker: BackgroundWorker | null = null;
  private port: MessagePort | null = null;
  private connected = false;
  private peerId: string | null = null;
  private messageQueue = getMessageQueue();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private tabId: string;

  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Initialize connection to BackgroundWorker
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if BackgroundWorker is supported
        if (typeof BackgroundWorker === 'undefined') {
          console.warn('[BackgroundNetworkManager] BackgroundWorker not supported, using fallback');
          resolve();
          return;
        }

        // Create connection to BackgroundWorker
        this.worker = new BackgroundWorker(
          new URL('../shared-workers/shared-worker.ts', import.meta.url),
          { type: 'module', name: 'isc-network' }
        );

        this.port = this.worker.port;

        this.port.onmessage = (event: MessageEvent<BackgroundWorkerResponse>) => {
          this.handleMessage(event.data);
        };

        this.port.onmessageerror = (err) => {
          console.error('[BackgroundNetworkManager] Message error:', err);
        };

        this.port.start();

        // Send initialization message
        this.port.postMessage({
          type: 'INITIALIZE',
          tabId: this.tabId,
        });

        // Wait for READY response
        const timeout = setTimeout(() => {
          reject(new Error('BackgroundWorker initialization timeout'));
        }, 10000);

        const onReady = (response: BackgroundWorkerResponse) => {
          if (response.type === 'READY') {
            clearTimeout(timeout);
            this.connected = true;
            this.peerId = response.payload?.peerId || null;
            console.log('[BackgroundNetworkManager] Connected, peerId:', this.peerId);
            this.port?.removeEventListener('message', onReady as any);
            resolve();
          } else if (response.type === 'ERROR') {
            clearTimeout(timeout);
            reject(new Error(response.payload?.message || 'Initialization failed'));
          }
        };

        this.port.addEventListener('message', onReady as any);
      } catch (err) {
        console.error('[BackgroundNetworkManager] Failed to initialize:', err);
        reject(err);
      }
    });
  }

  private handleMessage(response: BackgroundWorkerResponse) {
    const { type, payload } = response;

    console.log('[BackgroundNetworkManager] Received:', type, payload);

    switch (type) {
      case 'MESSAGE_RECEIVED':
        // Message received while tab may have been hidden
        const { topic, data, timestamp } = payload;
        
        if (document.visibilityState === 'hidden') {
          // Queue for later delivery
          this.messageQueue.enqueue(topic, { data, timestamp });
        } else {
          // Deliver immediately
          this.emit(topic, { data, timestamp });
        }
        break;

      case 'PEER_DISCOVERED':
        this.emit('peer:discovered', payload);
        break;

      case 'ERROR':
        console.error('[BackgroundNetworkManager] Error:', payload?.message);
        this.emit('error', payload);
        break;
    }
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
      
      // Request subscription from BackgroundWorker
      this.port?.postMessage({
        type: 'SUBSCRIBE',
        payload: { topic },
        tabId: this.tabId,
      });
    }

    this.listeners.get(topic)!.add(callback);

    // Deliver any queued messages for this topic
    const pending = this.messageQueue.getPending(topic);
    pending.forEach((msg) => callback(msg.data));

    return () => {
      this.listeners.get(topic)?.delete(callback);
    };
  }

  /**
   * Publish message to a topic
   */
  async publish(topic: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to BackgroundWorker'));
        return;
      }

      this.port?.postMessage({
        type: 'SEND_MESSAGE',
        payload: { topic, data },
        tabId: this.tabId,
      });

      const onReady = (response: BackgroundWorkerResponse) => {
        if (response.type === 'READY' && response.payload?.success) {
          resolve();
        } else if (response.type === 'ERROR') {
          reject(new Error(response.payload?.message));
        }
      };

      this.port?.addEventListener('message', onReady as any, { once: true });
    });
  }

  /**
   * Announce data to DHT
   */
  async announce(key: string, value: any, ttl: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to BackgroundWorker'));
        return;
      }

      this.port?.postMessage({
        type: 'ANNOUNCE',
        payload: { key, value, ttl },
        tabId: this.tabId,
      });

      const onReady = (response: BackgroundWorkerResponse) => {
        if (response.type === 'READY' && response.payload?.success) {
          resolve();
        } else if (response.type === 'ERROR') {
          reject(new Error(response.payload?.message));
        }
      };

      this.port?.addEventListener('message', onReady as any, { once: true });
    });
  }

  /**
   * Trigger peer discovery
   */
  async discoverPeers(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to BackgroundWorker'));
        return;
      }

      this.port?.postMessage({
        type: 'DISCOVER',
        tabId: this.tabId,
      });

      const onDiscovered = (response: BackgroundWorkerResponse) => {
        if (response.type === 'PEER_DISCOVERED') {
          resolve(response.payload?.peers || []);
        } else if (response.type === 'ERROR') {
          reject(new Error(response.payload?.message));
        }
      };

      this.port?.addEventListener('message', onDiscovered as any, { once: true });
    });
  }

  /**
   * Get current state
   */
  async getState(): Promise<{
    initialized: boolean;
    peerId: string | null;
    connected: boolean;
    connectionCount: number;
  }> {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve({
          initialized: false,
          peerId: null,
          connected: false,
          connectionCount: 0,
        });
        return;
      }

      this.port?.postMessage({
        type: 'GET_STATE',
        tabId: this.tabId,
      });

      const onState = (response: BackgroundWorkerResponse) => {
        if (response.type === 'STATE') {
          resolve(response.payload);
        }
      };

      this.port?.addEventListener('message', onState as any, { once: true });
    });
  }

  private emit(topic: string, data: any) {
    const listeners = this.listeners.get(topic);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  /**
   * Get peer ID
   */
  getPeerId(): string | null {
    return this.peerId;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.port) {
      this.port.close();
    }
    this.worker = null;
    this.port = null;
    this.connected = false;
  }
}

// Singleton instance
let _instance: BackgroundNetworkManager | null = null;

export function getBackgroundNetworkManager(): BackgroundNetworkManager {
  if (!_instance) {
    _instance = new BackgroundNetworkManager();
  }
  return _instance;
}
