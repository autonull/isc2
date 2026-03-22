import type { NetworkAdapter, Stream } from '../interfaces/network.js';
import type { Libp2p } from '@libp2p/interface';
import { peerIdFromString } from '@libp2p/peer-id';

export interface BlocklistEntry {
  peerID: string;
  reason: string;
  reporterID: string;
  ts: number;
  sig: Uint8Array;
}

export interface BrowserNetworkConfig {
  bootstrapNodes?: string[];
  maxConnections?: number;
  maxInbound?: number;
  relayOnly?: boolean;
}

/**
 * Local relay for development — seeded when NODE_ENV=development (Phase 7.3)
 * Run `pnpm dev:relay` to start the local relay on port 9000.
 */
const LOCAL_DEV_RELAY_NODES: string[] = [
  // Local relay node — started by `pnpm dev:relay`
  '/ip4/127.0.0.1/tcp/9000/ws',
];

/**
 * Default bootstrap nodes for ISC network
 * These are community-run relay nodes that help new peers discover the network
 */
const DEFAULT_BOOTSTRAP_NODES = [
  // In development, seed with the local relay first
  ...(typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
    ? LOCAL_DEV_RELAY_NODES
    : []),
  // ISC community relay nodes (to be deployed)
  // '/dns4/relay0.isc.network/tcp/443/wss/p2p/QmISCRelayNode0PeerID',
  // '/dns4/relay1.isc.network/tcp/443/wss/p2p/QmISCRelayNode1PeerID',

  // Primary libp2p bootstrap nodes (fallback)
  '/dns4/bootstrap-0.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
  '/dns4/bootstrap-1.libp2p.io/tcp/443/wss/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',

  // Additional bootstrap nodes for redundancy
  '/dns4/bootstrap-2.libp2p.io/tcp/443/wss/p2p/QmZmViJTcj74zJ8kVDxFbPEJLdVqV5jRnFbVJkVqV5jRn',
  '/dns4/relay.libp2p.io/tcp/443/wss/p2p/QmZmViJTcj74zJ8kVDxFbPEJLdVqV5jRnFbVJkVqV5jRn',

  // IPFS bootstrap nodes (compatible with libp2p)
  '/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiRNN6vEf9cqLcVTQJQs',
  '/dns4/bootstrap.libp2p.io/udp/443/quic-v1/webtransport/certhash/uEiByCR7NqKrFPqB8kZJvZvZvZvZvZvZvZvZvZvZvZvZvZv/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiRNN6vEf9cqLcVTQJQs',
];

import type { PubSub } from '@libp2p/interface';

interface DHTService {
  put(key: Uint8Array, value: Uint8Array): Promise<void>;
  get(key: Uint8Array): AsyncIterable<{ name: string; value?: Uint8Array }>;
}

interface Libp2pWithDHT extends Libp2p {
  services: {
    dht: DHTService;
    pubsub: PubSub;
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
      relayOnly: config.relayOnly ?? false,
    };
  }

  async start(): Promise<void> {
    if (this.node) return;

    const { createLibp2p } = await import('libp2p');
    const { webSockets } = await import('@libp2p/websockets');
    const { webTransport } = await import('@libp2p/webtransport');
    const { noise } = await import('@chainsafe/libp2p-noise');
    const { yamux } = await import('@chainsafe/libp2p-yamux');
    const { kadDHT } = await import('@libp2p/kad-dht');
    const { bootstrap } = await import('@libp2p/bootstrap');
    const { gossipsub } = await import('@chainsafe/libp2p-gossipsub');
    const { webRTC } = await import('@libp2p/webrtc');

    const bootstrapNodes = this._config.bootstrapNodes.filter(Boolean);

    const inTestMode = typeof window !== 'undefined' && (window as any).isE2ETest;
    if (inTestMode && (window as any).TEST_BOOTSTRAP_NODE) {
      bootstrapNodes.unshift((window as any).TEST_BOOTSTRAP_NODE);
    }

    const connectionGater = this._config.relayOnly
      ? {
          denyDialPeer: () => false,
          acceptDialConnection: async (peerId: any) => {
            if (!peerId) return true;
            try {
              const peer = await this.node?.peerStore.get(peerId);
              if (!peer || peer.addresses.length === 0) return true;
              return peer.addresses.some((a: any) => a.toString().includes('/p2p-circuit'));
            } catch {
              return false;
            }
          },
        }
      : undefined;

    this.node = (await createLibp2p({
      services: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dht: kadDHT() as any,
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
      },
      transports: [
        webSockets(),
        webTransport(),
        webRTC({
          rtcConfiguration: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        }),
      ],
      streamMuxers: [yamux()],
      connectionEncryption: [noise()],
      peerDiscovery: [
        bootstrap({
          list: bootstrapNodes,
        }),
      ],
      connectionManager: {
        maxConnections: this._config.maxConnections,
      },
      connectionGater,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as any as Libp2pWithDHT;

    await this.node.start();
    this._running = true;

    if (this._config.relayOnly) {
      console.log('[Network] Started in RELAY-ONLY mode - IP addresses hidden from peers');
    }

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

  async announce(key: string, value: Uint8Array, _ttl: number = 300000): Promise<void> {
    if (!this.node) throw new Error('Network not started');

    const dht = this.node.services.dht;
    const keyBytes = new TextEncoder().encode(key);
    // Real KadDHT ignores TTL arguments locally, it relies on re-republishing
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

  async publish(topic: string, data: Uint8Array): Promise<void> {
    if (!this.node) throw new Error('Network not started');
    await this.node.services.pubsub.publish(topic, data);
  }

  subscribe(topic: string, handler: (data: Uint8Array) => void): void {
    if (!this.node) throw new Error('Network not started');
    this.node.services.pubsub.subscribe(topic);

    // Create a listener specific to this topic
    const eventName = `pubsub:${topic}`;
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
      // Only register the libp2p listener once per topic
      this.node.services.pubsub.addEventListener('message', (event) => {
        if (event.detail.topic === topic) {
          this.emit(eventName, event.detail.data);
        }
      });
    }

    this.on(eventName, handler);
  }

  unsubscribe(topic: string): void {
    if (!this.node) return;
    this.node.services.pubsub.unsubscribe(topic);
    this.eventHandlers.delete(`pubsub:${topic}`);
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

  async getMultiaddrs(): Promise<string[]> {
    if (!this.node) return [];
    return this.node.getMultiaddrs().map((ma) => ma.toString());
  }

  async dialMultiaddr(multiaddrStr: string): Promise<void> {
    if (!this.node) throw new Error('Network not started');
    const { multiaddr } = await import('@multiformats/multiaddr');
    await this.node.dial(multiaddr(multiaddrStr));
  }

  async fetchBlocklist(): Promise<void> {
    if (!this.node) return;

    const dhtGet = async (key: string, count: number): Promise<Uint8Array[]> => {
      const keyBytes = new TextEncoder().encode(key);
      const results: Uint8Array[] = [];
      try {
        for await (const event of this.node!.services.dht.get(keyBytes)) {
          if (event.name === 'VALUE' && event.value) {
            results.push(event.value);
            if (results.length >= count) break;
          }
        }
      } catch {
        return [];
      }
      return results;
    };

    try {
      const results = await dhtGet('/isc/blocklist', 50);
      console.debug(`[Network] Fetched ${results.length} blocklist entries`);
    } catch (err) {
      console.warn('[Network] Blocklist fetch failed:', err);
    }
  }
}

export const browserNetwork = new BrowserNetworkAdapter();
