/* eslint-disable */
import {
  generateKeypair,
  exportKeypair,
  importKeypair,
  formatKeyFingerprint,
  encryptPrivateKey,
  decryptPrivateKey,
  validatePassphraseStrength,
  type EncryptedKeypair,
} from '@isc/core';
import { openDB, dbGet, dbPut, dbDelete } from '@isc/adapters';

const DB_NAME = 'isc-identity';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';
const DEFAULT_KEYPAIR_ID = 'default';

export interface IdentityManager {
  keypair: CryptoKeyPair | null;
  publicKeyFingerprint: string | null;
  isInitialized: boolean;
  isEncrypted: boolean;
}

interface StoredKeypair {
  id: string;
  publicKey: Uint8Array;
  encryptedPrivateKey?: Uint8Array;
  salt?: Uint8Array;
  iterations?: number;
  createdAt: number;
}

let identityState: IdentityManager = {
  keypair: null,
  publicKeyFingerprint: null,
  isInitialized: false,
  isEncrypted: false,
};

const setIdentityState = (
  keypair: CryptoKeyPair,
  isEncrypted: boolean = false
): IdentityManager => ({
  keypair,
  publicKeyFingerprint: null,
  isInitialized: true,
  isEncrypted,
});

class IndexedDBStore {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    this.db = await openDB(DB_NAME, DB_VERSION, (database) => {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    });
    return this.db;
  }

  async get(id: string): Promise<StoredKeypair | null> {
    const db = await this.getDB();
    return dbGet<StoredKeypair>(db, STORE_NAME, id);
  }

  async put(data: StoredKeypair): Promise<void> {
    const db = await this.getDB();
    await dbPut(db, STORE_NAME, data);
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    await dbDelete(db, STORE_NAME, id);
  }
}

const dbStore = new IndexedDBStore();

export async function initializeIdentity(passphrase?: string): Promise<IdentityManager> {
  const stored = await dbStore.get(DEFAULT_KEYPAIR_ID);

  if (stored) {
    if (stored.encryptedPrivateKey && stored.salt && stored.iterations) {
      if (!passphrase) throw new Error('Passphrase required for encrypted identity');
      try {
        const encrypted: EncryptedKeypair = {
          publicKey: stored.publicKey,
          encryptedPrivateKey: stored.encryptedPrivateKey,
          salt: stored.salt,
          iterations: stored.iterations,
        };
        const privateKey = await decryptPrivateKey(encrypted, passphrase);
        const keypair = await importKeypair(stored.publicKey, privateKey);
        identityState = setIdentityState(keypair, true);
        identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);
        return identityState;
      } catch {
        throw new Error('Invalid passphrase');
      }
    } else {
      const keypair = await importKeypair(stored.publicKey, stored.publicKey);
      identityState = setIdentityState(keypair, false);
      identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);
      return identityState;
    }
  }

  const keypair = await generateKeypair();
  const exported = await exportKeypair(keypair);

  if (passphrase) {
    const encrypted = await encryptPrivateKey(exported.privateKey, passphrase);
    await dbStore.put({
      id: DEFAULT_KEYPAIR_ID,
      publicKey: exported.publicKey,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      salt: encrypted.salt,
      iterations: encrypted.iterations,
      createdAt: Date.now(),
    });
    identityState = setIdentityState(keypair, true);
  } else {
    await dbStore.put({
      id: DEFAULT_KEYPAIR_ID,
      publicKey: exported.publicKey,
      createdAt: Date.now(),
    });
    identityState = setIdentityState(keypair, false);
  }

  identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);
  return identityState;
}

export async function generateNewIdentity(passphrase?: string): Promise<IdentityManager> {
  await dbStore.delete(DEFAULT_KEYPAIR_ID);
  return initializeIdentity(passphrase);
}

export const getIdentity = (): IdentityManager => identityState;

export const exportIdentity = async (): Promise<string> => {
  const stored = await dbStore.get(DEFAULT_KEYPAIR_ID);
  if (!stored) return '';
  return JSON.stringify({
    publicKey: Array.from(stored.publicKey),
    hasEncryptedPrivateKey: !!stored.encryptedPrivateKey,
    createdAt: stored.createdAt,
  });
};

export async function importIdentity(
  keypairJson: string,
  passphrase?: string
): Promise<IdentityManager> {
  const { publicKey, privateKey } = JSON.parse(keypairJson);
  const pubKeyBytes = new Uint8Array(publicKey);
  const privKeyBytes = new Uint8Array(privateKey);
  const keypair = await importKeypair(pubKeyBytes, privKeyBytes);

  if (passphrase) {
    const encrypted = await encryptPrivateKey(privKeyBytes, passphrase);
    await dbStore.put({
      id: DEFAULT_KEYPAIR_ID,
      publicKey: pubKeyBytes,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      salt: encrypted.salt,
      iterations: encrypted.iterations,
      createdAt: Date.now(),
    });
    identityState = setIdentityState(keypair, true);
  } else {
    await dbStore.put({ id: DEFAULT_KEYPAIR_ID, publicKey: pubKeyBytes, createdAt: Date.now() });
    identityState = setIdentityState(keypair, false);
  }

  identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);
  return identityState;
}

export { validatePassphraseStrength };

export const getPeerID = async (): Promise<string> => {
  if (!identityState.publicKeyFingerprint) {
    identityState.publicKeyFingerprint = await formatKeyFingerprint(
      identityState.keypair!.publicKey
    );
  }
  return identityState.publicKeyFingerprint;
};

export const getKeypair = (): CryptoKeyPair | null => identityState.keypair;

export const getPublicKey = async (): Promise<Uint8Array> => {
  if (!identityState.keypair) throw new Error('Identity not initialized');
  const exported = await exportKeypair(identityState.keypair);
  return exported.publicKey;
};

export const getPeerPublicKey = async (peerID: string): Promise<CryptoKey | null> => {
  const { DelegationClient } = await import('@isc/delegation');
  const client = DelegationClient.getInstance();
  if (!client) return null;

  const key = `/isc/identity/${peerID}/public-key`;
  const encoded = await client.query(key, 1);
  if (encoded.length === 0) return null;

  try {
    const keyData = JSON.parse(new TextDecoder().decode(encoded[0]));
    return crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyData.data),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );
  } catch {
    return null;
  }
};

export const announcePublicKey = async (): Promise<void> => {
  const { DelegationClient } = await import('@isc/delegation');
  const client = DelegationClient.getInstance();
  if (!client || !identityState.keypair) return;

  const peerID = await getPeerID();
  const publicKey = await getPublicKey();
  const key = `/isc/identity/${peerID}/public-key`;
  const payload = JSON.stringify({ peerID, data: Array.from(publicKey) });
  await client.announce(key, new TextEncoder().encode(payload), 86400 * 30);
};

/**
 * Ensure identity is initialized, throwing if not available
 * Use this before operations that require a signed identity
 */
export async function ensureIdentityInitialized(): Promise<IdentityManager> {
  if (identityState.isInitialized && identityState.keypair) {
    return identityState;
  }

  // Try to initialize from storage
  try {
    return await initializeIdentity();
  } catch (err) {
    throw new Error('Identity not initialized: ' + (err as Error).message);
  }
}

// Note: Embedding service is NOT re-exported here to avoid module initialization issues.
// Import directly from './embedding-service.ts' when needed.
