import { getMessageQueue } from './messageQueue.js';

type Payload = Record<string, unknown>;

interface BackgroundSyncResponse {
  type: 'READY' | 'STATE' | 'MESSAGE_RECEIVED' | 'PEER_DISCOVERED' | 'ERROR';
  payload?: Payload;
  tabId?: string;
}

export class BackgroundSyncManager {
  private worker: SharedWorker | null = null;
  private port: MessagePort | null = null;
  private connected = false;
  private initialized = false;
  private peerId: string | null = null;
  private messageQueue = getMessageQueue();
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private tabId: string;

  constructor() {
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async initialize(): Promise<void> {
    this._initializeAsync().catch(() => {
      /* Fire-and-forget */
    });
  }

  private async _initializeAsync(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      if (typeof SharedWorker === 'undefined') return;

      const workerUrl = new URL('../shared-workers/shared-worker.ts', import.meta.url);
      this.worker = new SharedWorker(workerUrl, { type: 'module', name: 'isc-network' });
      this.port = this.worker.port;

      this.port.onmessage = (event: MessageEvent<BackgroundSyncResponse>) =>
        this.handleMessage(event.data);
      this.port.onmessageerror = () => console.warn('[BackgroundSync] Message error');

      this.port.start();
      this.port.postMessage({ type: 'INITIALIZE', tabId: this.tabId });

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 1500);
        const onReady = (response: BackgroundSyncResponse) => {
          if (response.type === 'READY') {
            clearTimeout(timeout);
            this.connected = true;
            this.peerId = (response.payload as any)?.peerId ?? null;
            this.port?.removeEventListener('message', onReady as EventListener);
          }
          resolve();
        };
        this.port?.addEventListener('message', onReady as EventListener);
      });
    } catch (err) {
      console.warn('[BackgroundSync] Failed to initialize:', err);
    }
  }

  private handleMessage(response: BackgroundSyncResponse): void {
    const { type, payload } = response;

    switch (type) {
      case 'MESSAGE_RECEIVED': {
        const { topic, data, timestamp } = payload as {
          topic: string;
          data: unknown;
          timestamp: number;
        };
        if (document.visibilityState === 'hidden') {
          this.messageQueue.enqueue(topic, { data, timestamp });
        } else {
          this.emit(topic, { data, timestamp });
        }
        break;
      }
      case 'PEER_DISCOVERED':
        this.emit('peer:discovered', payload);
        break;
      case 'ERROR':
        this.emit('error', payload);
        break;
    }
  }

  subscribe(topic: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
      this.port?.postMessage({ type: 'SUBSCRIBE', payload: { topic }, tabId: this.tabId });
    }

    this.listeners.get(topic)!.add(callback);
    this.messageQueue.getPending(topic).forEach((msg) => callback(msg.data));

    return () => this.listeners.get(topic)?.delete(callback);
  }

  async publish(topic: string, data: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.port?.postMessage({ type: 'SEND_MESSAGE', payload: { topic, data }, tabId: this.tabId });

      const onReady = (response: BackgroundSyncResponse) => {
        if (response.type === 'READY' && (response.payload as any)?.success) resolve();
        else if (response.type === 'ERROR') reject(new Error((response.payload as any)?.message));
      };

      this.port?.addEventListener('message', onReady as EventListener, { once: true });
    });
  }

  async announce(key: string, value: unknown, ttl: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.port?.postMessage({ type: 'ANNOUNCE', payload: { key, value, ttl }, tabId: this.tabId });

      const onReady = (response: BackgroundSyncResponse) => {
        if (response.type === 'READY' && (response.payload as any)?.success) resolve();
        else if (response.type === 'ERROR') reject(new Error((response.payload as any)?.message));
      };

      this.port?.addEventListener('message', onReady as EventListener, { once: true });
    });
  }

  async discoverPeers(): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      this.port?.postMessage({ type: 'DISCOVER', tabId: this.tabId });

      const onDiscovered = (response: BackgroundSyncResponse) => {
        if (response.type === 'PEER_DISCOVERED') resolve((response.payload as any)?.peers ?? []);
        else if (response.type === 'ERROR') reject(new Error((response.payload as any)?.message));
      };

      this.port?.addEventListener('message', onDiscovered as EventListener, { once: true });
    });
  }

  async getState(): Promise<{
    initialized: boolean;
    peerId: string | null;
    connected: boolean;
    connectionCount: number;
  }> {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve({ initialized: false, peerId: null, connected: false, connectionCount: 0 });
        return;
      }

      this.port?.postMessage({ type: 'GET_STATE', tabId: this.tabId });

      const onState = (response: BackgroundSyncResponse) => {
        if (response.type === 'STATE') resolve(response.payload);
      };
      this.port?.addEventListener('message', onState as EventListener, { once: true });
    });
  }

  getPeerId(): string | null {
    return this.peerId;
  }
  isConnected(): boolean {
    return this.connected;
  }

  private emit(topic: string, data: unknown): void {
    this.listeners.get(topic)?.forEach((callback) => callback(data));
  }

  destroy(): void {
    if (this.port) this.port.close();
    this.worker = null;
    this.port = null;
    this.connected = false;
    this.initialized = false;
  }
}

let _instance: BackgroundSyncManager | null = null;

export function getBackgroundSyncManager(): BackgroundSyncManager {
  if (!_instance) _instance = new BackgroundSyncManager();
  return _instance;
}
