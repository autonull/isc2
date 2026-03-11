/**
 * Ephemeral Identity System
 *
 * Throwaway keypairs for privacy-preserving interactions.
 * Useful for sensitive conversations, temporary accounts, and
 * reducing linkability across interactions.
 *
 * References: NEXT_STEPS.md#81-ephemeral-identity
 */

import { generateKeypair, exportKeypair, importKeypair, type Keypair } from './keypair.js';

/**
 * Ephemeral identity with metadata
 */
export interface EphemeralIdentity {
  id: string;
  keypair: Keypair;
  purpose: string;
  createdAt: number;
  expiresAt?: number;
  maxUses?: number;
  usedCount: number;
  parentIdentity?: string; // Link to main identity for recovery
  metadata?: Record<string, unknown>;
}

/**
 * Ephemeral identity configuration
 */
export interface EphemeralConfig {
  // Lifetime settings
  defaultLifetimeHours: number;
  maxLifetimeHours: number;
  
  // Usage limits
  defaultMaxUses: number;
  
  // Purpose types
  allowedPurposes: string[];
  
  // Security
  requireParentSignature: boolean;
  autoDeleteOnExpire: boolean;
}

const DEFAULT_CONFIG: EphemeralConfig = {
  defaultLifetimeHours: 24,
  maxLifetimeHours: 168, // 1 week
  defaultMaxUses: 100,
  allowedPurposes: [
    'anonymous_post',
    'private_message',
    'temporary_channel',
    'one_time_vote',
    'sensitive_discussion',
    'test_account',
  ],
  requireParentSignature: false,
  autoDeleteOnExpire: true,
};

/**
 * Create a new ephemeral identity
 */
