import { generateKeypair, exportKeypair, importKeypair, type Keypair } from './keypair.js';

export interface EphemeralIdentity {
  id: string;
  keypair: Keypair;
  purpose: string;
  createdAt: number;
  expiresAt?: number;
  maxUses?: number;
  usedCount: number;
  parentIdentity?: string;
  metadata?: Record<string, unknown>;
}

export interface EphemeralConfig {
  defaultLifetimeHours: number;
  maxLifetimeHours: number;
  defaultMaxUses: number;
  allowedPurposes: string[];
  requireParentSignature: boolean;
  autoDeleteOnExpire: boolean;
}

const DEFAULT_CONFIG: EphemeralConfig = {
  defaultLifetimeHours: 24,
  maxLifetimeHours: 168,
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
  if (!config.allowedPurposes.includes(purpose)) {
    throw new Error(`Invalid purpose: ${purpose}. Allowed: ${config.allowedPurposes.join(', ')}`);
  }

  const lifetimeHours = options?.lifetimeHours ?? config.defaultLifetimeHours;
  if (lifetimeHours > config.maxLifetimeHours) {
    throw new Error(`Lifetime exceeds maximum: ${config.maxLifetimeHours} hours`);
  }

  const keypair = await generateKeypair();
  const now = Date.now();

  return {
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
}

export function isEphemeralIdentityValid(identity: EphemeralIdentity): boolean {
  const now = Date.now();
  if (identity.expiresAt && now > identity.expiresAt) return false;
  if (identity.maxUses && identity.usedCount >= identity.maxUses) return false;
  return true;
}

export function useEphemeralIdentity(identity: EphemeralIdentity): boolean {
  if (!isEphemeralIdentityValid(identity)) return false;
  identity.usedCount++;
  return true;
}

export function getRemainingUses(identity: EphemeralIdentity): number {
  if (!identity.maxUses) return Infinity;
  return Math.max(0, identity.maxUses - identity.usedCount);
}

export function getRemainingLifetime(identity: EphemeralIdentity): number {
  if (!identity.expiresAt) return Infinity;
  return Math.max(0, identity.expiresAt - Date.now());
}

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

export async function rotateEphemeralIdentity(
  oldIdentity: EphemeralIdentity,
  config: EphemeralConfig = DEFAULT_CONFIG
): Promise<EphemeralIdentity> {
  return createEphemeralIdentity(oldIdentity.purpose, config, {
    parentIdentity: oldIdentity.parentIdentity,
    metadata: oldIdentity.metadata,
  });
}

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
  return Promise.all(
    Array.from({ length: count }, () =>
      createEphemeralIdentity(purpose, config, options)
    )
  );
}

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
    stats.byPurpose[identity.purpose] = (stats.byPurpose[identity.purpose] || 0) + 1;

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

export function cleanupExpiredIdentities(
  identities: EphemeralIdentity[]
): EphemeralIdentity[] {
  return identities.filter(isEphemeralIdentityValid);
}

export async function deriveEphemeralIdentity(
  parentKeypair: Keypair,
  context: string,
  purpose: string,
  config: EphemeralConfig = DEFAULT_CONFIG
): Promise<EphemeralIdentity> {
  const encoder = new TextEncoder();
  const contextData = encoder.encode(context);
  await crypto.subtle.digest('SHA-256', contextData);

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
