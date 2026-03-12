/**
 * Real libp2p DHT Client for Browser
 * 
 * No mocks - actual P2P networking with Kademlia DHT
 */

import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { bootstrap } from '@libp2p/bootstrap';
import type { Libp2p } from 'libp2p';

// Bootstrap peers (public libp2p relays)
const BOOTSTRAP_PEERS = [
  '/dns4/relay.libp2p.io/tcp/443/wss/p2p/QmZmViJTcj74zJ8kVDxFbPEJLdVqV5jRnFbVJkVqV5jRn',
];

export interface DHTEntry {
  key: string;
  value: Uint8Array;
  ttl: number;
}

export interface PeerInfo {
  peerId: string;
  channelID: string;
  model: string;
  vec: number[];
  relTag?: string;
  ttl: number;
  updatedAt: number;
}

export interface DHTClientConfig {
  bootstrapPeers?: string[];
  announceTTL?: number; // seconds
}

export class RealDHTClient {
  private node: Libp2p | null = null;
  private dht: any = null; // Using any to avoid complex type issues
  private config: DHTClientConfig;
  private announcedKeys: Set<string> = new Set();
  private entryCache: Map<string, { entry: DHTEntry; expiresAt: number }> = new Map();

  constructor(config: DHTClientConfig = {}) {
    this.config = {
      bootstrapPeers: BOOTSTRAP_PEERS,
      announceTTL: 300, // 5 minutes
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.node) {
      return; // Already initialized
    }

    try {
      // Create libp2p node with kad-dht service
      this.node = await createLibp2p({
        transports: [webSockets()],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [
          bootstrap({
            list: this.config.bootstrapPeers!,
          }),
        ],
        services: {
          dht: kadDHT({
            kBucketSize: 20,
          }) as any, // Cast to any to bypass complex type issues
        },
      });

      this.dht = this.node.services.dht;

      // Wait for DHT to be ready
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 3000);
      });

      console.log('[DHT] Initialized', {
        peerId: this.node.peerId.toString(),
        multiaddrs: this.node.getMultiaddrs().map(m => m.toString()),
      });
    } catch (error) {
      console.error('[DHT] Initialization failed:', error);
      throw error;
    }
  }

  async announce(key: string, value: Uint8Array, ttl?: number): Promise<void> {
    if (!this.dht) {
      throw new Error('DHT not initialized');
    }

    const ttlToUse = ttl || this.config.announceTTL!;
    const expiresAt = Date.now() + ttlToUse * 1000;

    try {
      // Put to DHT
      const keyBytes = new TextEncoder().encode(key);
      await this.dht.put(keyBytes, value);

      // Cache locally
      this.entryCache.set(key, {
        entry: { key, value, ttl: ttlToUse },
        expiresAt,
      });
      this.announcedKeys.add(key);

      console.log('[DHT] Announced:', key);
    } catch (error) {
      console.error('[DHT] Announce failed:', key, error);
      throw error;
    }
  }

  async query(key: string, count: number = 20): Promise<Uint8Array[]> {
    if (!this.dht) {
      throw new Error('DHT not initialized');
    }

    try {
      const results: Uint8Array[] = [];
      
      // Query DHT
      const keyBytes = new TextEncoder().encode(key);
      const result = await this.dht.get(keyBytes);

      if (result) {
        results.push(result);
      }

      console.log('[DHT] Query:', key, 'found', results.length, 'entries');
      return results;
    } catch (error) {
      console.error('[DHT] Query failed:', key, error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
      this.dht = null;
      console.log('[DHT] Closed');
    }
  }

  getPeerId(): string {
    return this.node?.peerId.toString() || '';
  }

  isConnected(): boolean {
    return this.node !== null;
  }

  getConnectionCount(): number {
    return this.node?.getConnections().length || 0;
  }
}

// Singleton instance
let dhtClientInstance: RealDHTClient | null = null;

export function getDHTClient(): RealDHTClient {
  if (!dhtClientInstance) {
    dhtClientInstance = new RealDHTClient();
  }
  return dhtClientInstance;
}

export async function initializeDHT(): Promise<RealDHTClient> {
  const client = getDHTClient();
  await client.initialize();
  return client;
}
