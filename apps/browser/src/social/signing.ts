/**
 * Social Signing Service
 * 
 * Unified service for signing and verifying social layer content.
 * Eliminates duplicate signing code across posts, interactions, follows, etc.
 */

import { sign, encode, verify, decode, type Signature } from '@isc/core';
import { getPeerID, getKeypair, getPeerPublicKey } from '../identity/index.js';
import { DelegationClient } from '@isc/delegation';
import { loggers } from '../utils/logger.js';

const logger = loggers.social;

export interface SignablePayload {
  id: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface SignedContent<T> {
  data: T;
  signature: Signature;
  verified?: boolean;
}

/**
 * Sign any social content with current user's keypair
 */
export async function signContent<T extends SignablePayload>(payload: T): Promise<SignedContent<T>> {
  const keypair = getKeypair();
  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const signature = await sign(encode(payload), keypair.privateKey);
  return { data: payload, signature };
}

/**
 * Verify signed content
 */
export async function verifyContent<T extends SignablePayload>(
  signed: SignedContent<T>
): Promise<boolean> {
  try {
    const payload = encode(signed.data);
    
    // Get author's public key
    const author = (signed.data as any).author || (signed.data as any).peerID || (signed.data as any).liker;
    if (!author) {
      logger.warn('No author in content for verification');
      return false;
    }

    const publicKey = await getPeerPublicKey(author);
    if (!publicKey) {
      logger.warn('Public key not found for verification', { author });
      return false;
    }

    const isValid = await verify(payload, signed.signature, publicKey);
    
    if (!isValid) {
      logger.warn('Signature verification failed', { author, id: signed.data.id });
    }

    return isValid;
  } catch (error) {
    logger.error('Content verification failed', undefined, { error: (error as Error).message, id: signed.data.id });
    return false;
  }
}

/**
 * Announce signed content to DHT
 */
export async function announceToDHT(
  key: string,
  content: unknown,
  ttl: number = 2592000 // 30 days default
): Promise<void> {
  const client = DelegationClient.getInstance();
  if (!client) {
    logger.warn('DHT client not available for announcement');
    return;
  }

  try {
    await client.announce(key, encode(content), ttl);
    logger.debug('Announced to DHT', { key, ttl });
  } catch (error) {
    logger.error('DHT announcement failed', error as Error, { key });
    throw error;
  }
}

/**
 * Query content from DHT
 */
export async function queryFromDHT<T>(
  key: string,
  limit: number = 50
): Promise<T[]> {
  const client = DelegationClient.getInstance();
  if (!client) {
    logger.warn('DHT client not available for query');
    return [];
  }

  try {
    const encoded = await client.query(key, limit);
    const results: T[] = [];

    for (const data of encoded) {
      try {
        const decoded = decode(data) as T;
        if (decoded) {
          results.push(decoded);
        }
      } catch (error) {
        logger.warn('Failed to decode DHT result', { error: (error as Error).message });
      }
    }

    return results;
  } catch (error) {
    logger.error('DHT query failed', undefined, { error: (error as Error).message, key });
    return [];
  }
}

/**
 * Create and announce signed social content
 */
export async function createAndAnnounce<T extends SignablePayload>(
  payload: T,
  dhtKey: string,
  ttl: number = 2592000
): Promise<SignedContent<T>> {
  const signed = await signContent(payload);
  await announceToDHT(dhtKey, { ...signed.data, signature: signed.signature }, ttl);
  return signed;
}

/**
 * Batch verify multiple signed contents
 */
export async function verifyBatch<T extends SignablePayload>(
  contents: SignedContent<T>[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  for (const content of contents) {
    const isValid = await verifyContent(content);
    results.set(content.data.id, isValid);
  }

  return results;
}

/**
 * Filter verified content from batch
 */
export async function filterVerified<T extends SignablePayload>(
  contents: SignedContent<T>[]
): Promise<SignedContent<T>[]> {
  const results: SignedContent<T>[] = [];
  
  for (const content of contents) {
    if (await verifyContent(content)) {
      results.push(content);
    }
  }

  return results;
}
