/**
 * Nostr Identity Bridge
 *
 * Allows users to import an existing Nostr identity (nsec) and use it as their
 * ISC peer identity, enabling cross-platform social graph interoperability.
 *
 * Nostr uses secp256k1 ECDSA; ISC uses Ed25519. This bridge derives a
 * deterministic Ed25519 keypair from the Nostr secp256k1 private key using
 * HKDF-SHA256, ensuring the Nostr nsec controls the derived ISC identity.
 */

import { importKeypair } from '@isc/core';

const NOSTR_IDENTITY_ID = 'nostr-linked';
const NOSTR_KIND = 0;
const ISC_DERIVATION_CONTEXT = 'ISC-NOSTR-BRIDGE-v1';

interface NostrLinkedIdentity {
  id: string;
  nostrPubkey: string; // hex-encoded npub
  derivedIscPubkey: Uint8Array;
  nostrPubkeyCreatedAt: number;
  linkedAt: number;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function bech32ToHex(str: string): string {
  const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const PARTITION = str.toLowerCase().split('1');
  if (PARTITION.length !== 2) throw new Error('Invalid nostr nsec format');

  const PREFIX = PARTITION[0];
  const DATA = PARTITION[1];

  if (PREFIX !== 'nsec') throw new Error('Invalid nsec prefix; expected "nsec"');

  const values: number[] = [];
  for (const char of DATA) {
    const idx = BECH32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid character in nsec: ${char}`);
    values.push(idx);
  }

  const dataBits: number[] = [];
  for (const v of values) {
    for (let i = 4; i >= 0; i--) {
      dataBits.push((v >> i) & 1);
    }
  }

  const fullBytes = Math.floor(dataBits.length / 5) * 5;
  const bytes: number[] = [];
  for (let i = 0; i < fullBytes; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | dataBits[i + j];
    }
    bytes.push(byte);
  }

  const padded = dataBits.length % 5;
  if (padded > 0) {
    let last = 0;
    for (let i = 0; i < padded; i++) {
      last = (last << 1) | dataBits[fullBytes + i];
    }
    last <<= 5 - padded;
    bytes.push(last);
  }

  return bytesToHex(new Uint8Array(bytes.slice(1)));
}

async function deriveEd25519FromSecp256k1(secp256k1Scalar: Uint8Array): Promise<CryptoKeyPair> {
  const contextBytes = new TextEncoder().encode(ISC_DERIVATION_CONTEXT);
  const info = new Uint8Array(contextBytes.length + 1);
  info.set(contextBytes, 0);
  info[contextBytes.length] = 1;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secp256k1Scalar.buffer as unknown as ArrayBuffer,
    'HKDF',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info,
    },
    keyMaterial,
    256
  );

  const seed = new Uint8Array(derivedBits);

  return crypto.subtle
    .generateKey({ name: 'Ed25519' }, false, ['sign', 'verify'])
    .then(async (keyPair) => {
      const privateKeyBytes = seed.slice(0, 32);
      const publicKeyBytes = seed.slice(32, 64);

      const importedPrivateKey = await crypto.subtle.importKey(
        'raw',
        privateKeyBytes,
        { name: 'Ed25519' },
        true,
        ['sign']
      );

      const importedPublicKey = await crypto.subtle.importKey(
        'raw',
        publicKeyBytes,
        { name: 'Ed25519' },
        true,
        ['verify']
      );

      return { privateKey: importedPrivateKey, publicKey: importedPublicKey } as CryptoKeyPair;
    });
}

async function deriveEd25519FromNsec(
  nsec: string
): Promise<{ keypair: CryptoKeyPair; nostrPubkey: string }> {
  const hexPriv = bech32ToHex(nsec);
  const privBytes = hexToBytes(hexPriv);

  const keypair = await deriveEd25519FromSecp256k1(privBytes);

  const pubBytes = await crypto.subtle.exportKey('raw', keypair.publicKey);
  const nostrPubkey = bytesToHex(new Uint8Array(pubBytes));

  return { keypair, nostrPubkey };
}

export async function importNostrIdentity(
  nsec: string
): Promise<{ nostrPubkey: string; iscPubkey: string }> {
  const { keypair, nostrPubkey } = await deriveEd25519FromNsec(nsec);

  const exported = await exportKeypair(keypair);

  const linkedIdentity: NostrLinkedIdentity = {
    id: NOSTR_IDENTITY_ID,
    nostrPubkey,
    derivedIscPubkey: exported.publicKey,
    nostrPubkeyCreatedAt: Date.now(),
    linkedAt: Date.now(),
  };

  const nostrStore = new NostrIdentityStore();
  await nostrStore.put(linkedIdentity);

  const iscPubkey = bytesToHex(exported.publicKey);
  return { nostrPubkey, iscPubkey };
}

export async function exportNostrLinkedPubkey(): Promise<string | null> {
  const nostrStore = new NostrIdentityStore();
  const linked = await nostrStore.get(NOSTR_IDENTITY_ID);
  return linked?.nostrPubkey ?? null;
}

export async function isNostrLinked(): Promise<boolean> {
  const nostrStore = new NostrIdentityStore();
  const linked = await nostrStore.get(NOSTR_IDENTITY_ID);
  return !!linked;
}

export async function unlinkNostrIdentity(): Promise<void> {
  const nostrStore = new NostrIdentityStore();
  await nostrStore.delete(NOSTR_IDENTITY_ID);
}

function exportKeypair(
  keypair: CryptoKeyPair
): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  return Promise.all([
    crypto.subtle.exportKey('raw', keypair.publicKey),
    crypto.subtle.exportKey('raw', keypair.privateKey),
  ]).then(([publicKey, privateKey]) => ({
    publicKey: new Uint8Array(publicKey),
    privateKey: new Uint8Array(privateKey),
  }));
}

function importEd25519Keypair(
  publicKey: Uint8Array,
  privateKey: Uint8Array
): Promise<CryptoKeyPair> {
  return Promise.all([
    crypto.subtle.importKey(
      'raw',
      publicKey.buffer as unknown as ArrayBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    ),
    crypto.subtle.importKey(
      'raw',
      privateKey.buffer as unknown as ArrayBuffer,
      { name: 'Ed25519' },
      true,
      ['sign']
    ),
  ]).then(([publicKeyKey, privateKeyKey]) => ({
    publicKey: publicKeyKey,
    privateKey: privateKeyKey,
  }));
}

export async function loadNostrLinkedKeypair(): Promise<CryptoKeyPair | null> {
  const nostrStore = new NostrIdentityStore();
  const linked = await nostrStore.get(NOSTR_IDENTITY_ID);
  if (!linked) return null;

  const derived = await deriveEd25519FromNsec(linked.nostrPubkey);
  return derived.keypair;
}

export async function getNostrProfile(
  npub: string
): Promise<{ name?: string; about?: string; picture?: string } | null> {
  try {
    const hex = bech32ToHex(npub);
    const response = await fetch(`https://nos.li/${hex}.json`);
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

export function formatNpub(npub: string): string {
  if (npub.length <= 12) return npub;
  return `${npub.slice(0, 6)}...${npub.slice(-4)}`;
}

export function validateNsec(nsec: string): boolean {
  try {
    bech32ToHex(nsec);
    return true;
  } catch {
    return false;
  }
}

class NostrIdentityStore {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'isc-identity';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'nostr-links';

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  async get(id: string): Promise<NostrLinkedIdentity | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.get(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result ?? null);
    });
  }

  async put(data: NostrLinkedIdentity): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.put(data);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.delete(id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  }
}
