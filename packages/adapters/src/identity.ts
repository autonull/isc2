/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await, @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-imports, @typescript-eslint/prefer-promise-reject-errors, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-redundant-type-constituents */
/**
 * Identity Adapters
 *
 * Universal identity interface with browser and node implementations.
 */

import {
  generateKeypair,
  exportKeypair,
  importKeypair,
  sign,
  verify,
  type Keypair as CoreKeypair,
  type Signature,
} from '@isc/core';

export interface Keypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  peerId: string;
}

export interface IdentityData {
  peerId: string;
  publicKey: string;
  privateKey: string;
  name: string;
  bio: string;
  createdAt: number;
  updatedAt: number;
}

export interface IdentityAdapter {
  initialize(): Promise<void>;
  isInitialized(): boolean;
  getIdentity(): IdentityData | null;
  getKeypair(): Keypair | null;
  getPeerId(): string | null;
  getName(): string | null;
  getPublicKey(): Uint8Array | null;
  sign(data: Uint8Array | string): Promise<Uint8Array>;
  verify(data: Uint8Array | string, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
  updateProfile(profile: { name: string; bio: string }): Promise<void>;
  create(name: string, bio: string): Promise<void>;
  logout(): Promise<void>;
  exportIdentity(): Promise<string>;
  importIdentity(data: string): Promise<void>;
  clear(): Promise<void>;
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function generatePeerId(publicKey: Uint8Array): string {
  // Generate a peer ID in the format: 8 colon-separated hex pairs
  const pairs: string[] = [];
  for (let i = 0; i < 8 && i * 2 + 1 < publicKey.length; i++) {
    const pair = ((publicKey[i * 2] << 8) | publicKey[i * 2 + 1]).toString(16).padStart(4, '0');
    pairs.push(pair);
  }
  return pairs.join(':');
}

export class BrowserIdentity implements IdentityAdapter {
  private keypair: Keypair | null = null;
  private coreKeypair: CoreKeypair | null = null;
  private identity: IdentityData | null = null;
  private storageKey: string;
  private initialized = false;

  constructor(storageKey: string = 'isc-identity') {
    this.storageKey = storageKey;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored) as IdentityData;
        this.identity = data;
        const publicKeyBytes = base64ToArrayBuffer(data.publicKey);
        const privateKeyBytes = base64ToArrayBuffer(data.privateKey);
        this.coreKeypair = await importKeypair(publicKeyBytes, privateKeyBytes);
        this.keypair = {
          publicKey: publicKeyBytes,
          privateKey: privateKeyBytes,
          peerId: data.peerId,
        };
        this.initialized = true;
        return;
      }
    } catch {
      // Corrupted or invalid data, will create new identity
    }

    // Auto-create a new identity if none exists or loading failed
    await this.create('Anonymous', '');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getIdentity(): IdentityData | null {
    return this.identity;
  }

  getKeypair(): Keypair | null {
    return this.keypair;
  }

  getPeerId(): string | null {
    return this.keypair?.peerId ?? this.identity?.peerId ?? null;
  }

  getName(): string | null {
    return this.identity?.name ?? null;
  }

  getPublicKey(): Uint8Array | null {
    return this.keypair?.publicKey ?? null;
  }

  async sign(data: Uint8Array | string): Promise<Uint8Array> {
    if (!this.coreKeypair) {
      throw new Error('Identity not initialized');
    }
    const inputData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const result = await sign(inputData, this.coreKeypair.privateKey);
    return result.data;
  }

  async verify(data: Uint8Array | string, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    const inputData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const sig: Signature = { data: signature, algorithm: 'Ed25519' };
    // Import the raw public key as a CryptoKey
    const publicKeyCrypto = await globalThis.crypto.subtle.importKey(
      'raw',
      publicKey as BufferSource,
      { name: 'Ed25519', namedCurve: 'Ed25519' } as any,
      true,
      ['verify']
    );
    return verify(inputData, sig, publicKeyCrypto);
  }

  async updateProfile(profile: { name: string; bio: string }): Promise<void> {
    if (!this.identity || !this.keypair) {
      throw new Error('Identity not initialized');
    }

    this.identity.name = profile.name;
    this.identity.bio = profile.bio;
    this.identity.updatedAt = Date.now();

    localStorage.setItem(this.storageKey, JSON.stringify(this.identity));
  }

  async create(name: string, bio: string): Promise<void> {
    const coreKp = await generateKeypair();
    const exported = await exportKeypair(coreKp);
    const peerId = generatePeerId(exported.publicKey);

    const identity: IdentityData = {
      peerId,
      publicKey: arrayBufferToBase64(exported.publicKey),
      privateKey: arrayBufferToBase64(exported.privateKey),
      name,
      bio,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.coreKeypair = coreKp;
    this.keypair = {
      publicKey: exported.publicKey,
      privateKey: exported.privateKey,
      peerId,
    };
    this.identity = identity;
    this.initialized = true;

    localStorage.setItem(this.storageKey, JSON.stringify(identity));
  }

  async logout(): Promise<void> {
    this.coreKeypair = null;
    this.keypair = null;
    this.identity = null;
    this.initialized = false;
    localStorage.removeItem(this.storageKey);
  }

  async exportIdentity(): Promise<string> {
    if (!this.identity) {
      throw new Error('No identity to export');
    }
    return JSON.stringify(this.identity);
  }

  async importIdentity(data: string): Promise<void> {
    const identity = JSON.parse(data) as IdentityData;
    this.identity = identity;
    const publicKeyBytes = base64ToArrayBuffer(identity.publicKey);
    const privateKeyBytes = base64ToArrayBuffer(identity.privateKey);
    this.coreKeypair = await importKeypair(publicKeyBytes, privateKeyBytes);
    this.keypair = {
      publicKey: publicKeyBytes,
      privateKey: privateKeyBytes,
      peerId: identity.peerId,
    };
    this.initialized = true;
    localStorage.setItem(this.storageKey, JSON.stringify(identity));
  }

  async clear(): Promise<void> {
    await this.logout();
  }
}

export class NodeIdentity implements IdentityAdapter {
  private keypair: Keypair | null = null;
  private coreKeypair: CoreKeypair | null = null;
  private identity: IdentityData | null = null;
  private storage: import('./storage.ts').StorageAdapter | null = null;
  private storageKey: string;
  private initialized = false;

