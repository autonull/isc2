/**
 * DM Encryption Service
 *
 * Handles encryption and decryption of direct messages.
 */

import { encrypt, decrypt } from '@isc/core';
import { getPeerPublicKey, getKeypair } from '../../../identity/index.js';

export class DMEncryptionService {
  /**
   * Encrypt content for a recipient
   */
  static async encryptContent(content: string, recipient: string): Promise<Uint8Array> {
    const publicKey = await getPeerPublicKey(recipient);
    if (!publicKey) {
      throw new Error(`Public key not found for recipient: ${recipient}`);
    }

    const exportedKey = await crypto.subtle.exportKey('raw', publicKey);
    return encrypt(content, new Uint8Array(exportedKey));
  }

  /**
   * Decrypt DM content
   */
  static async decryptContent(encryptedContent: Uint8Array): Promise<string> {
    const keypair = getKeypair();
    if (!keypair) {
      throw new Error('Identity not initialized');
    }

    const exportedKey = await crypto.subtle.exportKey('raw', keypair.privateKey);
    return decrypt(encryptedContent, new Uint8Array(exportedKey));
  }
}
