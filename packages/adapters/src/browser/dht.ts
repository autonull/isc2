import type { NetworkAdapter } from '../interfaces/network.js';
import { lshHash } from '@isc/core';

export interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number;
  relations: Relation[];
  createdAt: number;
  updatedAt: number;
  active: boolean;
}

export interface Relation {
  tag: string;
  object?: string;
  weight?: number;
}

export interface Distribution {
  mu: number[];
  sigma: number;
  tag?: string;
  weight?: number;
}

export interface SignedAnnouncement {
  peerID: string;
  channelID: string;
  model: string;
  vec: number[];
  relTag?: string;
  ttl: number;
  updatedAt: number;
  signature: Uint8Array;
}

export interface DHTConfig {
  network: NetworkAdapter;
  getSigningKey: () => Promise<CryptoKeyPair>;
  modelHash: string;
  tier: 'high' | 'mid' | 'low' | 'minimal';
}

const TTL_BY_TIER = { high: 300, mid: 600, low: 900, minimal: 1800 } as const;

export class DHTClient {
  private config: DHTConfig;
  private announcementIntervals = new Map<string, number>();
  private activeChannels = new Set<string>();

  constructor(config: DHTConfig) {
    this.config = config;
  }

  async announceChannel(channel: Channel, distributions: Distribution[]): Promise<void> {
    const rootDist = distributions[0];
    if (!rootDist) throw new Error('Channel has no root distribution');

    const hashes = lshHash(rootDist.mu, channel.id, 8, 16);
    const keypair = await this.config.getSigningKey();
    const timestamp = Date.now();
    const payload = new TextEncoder().encode(
      JSON.stringify({
        channelID: channel.id,
        model: this.config.modelHash,
        vec: rootDist.mu,
        updatedAt: timestamp,
      })
    );

    const signature = await globalThis.crypto.subtle.sign(
      { name: 'Ed25519' },
      keypair.privateKey,
      payload
    );

    const announcement: SignedAnnouncement = {
      peerID: this.getPeerId(),
      channelID: channel.id,
      model: this.config.modelHash,
      vec: rootDist.mu,
      ttl: TTL_BY_TIER[this.config.tier],
      updatedAt: timestamp,
      signature: new Uint8Array(signature),
    };

    const encoded = new TextEncoder().encode(JSON.stringify(announcement));
    for (const hash of hashes) {
      await this.config.network.announce(
        `/isc/announce/${this.config.modelHash}/${hash}`,
        encoded,
        announcement.ttl
      );
    }

    this.activeChannels.add(channel.id);
    this.startAnnouncementLoop(channel, distributions);
  }

  async queryProximals(queryVector: number[], count: number = 50): Promise<SignedAnnouncement[]> {
    const hashes = lshHash(queryVector, 'query', 8, 16);
    const results = new Map<string, SignedAnnouncement>();

    for (const hash of hashes) {
      const values = await this.config.network.query(
        `/isc/announce/${this.config.modelHash}/${hash}`,
        count
      );
      for (const value of values) {
        try {
          const announcement = JSON.parse(new TextDecoder().decode(value)) as SignedAnnouncement;
          if (await this.verifyAnnouncement(announcement)) {
            results.set(announcement.peerID + announcement.channelID, announcement);
          }
        } catch {
          // skip invalid
        }
      }
    }

    return Array.from(results.values()).slice(0, count);
  }

  async deactivateChannel(channelId: string): Promise<void> {
    this.activeChannels.delete(channelId);
    const intervalId = this.announcementIntervals.get(channelId);
    if (intervalId) {
      clearInterval(intervalId);
      this.announcementIntervals.delete(channelId);
    }
  }

  private startAnnouncementLoop(channel: Channel, distributions: Distribution[]): void {
    const existingInterval = this.announcementIntervals.get(channel.id);
    if (existingInterval) clearInterval(existingInterval);

    const refreshInterval = TTL_BY_TIER[this.config.tier] * 1000 * 0.8;
    const intervalId = window.setInterval(async () => {
      if (!this.activeChannels.has(channel.id)) {
        clearInterval(intervalId);
        return;
      }
      try {
        await this.announceChannel(channel, distributions);
      } catch (error) {
        console.error(`Failed to refresh announcement for ${channel.id}:`, error);
      }
    }, refreshInterval);

    this.announcementIntervals.set(channel.id, intervalId);
  }

  private async verifyAnnouncement(announcement: SignedAnnouncement): Promise<boolean> {
    try {
      if (announcement.model !== this.config.modelHash) return false;

      const payload = new TextEncoder().encode(
        JSON.stringify({
          channelID: announcement.channelID,
          model: announcement.model,
          vec: announcement.vec,
          updatedAt: announcement.updatedAt,
        })
      );
      const keyData = this.peerIdToBytes(announcement.peerID);
      const key = await globalThis.crypto.subtle.importKey(
        'raw',
        keyData.buffer as ArrayBuffer,
        { name: 'Ed25519' },
        true,
        ['verify']
      );

      return await globalThis.crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        announcement.signature.buffer as ArrayBuffer,
        payload
      );
    } catch {
      return false;
    }
  }

  private getPeerId(): string {
    return (this.config.network as { getPeerId?: () => string }).getPeerId?.() ?? 'unknown';
  }

  private peerIdToBytes(peerId: string): Uint8Array {
    return Uint8Array.from({ length: 32 }, (_, i) => peerId.charCodeAt(i) || 0);
  }
}
