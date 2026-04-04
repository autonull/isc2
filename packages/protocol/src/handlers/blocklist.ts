/* eslint-disable */
/**
 * ISC Phase P3.3: Signed Network-Wide Blocklists
 *
 * Tier 2 supports network-wide blocklist entries at /isc/blocklist/<peerID>.
 * High-rep peers (score > 200) can sign and publish blocklist entries.
 * Entries have no TTL — manual unblock required.
 */

import type { BlocklistEntry } from '../messages.js';
import { getSecurityTier } from '@isc/core';

const BLOCKLIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_REP_TO_SIGN_BLOCKLIST = 200;

const blocklistCache = new Map<string, { entry: BlocklistEntry; fetchedAt: number }>();

export function isPeerBlocklisted(peerId: string): boolean {
  const cached = blocklistCache.get(peerId);
  if (!cached) {return false;}
  if (Date.now() - cached.fetchedAt > BLOCKLIST_CACHE_TTL_MS) {
    blocklistCache.delete(peerId);
    return false;
  }
  return true;
}

export function getBlocklistEntry(peerId: string): BlocklistEntry | undefined {
  const cached = blocklistCache.get(peerId);
  if (!cached) {return undefined;}
  if (Date.now() - cached.fetchedAt > BLOCKLIST_CACHE_TTL_MS) {
    blocklistCache.delete(peerId);
    return undefined;
  }
  return cached.entry;
}

export async function fetchBlocklist(
  dhtGet: (key: string, count: number) => Promise<Uint8Array[]>
): Promise<void> {
  if (getSecurityTier() < 2) {return;}

  try {
    const results = await dhtGet('/isc/blocklist', 50);
    for (const result of results) {
      try {
        const entry = JSON.parse(new TextDecoder().decode(result)) as BlocklistEntry;
        blocklistCache.set(entry.peerID, { entry, fetchedAt: Date.now() });
      } catch {
        // Skip invalid entries
      }
    }
  } catch (err) {
    console.warn('[Blocklist] Failed to fetch:', err);
  }
}

export async function publishBlocklistEntry(
  dhtPut: (key: string, value: Uint8Array) => Promise<void>,
  peerId: string,
  reason: string,
  reporterId: string,
  sign: (data: Uint8Array) => Promise<Uint8Array>
): Promise<boolean> {
  if (getSecurityTier() < 2) {return false;}

  const entry: BlocklistEntry = {
    peerID: peerId,
    reason,
    reporterID: reporterId,
    ts: Date.now(),
    sig: new Uint8Array(),
  };

  try {
    const payload = new TextEncoder().encode(
      JSON.stringify({
        peerID: peerId,
        reason,
        reporterID: reporterId,
        ts: entry.ts,
      })
    );
    entry.sig = await sign(payload);

    const key = `/isc/blocklist/${peerId}`;
    await dhtPut(key, new TextEncoder().encode(JSON.stringify(entry)));

    blocklistCache.set(peerId, { entry, fetchedAt: Date.now() });
    return true;
  } catch (err) {
    console.warn('[Blocklist] Failed to publish:', err);
    return false;
  }
}

export function verifyBlocklistEntry(entry: BlocklistEntry): boolean {
  if (!entry.sig || entry.sig.length === 0) {return false;}
  if (!entry.peerID || !entry.reason || !entry.reporterID) {return false;}
  return true;
}

export function getBlocklistSize(): number {
  let count = 0;
  for (const [, cached] of blocklistCache.entries()) {
    if (Date.now() - cached.fetchedAt <= BLOCKLIST_CACHE_TTL_MS) {
      count++;
    }
  }
  return count;
}

export function clearExpiredEntries(): void {
  const now = Date.now();
  for (const [peerId, cached] of blocklistCache.entries()) {
    if (now - cached.fetchedAt > BLOCKLIST_CACHE_TTL_MS) {
      blocklistCache.delete(peerId);
    }
  }
}

export function canSignBlocklistEntry(reputation: number): boolean {
  return reputation >= MIN_REP_TO_SIGN_BLOCKLIST;
}
