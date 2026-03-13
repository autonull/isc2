/**
 * Signature Service
 *
 * Centralized signing and verification operations.
 * Replaces repeated signing patterns across the codebase.
 */

import { sign, encode, verify } from '@isc/core';
import type { Signature } from '@isc/core';
import { getKeypair } from '../../identity/index.js';

export interface SignableData {
  [key: string]: unknown;
}

export class SignatureService {
  /**
   * Sign data with current identity's private key
   */
  static async sign(data: SignableData): Promise<Signature> {
    const keypair = await getKeypair();
    if (!keypair) {
      throw new Error('Identity not initialized');
    }
    return sign(encode(data), keypair.privateKey);
  }

  /**
   * Sign raw bytes
   */
  static async signRaw(bytes: Uint8Array): Promise<Signature> {
    const keypair = await getKeypair();
    if (!keypair) {
      throw new Error('Identity not initialized');
    }
    return sign(bytes, keypair.privateKey);
  }

  /**
   * Verify signature against data and public key
   */
  static async verify(
    data: SignableData,
    signature: Signature,
    publicKey: CryptoKey
  ): Promise<boolean> {
    try {
      return verify(encode(data), signature, publicKey);
    } catch {
      return false;
    }
  }

  /**
   * Verify raw bytes signature
   */
  static async verifyRaw(
    bytes: Uint8Array,
    signature: Signature,
    publicKey: CryptoKey
  ): Promise<boolean> {
    try {
      return verify(bytes, signature, publicKey);
    } catch {
      return false;
    }
  }

  /**
   * Create signed payload
   */
  static async createSignedPayload<T extends SignableData>(
    data: T
  ): Promise<T & { signature: Signature; timestamp: number }> {
    const timestamp = Date.now();
    const dataWithTimestamp = { ...data, timestamp } as SignableData;
    const signature = await this.sign(dataWithTimestamp);

    return {
      ...(data as T),
      signature,
      timestamp,
    };
  }

  /**
   * Verify signed payload
   */
  static async verifySignedPayload(
    payload: SignableData & { signature: Signature; timestamp: number },
    publicKey: CryptoKey
  ): Promise<boolean> {
    const { signature, ...data } = payload;
    return this.verify(data, signature, publicKey);
  }

  /**
   * Check if signature is recent (within TTL)
   */
  static isSignatureRecent(
    timestamp: number,
    ttlMs: number = 5 * 60 * 1000
  ): boolean {
    return Date.now() - timestamp < ttlMs;
  }
}
