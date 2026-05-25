/* eslint-disable */
/**
 * ISC Phase P: Security Tier Infrastructure
 *
 * Tiered security model for different deployment contexts:
 * - Tier 0: Trusted network (LAN, corporate) - no crypto overhead
 * - Tier 1: Federated (universities, collectives) - signing + vouch + gossipsub
 * - Tier 2: Public network - RLN + Merkle registry + blocklists
 */

export const TIER_PROTOCOL = '/isc/tier/1.0.0';
export const SCORE_PROTOCOL = '/isc/score/1.0.0';
export const VOUCH_PROTOCOL = '/isc/vouch/1.0.0';

export const HOT_CLUSTER_THRESHOLD = 8;
export const HOT_CLUSTER_COOLDOWN = 4;
export const HOT_CLUSTER_TTL_MS = 60_000;

export const MIN_REP_FOR_FULL_QUOTA = 100;
export const REP_DECAY_PER_DAY = 0.1;

export const DEFAULT_GENESIS_HASH = 'isc-mainnet-v1';

export const TIER_RATE_LIMITS = {
  TIER_0: {
    ANNOUNCE: { maxRequests: Number.MAX_SAFE_INTEGER, windowMs: 60_000 },
    DHT_QUERY: { maxRequests: Number.MAX_SAFE_INTEGER, windowMs: 60_000 },
    CHAT_DIAL: { maxRequests: Number.MAX_SAFE_INTEGER, windowMs: 3_600_000 },
  },
  TIER_1: {
    ANNOUNCE: { maxRequests: 20, windowMs: 60_000 },
    DHT_QUERY: { maxRequests: 60, windowMs: 60_000 },
    CHAT_DIAL: { maxRequests: 50, windowMs: 3_600_000 },
  },
  TIER_2: {
    ANNOUNCE: { maxRequests: 5, windowMs: 60_000 },
    DHT_QUERY: { maxRequests: 30, windowMs: 60_000 },
    CHAT_DIAL: { maxRequests: 20, windowMs: 3_600_000 },
  },
} as const;

export type SecurityTier = 0 | 1 | 2;

export interface TierInfo {
  tier: SecurityTier;
  networkID: string;
  genesisHash: string;
  announcedAt: number;
}

export interface TierConfig {
  tier: SecurityTier;
  networkID: string;
  skipNoise: boolean;
  skipSigning: boolean;
  skipRLN: boolean;
  flatDHT: boolean;
  skipAutoNAT: boolean;
  rateLimits: (typeof TIER_RATE_LIMITS)[keyof typeof TIER_RATE_LIMITS];
}

export function getTierConfig(tier: SecurityTier, networkID: string = DEFAULT_GENESIS_HASH) {
  const tierRateMap = {
    0: TIER_RATE_LIMITS.TIER_0,
    1: TIER_RATE_LIMITS.TIER_1,
    2: TIER_RATE_LIMITS.TIER_2,
  } as const;

  return {
    tier,
    networkID,
    skipNoise: tier === 0,
    skipSigning: tier === 0,
    skipRLN: tier < 2,
    flatDHT: tier === 0,
    skipAutoNAT: tier === 0,
    rateLimits: tierRateMap[tier],
  };
}

export function isSigningRequired(tier: SecurityTier): boolean {
  return tier >= 1;
}

export function isRLNRequired(tier: SecurityTier): boolean {
  return tier === 2;
}

export function shouldSkipSignature(tier: SecurityTier): boolean {
  return tier === 0;
}

export function shouldSkipNoise(tier: SecurityTier): boolean {
  return tier === 0;
}

export function isTierMismatch(local: SecurityTier, remote: SecurityTier): boolean {
  return local !== remote;
}

export function getTierName(tier: SecurityTier): string {
  const names: Record<SecurityTier, string> = {
    0: 'Trusted Network',
    1: 'Federated Network',
    2: 'Public Network',
  };
  return names[tier];
}

export function getReputationQuotaMultiplier(reputation: number): number {
  if (reputation >= MIN_REP_FOR_FULL_QUOTA) {return 2.0;}
  if (reputation >= 50) {return 1.0;}
  if (reputation > 0) {return 0.5;}
  return 0.25;
}

let _currentTier: SecurityTier = 2;
let _currentNetworkID: string = DEFAULT_GENESIS_HASH;

export function setSecurityTier(tier: SecurityTier, networkID?: string): void {
  _currentTier = tier;
  if (networkID) {_currentNetworkID = networkID;}
}

export function getSecurityTier(): SecurityTier {
  return _currentTier;
}

export function getNetworkID(): string {
  return _currentNetworkID;
}

export function getTierInfo(): TierInfo {
  return {
    tier: _currentTier,
    networkID: _currentNetworkID,
    genesisHash: _currentNetworkID,
    announcedAt: Date.now(),
  };
}