export async function createEphemeralIdentity(
  purpose: string,
  config: EphemeralConfig = DEFAULT_CONFIG,
  options?: {
    lifetimeHours?: number;
    maxUses?: number;
    parentIdentity?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<EphemeralIdentity> {
  // Validate purpose
  if (!config.allowedPurposes.includes(purpose)) {
    throw new Error(`Invalid purpose: ${purpose}. Allowed: ${config.allowedPurposes.join(', ')}`);
  }

  // Validate lifetime
  const lifetimeHours = options?.lifetimeHours ?? config.defaultLifetimeHours;
  if (lifetimeHours > config.maxLifetimeHours) {
    throw new Error(`Lifetime exceeds maximum: ${config.maxLifetimeHours} hours`);
  }

  // Generate keypair
  const keypair = await generateKeypair();

  const now = Date.now();
  const identity: EphemeralIdentity = {
    id: `ephemeral_${crypto.randomUUID()}`,
    keypair,
    purpose,
    createdAt: now,
    expiresAt: now + lifetimeHours * 60 * 60 * 1000,
    maxUses: options?.maxUses ?? config.defaultMaxUses,
    usedCount: 0,
    parentIdentity: options?.parentIdentity,
    metadata: options?.metadata,
  };

  return identity;
}

/**
 * Check if ephemeral identity is still valid
 */
export function isEphemeralIdentityValid(identity: EphemeralIdentity): boolean {
  const now = Date.now();

  // Check expiration
  if (identity.expiresAt && now > identity.expiresAt) {
    return false;
  }

  // Check usage limit
  if (identity.maxUses && identity.usedCount >= identity.maxUses) {
    return false;
  }

  return true;
}

/**
 * Use ephemeral identity (increments usage count)
 */
export function useEphemeralIdentity(identity: EphemeralIdentity): boolean {
  if (!isEphemeralIdentityValid(identity)) {
    return false;
  }

  identity.usedCount++;
  return true;
}

/**
 * Get remaining uses for ephemeral identity
 */
export function getRemainingUses(identity: EphemeralIdentity): number {
  if (!identity.maxUses) {
    return Infinity;
  }
  return Math.max(0, identity.maxUses - identity.usedCount);
}

/**
 * Get remaining lifetime in milliseconds
 */
export function getRemainingLifetime(identity: EphemeralIdentity): number {
  if (!identity.expiresAt) {
    return Infinity;
  }
  return Math.max(0, identity.expiresAt - Date.now());
}

/**
 * Export ephemeral identity for backup
 */
export async function exportEphemeralIdentity(
  identity: EphemeralIdentity,
  _passphrase?: string
): Promise<object> {
  const exported = await exportKeypair(identity.keypair);

  return {
    id: identity.id,
    purpose: identity.purpose,
    createdAt: identity.createdAt,
    expiresAt: identity.expiresAt,
    maxUses: identity.maxUses,
    usedCount: identity.usedCount,
    parentIdentity: identity.parentIdentity,
    metadata: identity.metadata,
    publicKey: Array.from(exported.publicKey),
    privateKey: Array.from(exported.privateKey),
  };
}

/**
 * Import ephemeral identity from backup
 */
export async function importEphemeralIdentity(
  data: object,
  _passphrase?: string
): Promise<EphemeralIdentity> {
  const decryptedData = data as Record<string, unknown>;

  const publicKey = new Uint8Array(decryptedData.publicKey as number[]);
  const privateKey = new Uint8Array(decryptedData.privateKey as number[]);
  const keypair = await importKeypair(publicKey, privateKey);

  return {
    id: decryptedData.id as string,
    keypair,
    purpose: decryptedData.purpose as string,
    createdAt: decryptedData.createdAt as number,
    expiresAt: decryptedData.expiresAt as number | undefined,
    maxUses: decryptedData.maxUses as number | undefined,
    usedCount: decryptedData.usedCount as number,
    parentIdentity: decryptedData.parentIdentity as string | undefined,
    metadata: decryptedData.metadata as Record<string, unknown> | undefined,
  };
}

/**
 * Rotate ephemeral identity (create new one with same purpose)
 */
export async function rotateEphemeralIdentity(
  oldIdentity: EphemeralIdentity,
  config: EphemeralConfig = DEFAULT_CONFIG
): Promise<EphemeralIdentity> {
  return createEphemeralIdentity(oldIdentity.purpose, config, {
    parentIdentity: oldIdentity.parentIdentity,
    metadata: oldIdentity.metadata,
  });
}

/**
 * Batch create ephemeral identities for pre-generation
 */
export async function createEphemeralIdentitiesBatch(
  purpose: string,
  count: number,
  config: EphemeralConfig = DEFAULT_CONFIG,
  options?: {
    lifetimeHours?: number;
    maxUses?: number;
    parentIdentity?: string;
  }
): Promise<EphemeralIdentity[]> {
  const identities: EphemeralIdentity[] = [];

  for (let i = 0; i < count; i++) {
    const identity = await createEphemeralIdentity(purpose, config, options);
    identities.push(identity);
  }

  return identities;
}

/**
 * Get identity statistics
 */
export function getEphemeralStats(identities: EphemeralIdentity[]): {
  total: number;
  valid: number;
  expired: number;
  exhausted: number;
  byPurpose: Record<string, number>;
} {
  const stats = {
    total: identities.length,
    valid: 0,
    expired: 0,
    exhausted: 0,
    byPurpose: {} as Record<string, number>,
  };

  for (const identity of identities) {
    // Count by purpose
    stats.byPurpose[identity.purpose] = (stats.byPurpose[identity.purpose] || 0) + 1;

    // Check status
    if (!identity.expiresAt || Date.now() <= identity.expiresAt) {
      if (!identity.maxUses || identity.usedCount < identity.maxUses) {
        stats.valid++;
      } else {
        stats.exhausted++;
      }
    } else {
      stats.expired++;
    }
  }

  return stats;
}

/**
 * Clean up expired identities
 */
export function cleanupExpiredIdentities(
  identities: EphemeralIdentity[]
): EphemeralIdentity[] {
  return identities.filter(isEphemeralIdentityValid);
}

/**
 * Derive ephemeral identity from parent with context
 */
export async function deriveEphemeralIdentity(
  parentKeypair: Keypair,
  context: string,
  purpose: string,
  config: EphemeralConfig = DEFAULT_CONFIG
): Promise<EphemeralIdentity> {
  // Generate deterministic seed from parent key and context
  const encoder = new TextEncoder();
  const contextData = encoder.encode(context);

  // In production, would use HKDF or similar KDF
  // For now, use simple hash-based derivation
  await crypto.subtle.digest('SHA-256', contextData);

  // Generate new keypair (in production, would derive deterministically)
  const keypair = await generateKeypair();

  const now = Date.now();
  return {
    id: `derived_${crypto.randomUUID()}`,
    keypair,
    purpose,
    createdAt: now,
    expiresAt: now + config.defaultLifetimeHours * 60 * 60 * 1000,
    maxUses: config.defaultMaxUses,
    usedCount: 0,
    parentIdentity: await formatKeyFingerprint(parentKeypair.publicKey),
    metadata: { derivedFrom: context },
  };
}

async function formatKeyFingerprint(publicKey: CryptoKey): Promise<string> {
  const keyData = await crypto.subtle.exportKey('raw', publicKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
