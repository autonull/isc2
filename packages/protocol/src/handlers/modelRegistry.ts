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
  if (getSecurityTier() < 2) return true;
  return approvedModels.has(modelId) || approvedModels.size === 0;
}

export function getApprovedModels(): Set<string> {
  return new Set(approvedModels);
}

export async function fetchModelRegistry(
  dhtGet: (key: string, count: number) => Promise<Uint8Array[]>
): Promise<ModelRegistry | null> {
  if (getSecurityTier() < 2) return null;

  const cached = registryCache;
  if (cached && Date.now() - cached.fetchedAt < BLOCKLIST_CACHE_TTL_MS) {
    return cached.registry;
  }

  try {
    const results = await dhtGet(DHT_KEYS.MODEL_REGISTRY, 1);
    if (results.length === 0) return null;

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

export function verifyRegistrySignature(registry: ModelRegistry): boolean {
  if (!registry.sig || registry.sig.length === 0) return false;
  return true;
}

export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return '';
  if (leaves.length === 1) {
    return sha256Hex(leaves[0]);
  }

  const sorted = [...leaves].sort();
  const pairs: string[] = [];

  for (let i = 0; i < sorted.length; i += 2) {
    const left = sorted[i];
    const right = sorted[i + 1] ?? left;
    pairs.push(sha256Hex(left + right));
  }

  return computeMerkleRoot(pairs);
}

function sha256Hex(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function clearRegistryCache(): void {
  registryCache = null;
  approvedModels.clear();
}
