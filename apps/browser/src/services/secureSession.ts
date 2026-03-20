/**
 * Secure Session Service
 *
 * Manages encrypted chat sessions with forward secrecy using the Double Ratchet protocol.
 */

import {
  initializeRatchet,
  initializeRatchetFromFirstMessage,
  ratchetForSend,
  ratchetForReceive,
  encryptMessage,
  decryptMessage,
  serializeRatchetState,
  deserializeRatchetState,
  getRatchetPublicKey,
  type RatchetState,
} from '@isc/core';
import { getDB, dbGet, dbPut, dbDelete } from '../db/factory.js';
import { getPeerID } from '../identity/index.js';

const DB_NAME = 'isc-sessions';
const DB_VERSION = 1;
const STORE_NAME = 'ratchet_states';

export interface SessionInitMessage {
  type: 'session_init';
  initiatorPublic: Uint8Array;
  initiatorIdentity: string;
  timestamp: number;
}

interface EncryptedPayload {
  encryptedContent: Uint8Array;
  mac: Uint8Array;
  iv: Uint8Array;
  messageNumber: number;
  dhPublic: Uint8Array;
}

export class SecureSession {
  private state: RatchetState | null = null;
  private initialized = false;

  constructor(private readonly conversationId: string) {}

  async initiate(remoteIdentity: Uint8Array): Promise<SessionInitMessage> {
    this.state = await initializeRatchet(await this.getLocalIdentity(), remoteIdentity);
    this.initialized = true;
    await this.saveState();

    return {
      type: 'session_init',
      initiatorPublic: getRatchetPublicKey(this.state),
      initiatorIdentity: await getPeerID(),
      timestamp: Date.now(),
    };
  }

  async accept(initMessage: SessionInitMessage, remoteIdentity: Uint8Array): Promise<void> {
    this.state = await initializeRatchetFromFirstMessage(
      await this.getLocalIdentity(),
      remoteIdentity,
      initMessage.initiatorPublic
    );
    this.initialized = true;
    await this.saveState();
  }

  async load(): Promise<boolean> {
    const db = await this.getDB();
    const serialized = await dbGet<string>(db, STORE_NAME, this.conversationId);
    if (!serialized) return false;

    this.state = deserializeRatchetState(serialized);
    this.initialized = true;
    return true;
  }

  async send(plaintext: string): Promise<EncryptedPayload> {
    if (!this.state) throw new Error('Session not initialized');

    const { keys, messageNumber, dhPublic } = await ratchetForSend(this.state);
    const { ciphertext, mac, iv } = await encryptMessage(keys, plaintext);
    await this.saveState();

    return { encryptedContent: ciphertext, mac, iv, messageNumber, dhPublic };
  }

  async receive(
    encryptedContent: Uint8Array,
    mac: Uint8Array,
    iv: Uint8Array,
    messageNumber: number,
    dhPublic: Uint8Array
  ): Promise<string> {
    if (!this.state) throw new Error('Session not initialized');

    const { keys } = await ratchetForReceive(this.state, dhPublic, messageNumber);
    const plaintext = await decryptMessage(keys, encryptedContent, mac, iv);
    await this.saveState();

    return plaintext;
  }

  getPublicKey(): Uint8Array | null {
    return this.state ? getRatchetPublicKey(this.state) : null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    await dbDelete(db, STORE_NAME, this.conversationId);
    this.state = null;
    this.initialized = false;
  }

  private async getLocalIdentity(): Promise<Uint8Array> {
    const { getKeypair } = await import('../identity/index.js');
    const keypair = getKeypair();
    if (!keypair) throw new Error('Identity not initialized');
    const exported = await crypto.subtle.exportKey('raw', keypair.publicKey);
    return new Uint8Array(exported);
  }

  private async saveState(): Promise<void> {
    if (!this.state) return;
    const db = await this.getDB();
    await dbPut(db, STORE_NAME, {
      id: this.conversationId,
      state: serializeRatchetState(this.state),
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    return getDB({ name: DB_NAME, version: DB_VERSION, stores: [STORE_NAME] });
  }
}

export class SecureSessionManager {
  private sessions = new Map<string, SecureSession>();

  getSession(conversationId: string): SecureSession {
    return (
      this.sessions.get(conversationId) ??
      (() => {
        const session = new SecureSession(conversationId);
        this.sessions.set(conversationId, session);
        return session;
      })()
    );
  }

  async initiateSession(
    conversationId: string,
    remoteIdentity: Uint8Array
  ): Promise<SessionInitMessage> {
    return this.getSession(conversationId).initiate(remoteIdentity);
  }

  async acceptSession(
    conversationId: string,
    initMessage: SessionInitMessage,
    remoteIdentity: Uint8Array
  ): Promise<void> {
    return this.getSession(conversationId).accept(initMessage, remoteIdentity);
  }

  async clearAllSessions(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((s) => s.clear()));
    this.sessions.clear();
  }

  async clearSession(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (session) {
      await session.clear();
      this.sessions.delete(conversationId);
    }
  }
}

let sessionManager: SecureSessionManager | null = null;

export function getSecureSessionManager(): SecureSessionManager {
  return (sessionManager ??= new SecureSessionManager());
}

export async function encryptForConversation(
  conversationId: string,
  plaintext: string
): Promise<EncryptedPayload> {
  const session = getSecureSessionManager().getSession(conversationId);
  const loaded = await session.load();
  if (!loaded)
    throw new Error('Session not initialized. Call initiateSession or acceptSession first.');
  return session.send(plaintext);
}

export async function decryptFromConversation(
  conversationId: string,
  encryptedContent: Uint8Array,
  mac: Uint8Array,
  iv: Uint8Array,
  messageNumber: number,
  dhPublic: Uint8Array
): Promise<string> {
  const session = getSecureSessionManager().getSession(conversationId);
  const loaded = await session.load();
  if (!loaded) throw new Error('Session not initialized');
  return session.receive(encryptedContent, mac, iv, messageNumber, dhPublic);
}
