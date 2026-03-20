/**
 * DM Encryption Service
 *
 * Handles encryption and decryption of direct messages using Double Ratchet
 * for forward secrecy.
 */

import { getPeerPublicKey, getKeypair, getPeerID } from '../../../identity/index.js';
import {
  getSecureSessionManager,
  type SessionInitMessage,
} from '../../../services/secureSession.js';
import type { DirectMessage } from '../types/dm.js';

export interface EncryptedPayload {
  encryptedContent: Uint8Array;
  mac: Uint8Array;
  iv: Uint8Array;
  messageNumber: number;
  dhPublic: Uint8Array;
}

const toBytes = async (key: CryptoKey): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.exportKey('raw', key));

export class DMEncryptionService {
  static async hasSession(recipient: string): Promise<boolean> {
    return getSecureSessionManager().getSession(recipient).load();
  }

  static async initializeSession(recipient: string): Promise<DirectMessage> {
    const recipientKey =
      (await getPeerPublicKey(recipient)) ??
      (() => {
        throw new Error(`Public key not found for recipient: ${recipient}`);
      })();

    const { sign, encode } = await import('@isc/core');
    const sessionManager = getSecureSessionManager();
    const initMessage = await sessionManager.initiateSession(
      recipient,
      await toBytes(recipientKey)
    );

    const keypair =
      getKeypair() ??
      (() => {
        throw new Error('Identity not initialized');
      })();
    const payload = {
      type: 'session_init',
      initiatorPublic: Array.from(initMessage.initiatorPublic),
      initiatorIdentity: initMessage.initiatorIdentity,
      timestamp: initMessage.timestamp,
    };
    const signature = await sign(encode(payload), keypair.privateKey);

    return {
      id: `dm_${crypto.randomUUID()}`,
      type: 'session_init',
      sender: await getPeerID(),
      recipient,
      encryptedContent: new Uint8Array(0),
      timestamp: initMessage.timestamp,
      signature,
      read: false,
      sessionInit: {
        initiatorPublic: initMessage.initiatorPublic,
        initiatorIdentity: initMessage.initiatorIdentity,
      },
    };
  }

  static async acceptSession(dm: DirectMessage): Promise<void> {
    if (!dm.sessionInit) throw new Error('Invalid session init message');

    const senderKey =
      (await getPeerPublicKey(dm.sender)) ??
      (() => {
        throw new Error(`Public key not found for sender: ${dm.sender}`);
      })();

    const sessionInit: SessionInitMessage = {
      type: 'session_init',
      initiatorPublic: dm.sessionInit.initiatorPublic,
      initiatorIdentity: dm.sessionInit.initiatorIdentity,
      timestamp: dm.timestamp,
    };

    await getSecureSessionManager().acceptSession(dm.sender, sessionInit, await toBytes(senderKey));
  }

  static async encryptContent(content: string, recipient: string): Promise<EncryptedPayload> {
    const session = getSecureSessionManager().getSession(recipient);
    const loaded = await session.load();
    if (!loaded) throw new Error(`No session exists with ${recipient}. Initialize session first.`);
    return session.send(content);
  }

  static async decryptContent(dm: DirectMessage): Promise<string> {
    if (!dm.encryptedContent || !dm.mac || !dm.iv || !dm.messageNumber || !dm.dhPublic) {
      throw new Error('Invalid encrypted message: missing ratchet fields');
    }

    const session = getSecureSessionManager().getSession(dm.sender);
    const loaded = await session.load();
    if (!loaded) throw new Error(`No session exists with ${dm.sender}`);

    return session.receive(dm.encryptedContent, dm.mac, dm.iv, dm.messageNumber, dm.dhPublic);
  }

  static async encryptContentLegacy(content: string, recipient: string): Promise<Uint8Array> {
    const { encrypt } = await import('@isc/core');
    const recipientKey =
      (await getPeerPublicKey(recipient)) ??
      (() => {
        throw new Error(`Public key not found for recipient: ${recipient}`);
      })();
    return encrypt(content, await toBytes(recipientKey));
  }

  static async decryptContentLegacy(encryptedContent: Uint8Array): Promise<string> {
    const { decrypt } = await import('@isc/core');
    const keypair =
      getKeypair() ??
      (() => {
        throw new Error('Identity not initialized');
      })();
    return decrypt(encryptedContent, await toBytes(keypair.privateKey));
  }
}
