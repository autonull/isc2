/* eslint-disable */
import type { DelegateCapability } from '@isc/protocol/messages';

export interface SupernodeDiscoveryConfig {
  dht: DHTAdapter;
  requiredServices?: ('embed' | 'ann_query' | 'sig_verify')[];
  modelFilter?: string;
}

export interface DHTAdapter {
  get(key: string): Promise<Uint8Array | null>;
  getMany(keyPrefix: string, count: number): Promise<Uint8Array[]>;
}

export class SupernodeDiscovery {
  private config: SupernodeDiscoveryConfig;
  private cache: Map<string, { capability: DelegateCapability; timestamp: number }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000;

  constructor(config: SupernodeDiscoveryConfig) {
    this.config = config;
  }

  async discoverSupernodes(): Promise<DelegateCapability[]> {
    const capabilities: DelegateCapability[] = [];
    const seenPeerIDs = new Set<string>();

    try {
      const entries = await this.config.dht.getMany('/isc/delegate/', 100);

      for (const entry of entries) {
        try {
          const decoder = new TextDecoder();
          const cap = JSON.parse(decoder.decode(entry)) as DelegateCapability;

          if (seenPeerIDs.has(cap.peerID)) {continue;}
          seenPeerIDs.add(cap.peerID);

          if (!this.matchesRequirements(cap)) {continue;}

          this.cache.set(cap.peerID, { capability: cap, timestamp: Date.now() });
          capabilities.push(cap);
        } catch {
          continue;
        }
      }
    } catch (err) {
      console.warn('Failed to discover supernodes:', err);
    }

    return capabilities;
  }

  private matchesRequirements(cap: DelegateCapability): boolean {
    if (this.config.requiredServices && this.config.requiredServices.length > 0) {
      const hasAllServices = this.config.requiredServices.every((s) => cap.services.includes(s));
      if (!hasAllServices) {return false;}
    }

    if (this.config.modelFilter && cap.model !== this.config.modelFilter) {
      return false;
    }

    return true;
  }

  async getSupernode(peerID: string): Promise<DelegateCapability | null> {
    const cached = this.cache.get(peerID);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.capability;
    }

    try {
      const entry = await this.config.dht.get(`/isc/delegate/${peerID}`);
      if (!entry) {return null;}

      const decoder = new TextDecoder();
      const cap = JSON.parse(decoder.decode(entry)) as DelegateCapability;
      this.cache.set(peerID, { capability: cap, timestamp: Date.now() });
      return cap;
    } catch {
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  invalidateCache(peerID: string): void {
    this.cache.delete(peerID);
  }
}

/**
 * Query for proximal peers/supernodes
 * This is a convenience function for discovering nearby peers
 */
export async function queryProximals(
  dht: DHTAdapter,
  count: number = 20
): Promise<DelegateCapability[]> {
  const discovery = new SupernodeDiscovery({ dht });
  const supernodes = await discovery.discoverSupernodes();
  return supernodes.slice(0, count);
}
