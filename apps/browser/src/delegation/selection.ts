import type { DelegationHealth } from '@isc/protocol/messages';
import type { DHTAdapter } from './discovery.js';

export interface HealthSelectionConfig {
  dht: DHTAdapter;
  cacheTTL: number;
  minSuccessRate: number;
}

interface CachedHealth {
  health: DelegationHealth;
  timestamp: number;
}

export class HealthSelector {
  private config: HealthSelectionConfig;
  private healthCache: Map<string, CachedHealth> = new Map();

  constructor(config: HealthSelectionConfig) {
    this.config = config;
  }

  async fetchHealthMetrics(peerIDs: string[]): Promise<Map<string, DelegationHealth>> {
    const results = new Map<string, DelegationHealth>();

    await Promise.all(
      peerIDs.map(async (peerID) => {
        const cached = this.healthCache.get(peerID);
        if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
          results.set(peerID, cached.health);
          return;
        }

        try {
          const entry = await this.config.dht.get(`/isc/health/${peerID}`);
          if (entry) {
            const decoder = new TextDecoder();
            const health: DelegationHealth = JSON.parse(decoder.decode(entry));

            if (this.isValidHealth(health)) {
              this.healthCache.set(peerID, { health, timestamp: Date.now() });
              results.set(peerID, health);
            }
          }
        } catch {
          if (cached) results.set(peerID, cached.health);
        }
      })
    );

    return results;
  }

  private isValidHealth(health: DelegationHealth): boolean {
    if (health.type !== 'delegation_health') return false;
    if (!health.peerID || !health.signature) return false;
    if (Date.now() - health.timestamp > this.config.cacheTTL) return false;
    if (health.successRate < 0 || health.successRate > 1) return false;
    if (health.avgLatencyMs < 0) return false;
    if (health.requestsServed24h < 0) return false;
    return true;
  }

  filterByHealth(healthMap: Map<string, DelegationHealth>): Map<string, DelegationHealth> {
    const filtered = new Map<string, DelegationHealth>();
    for (const [peerID, health] of healthMap) {
      if (health.successRate >= this.config.minSuccessRate) {
        filtered.set(peerID, health);
      }
    }
    return filtered;
  }

  getHealthyPeerIDs(
    capabilities: { peerID: string }[],
    healthMap: Map<string, DelegationHealth>
  ): string[] {
    return capabilities.filter((cap) => {
      const health = healthMap.get(cap.peerID);
      return !health || health.successRate >= this.config.minSuccessRate;
    }).map((cap) => cap.peerID);
  }

  clearCache(): void {
    this.healthCache.clear();
  }

  invalidateCache(peerID: string): void {
    this.healthCache.delete(peerID);
  }
}