  constructor(storage: import('./storage.ts').StorageAdapter, storageKey: string = 'isc-identity') {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {return;}
    if (!this.storage) {throw new Error('Storage not provided');}

    try {
      const stored = await this.storage.get<string>(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored) as IdentityData;
        this.identity = data;
        const publicKeyBytes = base64ToArrayBuffer(data.publicKey);
        const privateKeyBytes = base64ToArrayBuffer(data.privateKey);
        this.coreKeypair = await importKeypair(publicKeyBytes, privateKeyBytes);
        this.keypair = {
          publicKey: publicKeyBytes,
          privateKey: privateKeyBytes,
          peerId: data.peerId,
        };
        this.initialized = true;
        return;
      }
    } catch {
      // Corrupted or invalid data, will create new identity
    }

    // Auto-create a new identity if none exists or loading failed
    await this.create('Anonymous', '');
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getIdentity(): IdentityData | null {
    return this.identity;
  }

  getKeypair(): Keypair | null {
    return this.keypair;
  }

  getPeerId(): string | null {
    return this.keypair?.peerId ?? this.identity?.peerId ?? null;
  }

  getName(): string | null {
    return this.identity?.name ?? null;
  }

  getPublicKey(): Uint8Array | null {
    return this.keypair?.publicKey ?? null;
  }

  async sign(data: Uint8Array | string): Promise<Uint8Array> {
    if (!this.coreKeypair) {
      throw new Error('Identity not initialized');
    }
    const inputData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const result = await sign(inputData, this.coreKeypair.privateKey);
    return result.data;
  }

  async verify(data: Uint8Array | string, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean> {
    const inputData = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const sig: Signature = { data: signature, algorithm: 'Ed25519' };
    // Import the raw public key as a CryptoKey
    const publicKeyCrypto = await globalThis.crypto.subtle.importKey(
      'raw',
      publicKey as BufferSource,
      { name: 'Ed25519', namedCurve: 'Ed25519' } as any,
      true,
      ['verify']
    );
    return verify(inputData, sig, publicKeyCrypto);
  }

  async updateProfile(profile: { name: string; bio: string }): Promise<void> {
    if (!this.identity || !this.keypair) {
      throw new Error('Identity not initialized');
    }
    if (!this.storage) {throw new Error('Storage not initialized');}

    this.identity.name = profile.name;
    this.identity.bio = profile.bio;
    this.identity.updatedAt = Date.now();

    await this.storage.set(this.storageKey, JSON.stringify(this.identity));
  }

  async create(name: string, bio: string): Promise<void> {
    if (!this.storage) {throw new Error('Storage not initialized');}

    const coreKp = await generateKeypair();
    const exported = await exportKeypair(coreKp);
    const peerId = generatePeerId(exported.publicKey);

    const identity: IdentityData = {
      peerId,
      publicKey: arrayBufferToBase64(exported.publicKey),
      privateKey: arrayBufferToBase64(exported.privateKey),
      name,
      bio,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.coreKeypair = coreKp;
    this.keypair = {
      publicKey: exported.publicKey,
      privateKey: exported.privateKey,
      peerId,
    };
    this.identity = identity;
    this.initialized = true;

    await this.storage.set(this.storageKey, JSON.stringify(identity));
  }

  async logout(): Promise<void> {
    if (!this.storage) {throw new Error('Storage not initialized');}

    this.coreKeypair = null;
    this.keypair = null;
    this.identity = null;
    this.initialized = false;

    await this.storage.delete(this.storageKey);
  }

  async exportIdentity(): Promise<string> {
    if (!this.identity) {
      throw new Error('No identity to export');
    }
    return JSON.stringify(this.identity);
  }

  async importIdentity(data: string): Promise<void> {
    if (!this.storage) {throw new Error('Storage not initialized');}

    const identity = JSON.parse(data) as IdentityData;
    this.identity = identity;
    const publicKeyBytes = base64ToArrayBuffer(identity.publicKey);
    const privateKeyBytes = base64ToArrayBuffer(identity.privateKey);
    this.coreKeypair = await importKeypair(publicKeyBytes, privateKeyBytes);
    this.keypair = {
      publicKey: publicKeyBytes,
      privateKey: privateKeyBytes,
      peerId: identity.peerId,
    };
    this.initialized = true;
    await this.storage.set(this.storageKey, JSON.stringify(identity));
  }

  async clear(): Promise<void> {
    await this.logout();
  }
}

export function createIdentity(
  storage?: import('./storage.ts').StorageAdapter,
  storageKey?: string
): IdentityAdapter {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    return new BrowserIdentity(storageKey);
  }

  if (!storage) {
    throw new Error('Storage adapter required for Node identity');
  }

  return new NodeIdentity(storage, storageKey);
}
