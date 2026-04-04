/* eslint-disable */
/**
 * ISC Phase P3.2: Merkle Model Registry
 *
 * In Tier 2, the model registry at /isc/model_registry is a Merkle root signed by
 * maintainer multisig. Announces with unknown model hashes are dropped.
 */

import type { ModelRegistry } from '../messages.js';
import { getSecurityTier } from '@isc/core';
import { DHT_KEYS } from '../keys.js';

export interface ApprovedModel {
  modelHash: string;
  modelId: string;
  addedAt: number;
  addedBy: string;
}

const BLOCKLIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let approvedModels: Set<string> = new Set();
let registryCache: { registry: ModelRegistry; fetchedAt: number } | null = null;

export function setApprovedModels(models: string[]): void {
  approvedModels = new Set(models);
}

export function isModelApproved(modelId: string): boolean {
  if (getSecurityTier() < 2) {return true;}
  return approvedModels.has(modelId) || approvedModels.size === 0;
}

export function getApprovedModels(): Set<string> {
  return new Set(approvedModels);
}

export async function fetchModelRegistry(
  dhtGet: (key: string, count: number) => Promise<Uint8Array[]>
): Promise<ModelRegistry | null> {
  if (getSecurityTier() < 2) {return null;}

  const cached = registryCache;
  if (cached && Date.now() - cached.fetchedAt < BLOCKLIST_CACHE_TTL_MS) {
    return cached.registry;
  }

  try {
    const results = await dhtGet(DHT_KEYS.MODEL_REGISTRY, 1);
    if (results.length === 0) {return null;}

    const registry = JSON.parse(new TextDecoder().decode(results[0])) as ModelRegistry;
    registryCache = { registry, fetchedAt: Date.now() };

    const leaves = new Set(registry.merkleLeaves);
    setApprovedModels(Array.from(leaves));

    return registry;
  } catch (err) {
    console.warn('[ModelRegistry] Failed to fetch registry:', err);
    return null;
  }
}

export function verifyMerkleRoot(registry: ModelRegistry, computedRoot: string): boolean {
  return registry.merkleRoot === computedRoot;
}

export async function verifyRegistrySignature(
  registry: ModelRegistry,
  _maintainerPublicKeys: CryptoKey[]
): Promise<boolean> {
  if (!registry.sig || registry.sig.length === 0) {return false;}

  const payload = new TextEncoder().encode(
    JSON.stringify({
      merkleRoot: registry.merkleRoot,
      merkleLeaves: registry.merkleLeaves,
      version: registry.version,
      updatedAt: registry.updatedAt,
    })
  );

  for (const key of _maintainerPublicKeys) {
    try {
      const valid = await crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        registry.sig.buffer as ArrayBuffer,
        payload
      );
      if (valid) {return true;}
    } catch {
      continue;
    }
  }

  return false;
}

export async function computeMerkleRoot(leaves: string[]): Promise<string> {
  if (leaves.length === 0) {return '';}
  if (leaves.length === 1) {
    return sha256Hex(leaves[0]);
  }

  const sorted = [...leaves].sort();
  const pairs: string[] = [];

  for (let i = 0; i < sorted.length; i += 2) {
    const left = sorted[i];
    const right = sorted[i + 1] ?? left;
    pairs.push(await sha256Hex(left + right));
  }

  return computeMerkleRoot(pairs);
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function clearRegistryCache(): void {
  registryCache = null;
  approvedModels.clear();
}
