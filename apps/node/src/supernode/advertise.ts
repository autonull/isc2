import type { DelegateCapability } from '@isc/protocol';
import { createDelegateCapability } from './capability.js';

export interface SupernodeConfig {
  peerID: string;
  services: ('embed' | 'ann_query' | 'sig_verify')[];
  rateLimit: {
    requestsPerMinute: number;
    maxConcurrent: number;
  };
  model: string;
  privateKey: CryptoKey;
  publicKey: Uint8Array;
  dht: DHTAdapter;
}

export interface DHTAdapter {
  put(key: string, value: Uint8Array, ttl: number): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

export class SupernodeAdvertiser {
  private config: SupernodeConfig;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: number;
  private capability: DelegateCapability | null = null;

  constructor(config: SupernodeConfig) {
    this.config = config;
    this.startTime = Date.now();
  }

  private calculateUptime(): number {
    return (Date.now() - this.startTime) / (24 * 60 * 60 * 1000);
  }

  async advertise(): Promise<DelegateCapability> {
    const uptime = Math.min(this.calculateUptime(), 1.0);

    const capability = createDelegateCapability(
      this.config.peerID,
      this.config.services,
      this.config.rateLimit,
      this.config.model,
      uptime,
      new Uint8Array()
    );

    const encoded = new TextEncoder().encode(JSON.stringify(capability));
    const signature = await this.signData(encoded);
    capability.signature = signature;

    this.capability = capability;

    const dhtKey = `/isc/delegate/${this.config.peerID}`;
    const ttl = 300;
    await this.config.dht.put(dhtKey, encoded, ttl);

    return capability;
  }

  private async signData(data: Uint8Array): Promise<Uint8Array> {
    const signature = await crypto.subtle.sign(
      { name: 'Ed25519' },
      this.config.privateKey,
      data.buffer as ArrayBuffer
    );
    return new Uint8Array(signature);
  }

  start(intervalMs: number = 4 * 60 * 1000): void {
    this.advertise();
    this.refreshInterval = setInterval(() => {
      this.advertise().catch((err) => {
        console.error('Failed to advertise capability:', err);
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  getCapability(): DelegateCapability | null {
    return this.capability;
  }

  isAdvertising(): boolean {
    return this.refreshInterval !== null;
  }
}
