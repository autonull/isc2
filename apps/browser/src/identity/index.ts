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

const DB_NAME = 'isc-identity';
const DB_VERSION = 1;
const STORE_NAME = 'keypairs';

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

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  async get(id: string): Promise<StoredKeypair | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async put(data: StoredKeypair): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const dbStore = new IndexedDBStore();
const DEFAULT_KEYPAIR_ID = 'default';

export async function initializeIdentity(passphrase?: string): Promise<IdentityManager> {
  const stored = await dbStore.get(DEFAULT_KEYPAIR_ID);

  if (stored) {
    if (stored.encryptedPrivateKey && stored.salt && stored.iterations) {
      if (!passphrase) {
        throw new Error('Passphrase required for encrypted identity');
      }
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
    await dbStore.put({
      id: DEFAULT_KEYPAIR_ID,
      publicKey: pubKeyBytes,
      createdAt: Date.now(),
    });
    identityState = setIdentityState(keypair, false);
  }

  identityState.publicKeyFingerprint = await formatKeyFingerprint(keypair.publicKey);
  return identityState;
}

export { validatePassphraseStrength };

/**
 * Get the current peer ID (public key fingerprint)
 */
export const getPeerID = async (): Promise<string> => {
  if (!identityState.publicKeyFingerprint) {
    identityState.publicKeyFingerprint = await formatKeyFingerprint(identityState.keypair!.publicKey);
  }
  return identityState.publicKeyFingerprint;
};

/**
 * Get the current keypair
 */
export const getKeypair = (): CryptoKeyPair | null => identityState.keypair;
