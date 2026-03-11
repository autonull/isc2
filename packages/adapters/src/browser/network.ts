import type { NetworkAdapter, Stream } from '../interfaces/network.js';

export interface BrowserNetworkConfig {
  bootstrapNodes?: string[];
  maxConnections?: number;
  maxInbound?: number;
}

const DEFAULT_BOOTSTRAP_NODES = [
  '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SznbYGzPwpkqDrqEf',
  '/ip4/104.131.131.82/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT5887gRqQofnZ6Gqiq5KhCvv6ip',
];

export class BrowserNetworkAdapter implements NetworkAdapter {
  private eventHandlers = new Map<string, Set<Function>>();
  private dht = new Map<string, Uint8Array[]>();
  private _config: Required<BrowserNetworkConfig>;
  private peerId: string;
  private _running = false;

  constructor(config: BrowserNetworkConfig = {}) {
    this._config = {
      bootstrapNodes: config.bootstrapNodes ?? DEFAULT_BOOTSTRAP_NODES,
      maxConnections: config.maxConnections ?? 50,
      maxInbound: config.maxInbound ?? 20,
    };
    this.peerId = `peer_${crypto.randomUUID().slice(0, 8)}`;
  }

  async start(): Promise<void> {
    this._running = true;
    console.log(`[Network] Started with peerId: ${this.peerId}`);
  }
  async stop(): Promise<void> {
    this._running = false;
    console.log('[Network] Stopped');
  }
  getPeerId(): string {
    return this.peerId;
  }

  async announce(key: string, value: Uint8Array, ttl: number): Promise<void> {
    this.dht.set(key, [value]);
    setTimeout(() => {
      const existing = this.dht.get(key);
      if (existing?.length) {
        existing.shift();
      } else {
        this.dht.delete(key);
      }
    }, ttl * 1000);
  }

  async query(key: string, count: number): Promise<Uint8Array[]> {
    return (this.dht.get(key) ?? []).slice(0, count);
  }

  async dial(peerId: string, _protocol: string): Promise<Stream> {
    const decoder = new TextDecoder();
    const messageQueue: Uint8Array[] = [];

    return {
      source: {
        async *[Symbol.asyncIterator]() {
          while (true) {
            if (messageQueue.length > 0) yield messageQueue.shift()!;
            else await new Promise<void>((resolve) => setTimeout(resolve, 100));
          }
        },
      },
      sink: async (iterable: AsyncIterable<Uint8Array>) => {
        for await (const chunk of iterable)
          console.log(`[Network] Sent to ${peerId}:`, decoder.decode(chunk));
      },
    };
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set());
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }
}
