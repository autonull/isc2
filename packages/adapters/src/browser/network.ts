import type { NetworkAdapter, Stream } from '../interfaces/network.js';
import type { Libp2p } from '@libp2p/interface';
import { peerIdFromString } from '@libp2p/peer-id';

export interface BrowserNetworkConfig {
  bootstrapNodes?: string[];
  maxConnections?: number;
  maxInbound?: number;
}

const DEFAULT_BOOTSTRAP_NODES = [
  '/dns4/bootstrap-0.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dns4/bootstrap-1.libp2p.io/tcp/443/wss/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
];

interface DHTService {
  put(key: Uint8Array, value: Uint8Array): Promise<void>;
  get(key: Uint8Array): AsyncIterable<{ name: string; value?: Uint8Array }>;
}

interface Libp2pWithDHT extends Libp2p {
  services: {
    dht: DHTService;
  };
}

interface Libp2pStream {
  source: AsyncIterable<Uint8Array>;
  sink: (source: AsyncIterable<Uint8Array>) => Promise<void>;
}

export class BrowserNetworkAdapter implements NetworkAdapter {
  private node: Libp2pWithDHT | null = null;
  private eventHandlers = new Map<string, Set<Function>>();
  private _config: Required<BrowserNetworkConfig>;
  private _running = false;

  constructor(config: BrowserNetworkConfig = {}) {
    this._config = {
      bootstrapNodes: config.bootstrapNodes ?? DEFAULT_BOOTSTRAP_NODES,
      maxConnections: config.maxConnections ?? 50,
      maxInbound: config.maxInbound ?? 20,
    };
  }

  async start(): Promise<void> {
    if (this.node) return;

    // Dynamic import to avoid bundling issues
    const { createLibp2p } = await import('libp2p');
    const { webSockets } = await import('@libp2p/websockets');
    const { webTransport } = await import('@libp2p/webtransport');
    const { noise } = await import('@chainsafe/libp2p-noise');
    const { yamux } = await import('@chainsafe/libp2p-yamux');
    const { kadDHT } = await import('@libp2p/kad-dht');
    const { bootstrap } = await import('@libp2p/bootstrap');

    const bootstrapNodes = this._config.bootstrapNodes.filter(Boolean);

    this.node = (await createLibp2p({
      services: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dht: kadDHT() as any,
      },
      transports: [webSockets(), webTransport()],
      streamMuxers: [yamux()],
      connectionEncrypters: [noise()],
      peerDiscovery: [
        bootstrap({
          list: bootstrapNodes,
        }),
      ],
      connectionManager: {
        maxConnections: this._config.maxConnections,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any) as Libp2pWithDHT;

    await this.node.start();
    this._running = true;

    this.node.addEventListener('peer:discovery', (event) => {
      this.emit('peer:discovery', event.detail);
    });

    this.node.addEventListener('peer:connect', (event) => {
      this.emit('peer:connect', event.detail);
    });

    this.node.addEventListener('peer:disconnect', (event) => {
      this.emit('peer:disconnect', event.detail);
    });

    console.log(`[Network] Started with peerId: ${this.node.peerId.toString()}`);
  }

  async stop(): Promise<void> {
    if (!this.node) return;
    await this.node.stop();
    this.node = null;
    this._running = false;
    console.log('[Network] Stopped');
  }

  getPeerId(): string {
    return this.node?.peerId.toString() ?? '';
  }

  async announce(key: string, value: Uint8Array): Promise<void> {
    if (!this.node) throw new Error('Network not started');

    const dht = this.node.services.dht;
    const keyBytes = new TextEncoder().encode(key);
    await dht.put(keyBytes, value);
  }

  async query(key: string, count: number): Promise<Uint8Array[]> {
    if (!this.node) throw new Error('Network not started');

    const dht = this.node.services.dht;
    const keyBytes = new TextEncoder().encode(key);

    try {
      const results: Uint8Array[] = [];
      for await (const event of dht.get(keyBytes)) {
        if (event.name === 'VALUE' && event.value) {
          results.push(event.value);
          if (results.length >= count) break;
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  async dial(peerId: string, protocol: string): Promise<Stream> {
    if (!this.node) throw new Error('Network not started');

    const peer = await this.node.peerStore.get(peerIdFromString(peerId));

    if (!peer.addresses.length) {
      throw new Error(`No addresses known for peer ${peerId}`);
    }

    const connection = await this.node.dial(peer.id);
    const stream = (await connection.newStream(protocol)) as unknown as Libp2pStream;

    return {
      source: stream.source,
      sink: stream.sink,
    };
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

  private emit(event: string, data: any): void {
    this.eventHandlers.get(event)?.forEach((handler) => handler(data));
  }

  isRunning(): boolean {
    return this._running;
  }

  getConnectionCount(): number {
    return this.node?.getConnections().length ?? 0;
  }

  async getConnectedPeers(): Promise<string[]> {
    if (!this.node) return [];
    return this.node.getConnections().map((conn) => conn.remotePeer.toString());
  }
}

export const browserNetwork = new BrowserNetworkAdapter();
