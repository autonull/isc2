export interface IPMetadata {
  region?: string;
  country?: string;
  networkType: 'residential' | 'datacenter' | 'mobile' | 'unknown';
  natType: 'open' | 'moderate' | 'strict' | 'unknown';
  timestamp: number;
  ipHash: string;
}

export interface RelayNode {
  id: string;
  publicKey: Uint8Array;
  address: string;
  port: number;
  latency: number;
  reliability: number;
  lastSeen: number;
}

export interface Circuit {
  id: string;
  hops: RelayNode[];
  createdAt: number;
  expiresAt: number;
  bytesTransferred: number;
  active: boolean;
}

export interface IPProtectionConfig {
  enableOnionRouting: boolean;
  minHops: number;
  maxHops: number;
  circuitLifetimeMs: number;
  enableIPMasking: boolean;
  locationGranularity: 'country' | 'region' | 'city';
  enableConnectionPooling: boolean;
  poolSize: number;
  maxConnectionsPerIP: number;
  timeWindowMs: number;
}

const DEFAULT_CONFIG: IPProtectionConfig = {
  enableOnionRouting: false,
  minHops: 2,
  maxHops: 4,
  circuitLifetimeMs: 600000,
  enableIPMasking: true,
  locationGranularity: 'country',
  enableConnectionPooling: true,
  poolSize: 5,
  maxConnectionsPerIP: 10,
  timeWindowMs: 60000,
};

export async function hashIPAddress(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(ip));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function extractCoarseLocation(ip: string, granularity: 'country' | 'region' | 'city' = 'country'): { country?: string; region?: string } {
  const hash = ip.split('.').reduce((acc, octet) => acc + parseInt(octet), 0);
  const regions = ['us-east', 'us-west', 'eu-west', 'eu-east', 'asia-pacific'];
  const countries = ['US', 'DE', 'JP', 'BR', 'AU'];

  return {
    country: countries[hash % countries.length],
    region: granularity !== 'country' ? regions[hash % regions.length] : undefined,
  };
}

export async function detectNATType(): Promise<'open' | 'moderate' | 'strict' | 'unknown'> {
  return 'unknown';
}

export async function createIPMetadata(ip: string, config: IPProtectionConfig = DEFAULT_CONFIG): Promise<IPMetadata> {
  const location = config.enableIPMasking ? extractCoarseLocation(ip, config.locationGranularity) : {};
  const natType = await detectNATType();
  const hourAgo = Date.now() - (Date.now() % 3600000);

  return { ...location, networkType: 'unknown', natType, timestamp: hourAgo, ipHash: await hashIPAddress(ip) };
}

export function selectRelayNodes(availableRelays: RelayNode[], config: IPProtectionConfig = DEFAULT_CONFIG): RelayNode[] {
  const hopCount = Math.floor(Math.random() * (config.maxHops - config.minHops + 1)) + config.minHops;
  if (availableRelays.length < hopCount) return availableRelays;

  const weightedRelays = availableRelays.map((relay) => ({ relay, weight: relay.reliability / (1 + relay.latency / 1000) }));
  const selected: RelayNode[] = [];
  const used = new Set<string>();

  while (selected.length < hopCount && used.size < availableRelays.length) {
    const totalWeight = weightedRelays.filter((r) => !used.has(r.relay.id)).reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedRelay: RelayNode | null = null;

    for (const { relay, weight } of weightedRelays) {
      if (used.has(relay.id)) continue;
      random -= weight;
      if (random <= 0) {
        selectedRelay = relay;
        break;
      }
    }

    if (selectedRelay && !used.has(selectedRelay.id)) {
      selected.push(selectedRelay);
      used.add(selectedRelay.id);
    }
  }

  return selected;
}

export function createCircuit(relays: RelayNode[], config: IPProtectionConfig = DEFAULT_CONFIG): Circuit {
  const now = Date.now();
  return {
    id: `circuit_${crypto.randomUUID()}`,
    hops: relays,
    createdAt: now,
    expiresAt: now + config.circuitLifetimeMs,
    bytesTransferred: 0,
    active: true,
  };
}

