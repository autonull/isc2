/**
 * Signature Verification Service
 * Verifies signatures on incoming data from peers
 */

import { verify } from '@isc/core';
import type { Signature } from '@isc/core';
import { loggers } from '../utils/logger.js';

const logger = loggers.crypto;

interface VerificationResult {
  valid: boolean;
  reason?: string;
}

interface SignableData {
  signature?: Signature | Uint8Array | string;
  timestamp?: number;
  peerID?: string;
  peerId?: string;
  sender?: string;
  author?: string;
}

const VERIFICATION_CACHE = new Map<string, { valid: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BLOCKED_PEERS = new Set<string>();
const FAILED_VERIFICATION_COUNT = new Map<string, number>();
const MAX_FAILED_ATTEMPTS = 5; // Block peer after 5 failed verifications

/**
 * Verify a signature on arbitrary data
 */
export async function verifySignature(
  data: SignableData,
  publicKey: CryptoKey,
  peerId: string
): Promise<VerificationResult> {
  // Check if peer is blocked
  if (BLOCKED_PEERS.has(peerId)) {
    return { valid: false, reason: 'Peer is blocked due to repeated verification failures' };
  }

  // Check cache
  const cacheKey = `${peerId}-${JSON.stringify(data.signature)}`;
  const cached = VERIFICATION_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { valid: cached.valid };
  }

  // Extract signature
  const signature = extractSignature(data);
  if (!signature) {
    return { valid: false, reason: 'No signature found' };
  }

  // Create payload (data without signature)
  const { signature: _, ...payloadData } = data;
  const payload = new TextEncoder().encode(JSON.stringify(payloadData));

  try {
    const sigObj: Signature = typeof signature === 'string' 
      ? { data: hexToBytes(signature), algorithm: 'Ed25519' as const }
      : signature instanceof Uint8Array 
        ? { data: signature, algorithm: 'Ed25519' as const }
        : signature;

    const isValid = await verify(payload, sigObj, publicKey);

    // Cache result
    VERIFICATION_CACHE.set(cacheKey, { valid: isValid, timestamp: Date.now() });

    // Track failed attempts
    if (!isValid) {
      const count = (FAILED_VERIFICATION_COUNT.get(peerId) || 0) + 1;
      FAILED_VERIFICATION_COUNT.set(peerId, count);

      if (count >= MAX_FAILED_ATTEMPTS) {
        BLOCKED_PEERS.add(peerId);
        logger.warn('Peer blocked due to repeated verification failures', { peerId });
      }

      return { valid: false, reason: 'Signature verification failed' };
    }

    // Clear failed count on success
    FAILED_VERIFICATION_COUNT.delete(peerId);

    return { valid: true };
  } catch (err) {
    logger.error('Verification error', err as Error);
    return { valid: false, reason: 'Verification error: ' + (err as Error).message };
  }
}

/**
 * Verify DHT announcement
 */
export async function verifyAnnouncement(
  announcement: SignableData,
  publicKey: CryptoKey
): Promise<VerificationResult> {
  const peerId = announcement.peerID || announcement.peerId;
  if (!peerId) {
    return { valid: false, reason: 'No peer ID in announcement' };
  }

  return verifySignature(announcement, publicKey, peerId);
}

/**
 * Verify chat message
 */
export async function verifyMessage(
  message: SignableData,
  publicKey: CryptoKey
): Promise<VerificationResult> {
  const sender = message.sender;
  if (!sender) {
    return { valid: false, reason: 'No sender in message' };
  }

  return verifySignature(message, publicKey, sender);
}

/**
 * Verify post
 */
export async function verifyPost(
  post: SignableData,
  publicKey: CryptoKey
): Promise<VerificationResult> {
  const author = post.author || post.peerID;
  if (!author) {
    return { valid: false, reason: 'No author in post' };
  }

  return verifySignature(post, publicKey, author);
}

/**
 * Block a peer (manual or automatic)
 */
export function blockPeer(peerId: string): void {
  BLOCKED_PEERS.add(peerId);
  logger.warn('Peer blocked', { peerId });
}

/**
 * Unblock a peer
 */
export function unblockPeer(peerId: string): void {
  BLOCKED_PEERS.delete(peerId);
  FAILED_VERIFICATION_COUNT.delete(peerId);
  logger.info('Peer unblocked', { peerId });
}

/**
 * Check if peer is blocked
 */
export function isPeerBlocked(peerId: string): boolean {
  return BLOCKED_PEERS.has(peerId);
}

/**
 * Get blocked peers list
 */
export function getBlockedPeers(): string[] {
  return Array.from(BLOCKED_PEERS);
}

/**
 * Clear verification cache
 */
export function clearCache(): void {
  VERIFICATION_CACHE.clear();
}

/**
 * Cleanup old cache entries
 */
export function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of VERIFICATION_CACHE.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      VERIFICATION_CACHE.delete(key);
    }
  }
}

// Helper functions
function extractSignature(data: SignableData): Uint8Array | string | Signature | undefined {
  if (!data.signature) return undefined;
  return data.signature;
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) => 
    parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  );
}

// Periodic cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 60000); // Cleanup every minute
}
