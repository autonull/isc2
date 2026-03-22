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
  sign(data: Uint8Array): Promise<Uint8Array>;
  verify(data: Uint8Array, signature: Uint8Array): Promise<boolean>;
  updateProfile(name: string, bio: string): Promise<void>;
  create(name: string, bio: string): Promise<void>;
  logout(): Promise<void>;
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
  let hash = 0;
  for (let i = 0; i < Math.min(16, publicKey.length); i++) {
    hash = (hash << 5) - hash + publicKey[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
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
    if (this.initialized) return;

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
      }
    } catch {
      // No stored identity
    }
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

  async sign(data: Uint8Array): Promise<Uint8Array> {
    if (!this.coreKeypair) {
      throw new Error('Identity not initialized');
    }
    const result = await sign(data, this.coreKeypair.privateKey);
    return result.data;
  }

  async verify(data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    if (!this.coreKeypair) {
      throw new Error('Identity not initialized');
    }
    const sig: Signature = { data: signature, algorithm: 'Ed25519' };
    return verify(data, sig, this.coreKeypair.publicKey);
  }

  async updateProfile(name: string, bio: string): Promise<void> {
    if (!this.identity || !this.keypair) {
      throw new Error('Identity not initialized');
    }

    this.identity.name = name;
    this.identity.bio = bio;
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
    if (this.initialized) return;
    if (!this.storage) throw new Error('Storage not provided');

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
      }
    } catch {
      // No stored identity
    }
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

  async sign(data: Uint8Array): Promise<Uint8Array> {
    if (!this.coreKeypair) {
      throw new Error('Identity not initialized');
    }
    const result = await sign(data, this.coreKeypair.privateKey);
    return result.data;
  }

  async verify(data: Uint8Array, signature: Uint8Array): Promise<boolean> {
    if (!this.coreKeypair) {
      throw new Error('Identity not initialized');
    }
    const sig: Signature = { data: signature, algorithm: 'Ed25519' };
    return verify(data, sig, this.coreKeypair.publicKey);
  }

  async updateProfile(name: string, bio: string): Promise<void> {
    if (!this.identity || !this.keypair) {
      throw new Error('Identity not initialized');
    }
    if (!this.storage) throw new Error('Storage not initialized');

    this.identity.name = name;
    this.identity.bio = bio;
    this.identity.updatedAt = Date.now();

    await this.storage.set(this.storageKey, JSON.stringify(this.identity));
  }

  async create(name: string, bio: string): Promise<void> {
    if (!this.storage) throw new Error('Storage not initialized');

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
    if (!this.storage) throw new Error('Storage not initialized');

    this.coreKeypair = null;
    this.keypair = null;
    this.identity = null;
    this.initialized = false;

    await this.storage.delete(this.storageKey);
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
