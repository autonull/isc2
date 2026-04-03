/**
 * Identity Service
 *
 * Manages user identity, keypairs, and signing operations.
 */

import type { IdentityService as IIdentityService } from '../di/container.js';
import { getKeypair, initializeIdentity } from '../identity/index.js';
import { sign } from '@isc/core';
import { loggers } from '../utils/logger.js';

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

  async getKeypair(): Promise<any | null> {
    try {
      return await getKeypair();
    } catch {
      return null;
    }
  }

  async getPublicKey(): Promise<string | null> {
    const keypair = await this.getKeypair();
    if (!keypair) return null;
    return keypair.publicKey;
  }

  async getFingerprint(): Promise<string | null> {
    if (this.fingerprintCache) return this.fingerprintCache;

    const keypair = await this.getKeypair();
    if (!keypair) return null;

    // Generate fingerprint from public key
    const encoder = new TextEncoder();
    const data = encoder.encode(keypair.publicKey);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hash);
    const fingerprint = Array.from(bytes)
      .slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':');

    this.fingerprintCache = fingerprint;
    return fingerprint;
  }

  async sign(data: any): Promise<string> {
    const keypair = await this.getKeypair();
    if (!keypair) {
      throw new Error('Identity not initialized - cannot sign');
    }

    const encoder = new TextEncoder();
    const payload = encoder.encode(JSON.stringify(data));
    const signature = await sign(payload, keypair.privateKey);

    return Array.from(signature)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async getIdentity(): Promise<any> {
    return this.getKeypair();
  }

  async update(_updates: any): Promise<void> {
    logger.info('Identity update requested');
  }

  async export(): Promise<any> {
    return this.getKeypair();
  }

  async import(_identityData: any): Promise<void> {
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
