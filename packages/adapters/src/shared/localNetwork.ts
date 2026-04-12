import type { NetworkAdapter, Stream } from '../interfaces/network.js';

export class LocalNetworkMedium {
  public dht: Map<string, Array<{ value: Uint8Array, expiresAt: number }>> = new Map();
  public pubsub: Map<string, Set<(data: Uint8Array) => void>> = new Map();
  public peers: Map<string, LocalNetworkAdapter> = new Map();

  public createPeer(peerId: string): LocalNetworkAdapter {
    const adapter = new LocalNetworkAdapter(this, peerId);
    this.peers.set(peerId, adapter);
    return adapter;
  }
}

export class LocalNetworkAdapter implements NetworkAdapter {
  private medium: LocalNetworkMedium;
  public peerId: string;
  private _running: boolean = true;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(medium: LocalNetworkMedium, peerId: string) {
    this.medium = medium;
    this.peerId = peerId;
  }

  async announce(key: string, value: Uint8Array, ttl: number = 300000): Promise<void> {
    if (!this._running) throw new Error('Network not running');
    if (!this.medium.dht.has(key)) {
      this.medium.dht.set(key, []);
    }
    const expiresAt = Date.now() + ttl;

    // Simplistic DHT store
    this.medium.dht.get(key)!.push({ value, expiresAt });
  }

  async query(key: string, count: number): Promise<Uint8Array[]> {
    if (!this._running) throw new Error('Network not running');
    const now = Date.now();

    if (!this.medium.dht.has(key)) return [];

    const entries = this.medium.dht.get(key)!;
    // Clean up expired entries lazily
    const validEntries = entries.filter(e => e.expiresAt > now);
    this.medium.dht.set(key, validEntries);

    // Get up to count unique entries
    const results: Uint8Array[] = [];
    const seen = new Set<string>();

    for (const entry of validEntries) {
        if (results.length >= count) break;
        // Cross-environment friendly base64 encoding
        const str = typeof Buffer !== 'undefined'
            ? Buffer.from(entry.value).toString('base64')
            : btoa(String.fromCharCode.apply(null, entry.value as unknown as number[]));

        if (!seen.has(str)) {
            seen.add(str);
            results.push(entry.value);
        }
    }

    return results;
  }

  async dial(peerId: string, protocol: string): Promise<Stream> {
      throw new Error('Local dialing not implemented yet');
  }

  async publish(topic: string, data: Uint8Array): Promise<void> {
    if (!this._running) throw new Error('Network not running');

    if (this.medium.pubsub.has(topic)) {
        const handlers = this.medium.pubsub.get(topic)!;
        // Broadcast asynchronously to mimic real network latency
        handlers.forEach(handler => {
            setTimeout(() => {
                try {
                    handler(data);
                } catch (e) {
                    console.error("PubSub handler error:", e);
                }
            }, 5 + Math.random() * 20);
        });
    }
  }

  subscribe(topic: string, handler: (data: Uint8Array) => void): void {
    if (!this._running) throw new Error('Network not running');

    if (!this.medium.pubsub.has(topic)) {
        this.medium.pubsub.set(topic, new Set());
    }
    this.medium.pubsub.get(topic)!.add(handler);

    const eventName = `pubsub:${topic}`;
    if (!this.eventHandlers.has(eventName)) {
        this.eventHandlers.set(eventName, new Set());
    }
    this.on(eventName, handler);
  }

  unsubscribe(topic: string): void {
      if (!this._running) return;

      const eventName = `pubsub:${topic}`;
      const handlers = this.eventHandlers.get(eventName);

      if (handlers && this.medium.pubsub.has(topic)) {
          const globalHandlers = this.medium.pubsub.get(topic)!;
          handlers.forEach(h => globalHandlers.delete(h as any));
      }

      this.eventHandlers.delete(eventName);
  }

  isRunning(): boolean {
      return this._running;
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }
}
