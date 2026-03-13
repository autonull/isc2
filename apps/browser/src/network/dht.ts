/**
 * Real libp2p DHT Client for Browser
 *
 * No mocks - actual P2P networking with Kademlia DHT
 */

import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT, KadDHT } from '@libp2p/kad-dht';
import { bootstrap } from '@libp2p/bootstrap';
import type { Libp2p } from 'libp2p';
import { checkQueryRate, checkAnnounceRate } from '../rateLimit.js';
import { verifySignature, isPeerBlocked } from '../crypto/verifier.js';
import { sign, encode, type Signature } from '@isc/core';
import { getKeypair } from '../identity/index.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.dht;

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

export interface SignedAnnouncement {
  peerID: string;
  channelID: string;
  model: string;
  vec: number[];
  relTag?: string;
  ttl: number;
  updatedAt: number;
  signature?: Uint8Array | string;
  publicKey?: string;
}

export class RealDHTClient {
  private node: Libp2p | null = null;
  private dht: KadDHT | null = null;
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

      this.dht = this.node.services.dht as KadDHT;

      // Wait for DHT to be ready
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 3000);
      });

      logger.info('Initialized', {
        peerId: this.node.peerId.toString(),
        multiaddrs: this.node.getMultiaddrs().map(m => m.toString()),
      });
    } catch (error) {
      logger.error('Initialization failed', error as Error, {});
      throw error;
    }
  }

  /**
   * Get the underlying libp2p node for protocol dialing
   */
  getNode(): Libp2p | null {
    return this.node;
  }

  async announce(key: string, value: Uint8Array, ttl?: number): Promise<void> {
    if (!this.dht) {
      throw new Error('DHT not initialized');
    }

    // Rate limit check
    const peerId = this.getPeerId();
    const rateCheck = checkAnnounceRate(peerId);
    if (!rateCheck.allowed) {
      const reason = rateCheck.blocked ? 'blocked' : 'rate limited';
      logger.warn('Announce rejected', { reason, peerId });
      throw new Error(
        rateCheck.blocked
          ? `Announce blocked due to repeated violations. Try again in ${rateCheck.retryAfter}s`
          : `Announce rate limit exceeded. Try again in ${rateCheck.retryAfter}s`
      );
    }

    const ttlToUse = ttl || this.config.announceTTL!;
    const expiresAt = Date.now() + ttlToUse * 1000;

    try {
      // Sign the payload if we have a keypair
      let signedValue = value;
      const keypair = getKeypair();
      
      if (keypair) {
        try {
          // Decode the value to add signature
          const decoded = JSON.parse(new TextDecoder().decode(value));
          
          // Create signature over the payload (without signature field)
          const { signature: _, ...payloadForSigning } = decoded;
          const payloadBytes = encode(payloadForSigning);
          const signature: Signature = await sign(payloadBytes, keypair.privateKey);
          
          // Export public key for verification by others
          const publicKeyBytes = await crypto.subtle.exportKey('raw', keypair.publicKey);
          
          // Add signature and public key to payload
          const signedPayload = {
            ...decoded,
            signature: Array.from(signature.data),
            publicKey: Array.from(new Uint8Array(publicKeyBytes)),
          };
          
          signedValue = new TextEncoder().encode(JSON.stringify(signedPayload));
        } catch (signErr) {
          logger.warn('Failed to sign announcement', { error: (signErr as Error).message });
          // Continue with unsigned announcement
        }
      }

      // Put to DHT
      const keyBytes = new TextEncoder().encode(key);
      await this.dht.put(keyBytes, signedValue);

      // Cache locally
      this.entryCache.set(key, {
        entry: { key, value: signedValue, ttl: ttlToUse },
        expiresAt,
      });
      this.announcedKeys.add(key);

      logger.info('Announced', { key, signed: signedValue !== value });
    } catch (error) {
      logger.error('Announce failed', error as Error, { key });
      throw error;
    }
  }

  async query(key: string, count: number = 20): Promise<Uint8Array[]> {
    if (!this.dht) {
      throw new Error('DHT not initialized');
    }

    // Rate limit check
    const peerId = this.getPeerId();
    const rateCheck = checkQueryRate(peerId);
    if (!rateCheck.allowed) {
      const reason = rateCheck.blocked ? 'blocked' : 'rate limited';
      logger.warn('Query rejected', { reason, peerId });
      throw new Error(
        rateCheck.blocked
          ? `Query blocked due to repeated violations. Try again in ${rateCheck.retryAfter}s`
          : `Query rate limit exceeded. Try again in ${rateCheck.retryAfter}s`
      );
    }

    try {
      const results: Uint8Array[] = [];

      // Query DHT
      const keyBytes = new TextEncoder().encode(key);
      
      // Iterate over DHT results
      for await (const event of this.dht.get(keyBytes)) {
        // Check if this is a GetValueEvent with value property
        if ('value' in event && event.value) {
          const value = event.value;
          
          // Verify signature if present
          try {
            const decoded = JSON.parse(new TextDecoder().decode(value)) as SignedAnnouncement;

            if (decoded.signature && decoded.publicKey) {
              // Check if peer is blocked
              if (isPeerBlocked(decoded.peerID)) {
                logger.warn('Ignoring announcement from blocked peer', { peerId: decoded.peerID });
                return results;
              }

              // Import public key and verify
              const publicKeyBytes = this.hexToBytes(decoded.publicKey);
              const publicKey = await crypto.subtle.importKey(
                'raw',
                publicKeyBytes.buffer as ArrayBuffer,
                { name: 'Ed25519' },
                true,
                ['verify']
              );

              const verificationResult = await verifySignature(decoded, publicKey, decoded.peerID);
              
              if (!verificationResult.valid) {
                logger.warn('Invalid signature in announcement', { reason: verificationResult.reason });
                continue; // Skip invalid, continue with other results
              }
            }
          } catch (err) {
            logger.warn('Signature verification failed', { error: (err as Error).message });
            // Continue anyway - some announcements may not have signatures
          }

          results.push(value);
        }
      }

      logger.info('Query completed', { key, count: results.length });
      return results;
    } catch (error) {
      logger.error('Query failed', error as Error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
      this.dht = null;
      logger.info('Closed');
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

  /**
   * Convert hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
      parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    );
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
