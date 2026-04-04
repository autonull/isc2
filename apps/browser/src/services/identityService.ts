/* eslint-disable */
/**
 * Identity Service
 *
 * Manages user identity, keypairs, and signing operations.
 */

import type { IdentityService as IIdentityService } from '../di/container.ts';
import { getKeypair, initializeIdentity } from '../identity/index.ts';
import { sign } from '@isc/core';
import { loggers } from '../utils/logger.ts';

const logger = loggers.social;

class IdentityServiceImpl implements IIdentityService {
  private initialized = false;
  private fingerprintCache: string | null = null;

  async isInitialized(): Promise<boolean> {
    return this.initialized;
  }

  async initialize(passphrase?: string): Promise<void> {
    try {
      await initializeIdentity(passphrase);
      this.initialized = true;
      this.fingerprintCache = null;
      logger.info('Identity initialized');
    } catch (err) {
      logger.error('Identity initialization failed', err as Error);
      throw err;
    }
  }

  async getKeypair(): Promise<CryptoKeyPair | null> {
    try {
      return await getKeypair();
    } catch {
      return null;
    }
  }

  async getPublicKey(): Promise<string | null> {
    const keypair = await this.getKeypair();
    if (!keypair) return null;
    const exported = await crypto.subtle.exportKey('spki', keypair.publicKey);
    return Array.from(new Uint8Array(exported))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async getFingerprint(): Promise<string | null> {
    if (this.fingerprintCache) return this.fingerprintCache;

    const keypair = await this.getKeypair();
    if (!keypair) return null;

    const exported = await crypto.subtle.exportKey('spki', keypair.publicKey);
    const hash = await crypto.subtle.digest('SHA-256', exported);
    const bytes = new Uint8Array(hash);
    const fingerprint = Array.from(bytes)
      .slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');

    this.fingerprintCache = fingerprint;
    return fingerprint;
  }

  async sign(data: Uint8Array | string): Promise<string> {
    const keypair = await this.getKeypair();
    if (!keypair) {
      throw new Error('Identity not initialized - cannot sign');
    }

    const payload = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const signature = await sign(payload, keypair.privateKey);

    return Array.from(signature.data)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async getIdentity(): Promise<CryptoKeyPair | null> {
    return this.getKeypair();
  }

  async update(_updates: Record<string, unknown>): Promise<void> {
    logger.info('Identity update requested');
  }

  async export(): Promise<CryptoKeyPair | null> {
    return this.getKeypair();
  }

  async import(_identityData: Record<string, unknown>): Promise<void> {
    logger.info('Identity import requested');
  }

  async clear(): Promise<void> {
    this.initialized = false;
    this.fingerprintCache = null;
    logger.info('Identity cleared');
  }
}

let _instance: IdentityServiceImpl | null = null;

export function getIdentityService(): IIdentityService {
  if (!_instance) {
    _instance = new IdentityServiceImpl();
  }
  return _instance;
}

export function createIdentityService(): IIdentityService {
  return getIdentityService();
}
