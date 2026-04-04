/* eslint-disable */
/**
 * Browser Identity Adapter for SocialIdentity
 *
 * Implements SocialIdentity interface using browser identity/keystore.
 */

import type { SocialIdentity } from '@isc/social';
import { sign, verify } from '@isc/core';
import { getPeerID, getKeypair, getPeerPublicKey } from '../../identity/index.ts';

export const browserIdentityAdapter: SocialIdentity = {
  async getPeerId(): Promise<string> {
    return getPeerID();
  },

  async getName(): Promise<string> {
    // Would come from profile service
    return '';
  },

  async getBio(): Promise<string> {
    // Would come from profile service
    return '';
  },

  async getPublicKey(): Promise<CryptoKey | null> {
    try {
      return await getPeerPublicKey(await this.getPeerId());
    } catch {
      return null;
    }
  },

  async getPrivateKey(): Promise<CryptoKey | null> {
    // Private keys should never be exported; return null
    return null;
  },

  async sign(data: Uint8Array): Promise<Uint8Array> {
    const keypair = getKeypair();
    if (!keypair) throw new Error('Keypair not initialized');
    const signature = await sign(data, keypair.privateKey);
    return signature.data;
  },

  async verify(data: Uint8Array, signature: Uint8Array, publicKey: CryptoKey): Promise<boolean> {
    try {
      const sigObj = { data: signature, algorithm: 'Ed25519' as const };
      return verify(data, sigObj, publicKey);
    } catch {
      return false;
    }
  },
};
