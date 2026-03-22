/**
 * Browser Identity Adapter for SocialIdentity
 *
 * Implements SocialIdentity interface using browser identity/keystore.
 */

import type { SocialIdentity } from '@isc/social';
import { sign, verify, encode, decode } from '@isc/core';
import { getPeerID, getKeypair, getPeerPublicKey } from '../../identity/index.js';

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
    // Browser crypto API uses CryptoKey, but our system uses Uint8Array
    // This is a type mismatch that needs to be handled
    const publicKeyBytes = await getPeerPublicKey(await this.getPeerId());
    if (!publicKeyBytes) return null;

    // Import the public key into Web Crypto API
    try {
      return await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' },
        true,
        ['verify']
      );
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
    return sign(data, keypair.privateKey);
  },

  async verify(data: Uint8Array, signature: Uint8Array, publicKey: CryptoKey): Promise<boolean> {
    try {
      // Export the CryptoKey back to raw bytes for verification
      const publicKeyBytes = await crypto.subtle.exportKey('raw', publicKey);
      return verify(data, signature, new Uint8Array(publicKeyBytes));
    } catch {
      return false;
    }
  },
};