export function isCircuitValid(circuit: Circuit): boolean {
  return circuit.active && Date.now() < circuit.expiresAt;
}

export class ConnectionRateLimiter {
  private connections = new Map<string, { count: number; windowStart: number }>();

  constructor(private config: IPProtectionConfig = DEFAULT_CONFIG) {}

  allowConnection(ip: string): boolean {
    const now = Date.now();
    const existing = this.connections.get(ip);

    if (!existing) {
      this.connections.set(ip, { count: 1, windowStart: now });
      return true;
    }

    if (now - existing.windowStart > this.config.timeWindowMs) {
      this.connections.set(ip, { count: 1, windowStart: now });
      return true;
    }

    if (existing.count >= this.config.maxConnectionsPerIP) return false;
    existing.count++;
    return true;
  }

  getConnectionCount(ip: string): number {
    const existing = this.connections.get(ip);
    if (!existing) return 0;
    return Date.now() - existing.windowStart > this.config.timeWindowMs ? 0 : existing.count;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [ip, data] of this.connections.entries()) {
      if (now - data.windowStart > this.config.timeWindowMs * 2) {
        this.connections.delete(ip);
      }
    }
  }
}

export class ConnectionPool {
  private pool = new Map<string, { lastUsed: number; count: number }>();

  constructor(private config: IPProtectionConfig = DEFAULT_CONFIG) {}

  getConnectionId(): string {
    const now = Date.now();

    for (const [id, data] of this.pool.entries()) {
      if (data.count < this.config.poolSize && now - data.lastUsed < 300000) {
        data.lastUsed = now;
        data.count++;
        return id;
      }
    }

    const newId = `pool_${crypto.randomUUID()}`;
    this.pool.set(newId, { lastUsed: now, count: 1 });
    return newId;
  }

  releaseConnection(id: string): void {
    const data = this.pool.get(id);
    if (data) data.count = Math.max(0, data.count - 1);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, data] of this.pool.entries()) {
      if (now - data.lastUsed > 600000 || data.count === 0) {
        this.pool.delete(id);
      }
    }
  }

  getStats(): { activeConnections: number; totalUsage: number; avgUsagePerConnection: number } {
    const connections = Array.from(this.pool.values());
    const totalUsage = connections.reduce((sum, c) => sum + c.count, 0);
    return {
      activeConnections: connections.length,
      totalUsage,
      avgUsagePerConnection: connections.length > 0 ? totalUsage / connections.length : 0,
    };
  }
}

export function anonymizeRequestMetadata(metadata: { ip?: string; userAgent?: string; timestamp?: number }): {
  ipHash?: string;
  browserFamily?: string;
  timeBucket: number;
} {
  const result: { ipHash?: string; browserFamily?: string; timeBucket: number } = {
    timeBucket: metadata.timestamp ? Math.floor(metadata.timestamp / 3600000) : 0,
  };

  if (metadata.ip) {
    result.ipHash = metadata.ip.split('.').map((_, i, arr) => (i >= 2 ? '0' : arr[i])).join('.');
  }

  if (metadata.userAgent) {
    const ua = metadata.userAgent.toLowerCase();
    result.browserFamily = ua.includes('firefox') ? 'firefox' : ua.includes('chrome') ? 'chromium' : ua.includes('safari') ? 'webkit' : 'other';
  }

  return result;
}

export function generateNoiseTraffic(intervalMs: number, callback: () => void): ReturnType<typeof setInterval> {
  const jitter = () => intervalMs * (0.8 + Math.random() * 0.4);
  return setInterval(callback, jitter());
}

export function isDatacenterIP(ip: string): boolean {
  const datacenterPrefixes = ['35.', '52.', '13.', '40.', '104.'];
  return datacenterPrefixes.some((prefix) => ip.startsWith(prefix));
}

export async function getNetworkFingerprint(): Promise<string> {
  const characteristics = [navigator.language || 'unknown', screen.colorDepth || 0, new Date().getTimezoneOffset()].join('|');
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(characteristics));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
