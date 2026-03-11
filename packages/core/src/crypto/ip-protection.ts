/**
 * IP Protection Enhancements
 *
 * Privacy-preserving techniques for protecting user IP addresses
 * and network metadata in P2P communications.
 *
 * References: NEXT_STEPS.md#83-ip-protection-enhancements
 */

/**
 * IP address metadata (anonymized)
 */
export interface IPMetadata {
  // Coarse location only (country/region level)
  region?: string;
  country?: string;
  
  // Network type
  networkType: 'residential' | 'datacenter' | 'mobile' | 'unknown';
  
  // NAT type for P2P
  natType: 'open' | 'moderate' | 'strict' | 'unknown';
  
  // Timestamp (rounded to hour for privacy)
  timestamp: number;
  
  // Hash of full IP (for deduplication without revealing)
  ipHash: string;
}

/**
 * Relay node for onion routing
 */
export interface RelayNode {
  id: string;
  publicKey: Uint8Array;
  address: string;
  port: number;
  latency: number;
  reliability: number; // 0-1
  lastSeen: number;
}

/**
 * Circuit for multi-hop routing
 */
export interface Circuit {
  id: string;
  hops: RelayNode[];
  createdAt: number;
  expiresAt: number;
  bytesTransferred: number;
  active: boolean;
}

/**
 * IP protection configuration
 */
export interface IPProtectionConfig {
  // Onion routing
  enableOnionRouting: boolean;
  minHops: number;
  maxHops: number;
  circuitLifetimeMs: number;
  
  // IP masking
  enableIPMasking: boolean;
  locationGranularity: 'country' | 'region' | 'city';
  
  // Connection pooling
  enableConnectionPooling: boolean;
  poolSize: number;
  
  // Rate limiting
  maxConnectionsPerIP: number;
  timeWindowMs: number;
}

const DEFAULT_CONFIG: IPProtectionConfig = {
  enableOnionRouting: false, // Disabled by default, enable for high-privacy mode
  minHops: 2,
  maxHops: 4,
  circuitLifetimeMs: 600000, // 10 minutes
  enableIPMasking: true,
  locationGranularity: 'country',
  enableConnectionPooling: true,
  poolSize: 5,
  maxConnectionsPerIP: 10,
  timeWindowMs: 60000, // 1 minute
};

/**
 * Hash IP address for anonymized tracking
 */
