/* eslint-disable */
/**
 * DM Encryption Service
 *
 * Handles encryption and decryption of direct messages using Double Ratchet
 * for forward secrecy and sealed sender for relay privacy.
 */

import { getPeerPublicKey, getKeypair, getPeerID } from '../../../identity/index.ts';
import {
  getSecureSessionManager,
  type SessionInitMessage,
} from '../../../services/secureSession.ts';
import type { DirectMessage } from '../types/dm.ts';
import {
  sealSenderIdentity,
  unsealSenderIdentity,
  type SealedEnvelope,
} from './sealedSender.ts';

export interface EncryptedPayload {
  encryptedContent: Uint8Array;
  mac: Uint8Array;
  iv: Uint8Array;
  messageNumber: number;
  dhPublic: Uint8Array;
  sealedSender?: SealedEnvelope;
}

const toBytes = async (key: CryptoKey): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.exportKey('raw', key));

export class DMEncryptionService {
  static async hasSession(recipient: string): Promise<boolean> {
    return getSecureSessionManager().getSession(recipient).load();
  }

  static async sealForRelay(recipient: string): Promise<SealedEnvelope | null> {
    const recipientKey = await getPeerPublicKey(recipient);
    if (!recipientKey) return null;

    const senderId = await getPeerID();
    if (!senderId) return null;

    return sealSenderIdentity(senderId, await toBytes(recipientKey));
  }

  static async unsealFromRelay(
    sealed: SealedEnvelope,
    recipientPrivateKey: CryptoKey
  ): Promise<string | null> {
    try {
      const unsealed = await unsealSenderIdentity(sealed, recipientPrivateKey);
      return unsealed.senderId;
    } catch {
      return null;
    }
  }

  static isSealedMessage(dm: DirectMessage): boolean {
    return !!dm.sealedSender;
  }

  static async handleSealedMessage(
    dm: DirectMessage
  ): Promise<{ senderId: string; content: string } | null> {
    if (!dm.sealedSender) return null;

    const keypair = getKeypair();
    if (!keypair) return null;

    try {
      const senderId = await this.unsealFromRelay(dm.sealedSender, keypair.privateKey);
      if (!senderId) return null;

      const content = await this.decryptContent(dm);
      return { senderId, content };
    } catch {
      return null;
    }
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
