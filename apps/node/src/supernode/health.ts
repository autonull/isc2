/* eslint-disable */
import type { SupernodeHandler } from './handler.js';

export interface DelegationHealth {
  type: 'delegation_health';
  peerID: string;
  successRate: number;
  avgLatencyMs: number;
  requestsServed24h: number;
  timestamp: number;
  signature: Uint8Array;
}

export class HealthAnnouncer {
  private peerID: string;
  private handler: SupernodeHandler;
  private privateKey: CryptoKey;
  private dht: DHTAdapter;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(peerID: string, handler: SupernodeHandler, privateKey: CryptoKey, dht: DHTAdapter) {
    this.peerID = peerID;
    this.handler = handler;
    this.privateKey = privateKey;
    this.dht = dht;
  }

  async announce(): Promise<DelegationHealth> {
    const health: DelegationHealth = {
      type: 'delegation_health',
      peerID: this.peerID,
      successRate: this.handler.getSuccessRate(),
      avgLatencyMs: this.handler.getAvgLatency(),
      requestsServed24h: this.handler.getMetrics().requestsServed24h,
      timestamp: Date.now(),
      signature: new Uint8Array(),
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(
      JSON.stringify({
        type: health.type,
        peerID: health.peerID,
        successRate: health.successRate,
        avgLatencyMs: health.avgLatencyMs,
        requestsServed24h: health.requestsServed24h,
        timestamp: health.timestamp,
      })
    );

    const signature = await crypto.subtle.sign({ name: 'Ed25519' }, this.privateKey, data);
    health.signature = new Uint8Array(signature);

    const dhtKey = `/isc/health/${this.peerID}`;
    const encoded = encoder.encode(JSON.stringify(health));
    await this.dht.put(dhtKey, encoded, 300);

    return health;
  }

  start(intervalMs: number = 5 * 60 * 1000): void {
    this.announce();
    this.refreshInterval = setInterval(() => {
      this.announce().catch((err) => {
        console.error('Failed to announce health:', err);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

export interface DHTAdapter {
  put(key: string, value: Uint8Array, ttl: number): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}