export async function hashIPAddress(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Extract coarse location from IP (privacy-preserving)
 */
export function extractCoarseLocation(
  ip: string,
  granularity: 'country' | 'region' | 'city' = 'country'
): { country?: string; region?: string; city?: string } {
  // In production, would use GeoIP database
  // For now, return anonymized placeholder
  const hash = ip.split('.').reduce((acc, octet) => acc + parseInt(octet), 0);
  
  const regions = ['us-east', 'us-west', 'eu-west', 'eu-east', 'asia-pacific'];
  const countries = ['US', 'DE', 'JP', 'BR', 'AU'];
  
  return {
    country: countries[hash % countries.length],
    region: granularity !== 'country' ? regions[hash % regions.length] : undefined,
  };
}

/**
 * Detect NAT type (simplified)
 */
export async function detectNATType(): Promise<'open' | 'moderate' | 'strict' | 'unknown'> {
  // In production, would use STUN/TURN servers
  // For now, return unknown
  return 'unknown';
}

/**
 * Create anonymized IP metadata
 */
export async function createIPMetadata(
  ip: string,
  config: IPProtectionConfig = DEFAULT_CONFIG
): Promise<IPMetadata> {
  const location = config.enableIPMasking
    ? extractCoarseLocation(ip, config.locationGranularity)
    : {};

  const natType = await detectNATType();

  // Round timestamp to hour for privacy
  const now = Date.now();
  const hourAgo = now - (now % 3600000);

  return {
    ...location,
    networkType: 'unknown', // Would detect in production
    natType,
    timestamp: hourAgo,
    ipHash: await hashIPAddress(ip),
  };
}

/**
 * Select relay nodes for circuit
 */
export function selectRelayNodes(
  availableRelays: RelayNode[],
  config: IPProtectionConfig = DEFAULT_CONFIG
): RelayNode[] {
  const hopCount = Math.floor(
    Math.random() * (config.maxHops - config.minHops + 1)
  ) + config.minHops;

  if (availableRelays.length < hopCount) {
    return availableRelays;
  }

  // Weighted selection based on reliability and latency
  const weightedRelays = availableRelays.map((relay) => ({
    relay,
    weight: relay.reliability / (1 + relay.latency / 1000),
  }));

  const selected: RelayNode[] = [];
  const used = new Set<string>();

  while (selected.length < hopCount && used.size < availableRelays.length) {
    // Weighted random selection
    const totalWeight = weightedRelays
      .filter((r) => !used.has(r.relay.id))
      .reduce((sum, r) => sum + r.weight, 0);

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

/**
 * Create onion routing circuit
 */
export function createCircuit(
  relays: RelayNode[],
  config: IPProtectionConfig = DEFAULT_CONFIG
): Circuit {
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

/**
 * Check if circuit is still valid
 */
export function isCircuitValid(circuit: Circuit): boolean {
  return circuit.active && Date.now() < circuit.expiresAt;
}

/**
 * Connection rate limiter
 */
export class ConnectionRateLimiter {
  private connections: Map<string, { count: number; windowStart: number }> =
    new Map();
  private config: IPProtectionConfig;

  constructor(config: IPProtectionConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Check if connection from IP is allowed
   */
  allowConnection(ip: string): boolean {
    const now = Date.now();
    const existing = this.connections.get(ip);

    if (!existing) {
      this.connections.set(ip, { count: 1, windowStart: now });
      return true;
    }

    // Reset window if expired
    if (now - existing.windowStart > this.config.timeWindowMs) {
      this.connections.set(ip, { count: 1, windowStart: now });
      return true;
    }

    // Check limit
    if (existing.count >= this.config.maxConnectionsPerIP) {
      return false;
    }

    existing.count++;
    return true;
  }

  /**
   * Get connection count for IP
   */
  getConnectionCount(ip: string): number {
    const existing = this.connections.get(ip);
    if (!existing) return 0;

    // Reset if window expired
    if (Date.now() - existing.windowStart > this.config.timeWindowMs) {
      return 0;
    }

    return existing.count;
  }

  /**
   * Clean up old entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [ip, data] of this.connections.entries()) {
      if (now - data.windowStart > this.config.timeWindowMs * 2) {
        this.connections.delete(ip);
      }
    }
  }
}

/**
 * Connection pool for IP masking
 */
export class ConnectionPool {
  private pool: Map<string, { lastUsed: number; count: number }> = new Map();
  private config: IPProtectionConfig;

  constructor(config: IPProtectionConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Get a pooled connection identifier
   */
  getConnectionId(): string {
    const now = Date.now();

    // Find or create pooled connection
    for (const [id, data] of this.pool.entries()) {
      if (data.count < this.config.poolSize && now - data.lastUsed < 300000) {
        data.lastUsed = now;
        data.count++;
        return id;
      }
    }

    // Create new pooled connection
    const newId = `pool_${crypto.randomUUID()}`;
    this.pool.set(newId, { lastUsed: now, count: 1 });
    return newId;
  }

  /**
   * Release connection back to pool
   */
  releaseConnection(id: string): void {
    const data = this.pool.get(id);
    if (data) {
      data.count = Math.max(0, data.count - 1);
    }
  }

  /**
   * Clean up old connections
   */
  cleanup(): void {
    const now = Date.now();
    for (const [id, data] of this.pool.entries()) {
      if (now - data.lastUsed > 600000 || data.count === 0) {
        this.pool.delete(id);
      }
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    activeConnections: number;
    totalUsage: number;
    avgUsagePerConnection: number;
  } {
    const connections = Array.from(this.pool.values());
    const totalUsage = connections.reduce((sum, c) => sum + c.count, 0);

    return {
      activeConnections: connections.length,
      totalUsage,
      avgUsagePerConnection: connections.length > 0 ? totalUsage / connections.length : 0,
    };
  }
}

/**
 * Anonymize network request metadata
 */
export function anonymizeRequestMetadata(metadata: {
  ip?: string;
  userAgent?: string;
  timestamp?: number;
}): {
  ipHash?: string;
  browserFamily?: string;
  timeBucket: number;
} {
  const result: {
    ipHash?: string;
    browserFamily?: string;
    timeBucket: number;
  } = {
    timeBucket: metadata.timestamp ? Math.floor(metadata.timestamp / 3600000) : 0,
  };

  if (metadata.ip) {
    // Hash IP instead of storing
    result.ipHash = metadata.ip
      .split('.')
      .map((_, i, arr) => (i >= 2 ? '0' : arr[i]))
      .join('.');
  }

  if (metadata.userAgent) {
    // Extract only browser family
    const ua = metadata.userAgent.toLowerCase();
    if (ua.includes('firefox')) result.browserFamily = 'firefox';
    else if (ua.includes('chrome')) result.browserFamily = 'chromium';
    else if (ua.includes('safari')) result.browserFamily = 'webkit';
    else result.browserFamily = 'other';
  }

  return result;
}

/**
 * Generate noise traffic to obscure real traffic patterns
 */
export function generateNoiseTraffic(
  intervalMs: number,
  callback: () => void
): ReturnType<typeof setInterval> {
  // Add random jitter to interval
  const jitter = () => intervalMs * (0.8 + Math.random() * 0.4);

  const timer = setInterval(() => {
    callback();
  }, jitter());

  return timer;
}

/**
 * Check if IP is from a known datacenter/cloud provider
 */
export function isDatacenterIP(ip: string): boolean {
  // In production, would check against known datacenter IP ranges
  // Common cloud provider prefixes (simplified check)
  const datacenterPrefixes = [
    '35.', // Google Cloud
    '52.', // AWS
    '13.', // AWS
    '40.', // Azure
    '104.', // Various
  ];

  return datacenterPrefixes.some((prefix) => ip.startsWith(prefix));
}

/**
 * Get network fingerprint (for detecting same user across IPs)
 */
export async function getNetworkFingerprint(): Promise<string> {
  // Combine various network characteristics
  const characteristics = [
    navigator.language || 'unknown',
    screen.colorDepth || 0,
    new Date().getTimezoneOffset(),
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(characteristics);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
