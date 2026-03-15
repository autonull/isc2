/**
 * ISC Identity Service
 * 
 * Manages user identity with Ed25519 keypairs for signing and verification.
 * Provides secure identity storage and cryptographic operations.
 */

export interface Keypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  peerId: string;
}

export interface IdentityData {
  peerId: string;
  publicKey: string; // Base64 encoded
  privateKey: string; // Base64 encoded (encrypted at rest in production)
  name: string;
  bio: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Storage interface for identity persistence
 */
export interface IdentityStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/**
 * Identity service for cryptographic operations
 */
export class IdentityService {
  private keypair: Keypair | null = null;
  private identity: IdentityData | null = null;
  private storage: IdentityStorage;
  private storageKey: string;
  private initialized = false;

  constructor(storage: IdentityStorage, storageKey: string = 'isc-identity') {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  /**
   * Check if identity is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.keypair !== null;
  }

  /**
   * Get current keypair
   */
  getKeypair(): Keypair | null {
    return this.keypair;
  }

  /**
   * Get public key as base64 string
   */
  getPublicKey(): string | null {
    if (!this.keypair) return null;
    return this.arrayBufferToBase64(this.keypair.publicKey);
  }

  /**
   * Get peer ID
   */
  getPeerId(): string | null {
    return this.keypair?.peerId || this.identity?.peerId || null;
  }

  /**
   * Get identity data
   */
  getIdentity(): IdentityData | null {
    return this.identity;
  }

  /**
   * Initialize or create identity
   */
  async initialize(passphrase?: string): Promise<void> {
    if (this.initialized) return;

    // Try to load existing identity
    const saved = await this.storage.get(this.storageKey);
    
    if (saved) {
      try {
        const data: IdentityData = JSON.parse(saved);
        this.identity = data;
        this.keypair = {
          publicKey: this.base64ToArrayBuffer(data.publicKey),
          privateKey: this.base64ToArrayBuffer(data.privateKey),
          peerId: data.peerId,
        };
        this.initialized = true;
        console.log('[Identity] Loaded existing identity:', data.peerId);
      } catch (err) {
        console.error('[Identity] Failed to parse saved identity:', err);
        await this.createIdentity(passphrase);
      }
    } else {
      await this.createIdentity(passphrase);
    }
  }

  /**
   * Create new identity
   */
  private async createIdentity(passphrase?: string): Promise<void> {
    try {
      // Generate Ed25519 keypair using Web Crypto API
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519',
        },
        true,
        ['sign', 'verify']
      );

      // Export keys
      const publicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      // Generate peer ID from public key
      const peerId = await this.generatePeerId(publicKey);

      // Create identity data
      this.identity = {
        peerId,
        publicKey: this.arrayBufferToBase64(publicKey),
        privateKey: this.arrayBufferToBase64(privateKey),
        name: 'Anonymous',
        bio: 'ISC User',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.keypair = {
        publicKey: new Uint8Array(publicKey),
        privateKey: new Uint8Array(privateKey),
        peerId,
      };

      // Save to storage
      await this.storage.set(this.storageKey, JSON.stringify(this.identity));

      this.initialized = true;
      console.log('[Identity] Created new identity:', peerId);
    } catch (err) {
      console.error('[Identity] Failed to create identity:', err);
      throw new Error('Failed to create identity: ' + (err as Error).message);
    }
  }

  /**
   * Generate peer ID from public key
   */
  private async generatePeerId(publicKey: ArrayBuffer): Promise<string> {
    // Hash the public key to create a unique peer ID
    const hash = await crypto.subtle.digest('SHA-256', publicKey);
    const hashArray = new Uint8Array(hash);
    
    // Format as colon-separated hex pairs (like IPv6)
    const hexPairs: string[] = [];
    for (let i = 0; i < 8; i++) {
      hexPairs.push(
        hashArray[i * 2].toString(16).padStart(2, '0') +
        hashArray[i * 2 + 1].toString(16).padStart(2, '0')
      );
    }
    
    return hexPairs.join(':');
  }

  /**
   * Sign data with private key
   */
  async sign(data: Uint8Array | string): Promise<Uint8Array> {
    if (!this.keypair) {
      throw new Error('Identity not initialized');
    }

    try {
      // Import private key for signing
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        this.keypair.privateKey,
        { name: 'Ed25519', namedCurve: 'Ed25519' },
        false,
        ['sign']
      );

      // Convert string to Uint8Array if needed
      const dataBytes = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

      // Sign the data
      const signature = await crypto.subtle.sign('Ed25519', privateKey, dataBytes);
      
      return new Uint8Array(signature);
    } catch (err) {
      console.error('[Identity] Signing failed:', err);
      throw new Error('Signing failed: ' + (err as Error).message);
    }
  }

  /**
   * Verify signature
   */
  async verify(
    data: Uint8Array | string,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean> {
    try {
      // Import public key for verification
      const publicKeyObj = await crypto.subtle.importKey(
        'raw',
        publicKey,
        { name: 'Ed25519', namedCurve: 'Ed25519' },
        false,
        ['verify']
      );

      // Convert string to Uint8Array if needed
      const dataBytes = typeof data === 'string' 
        ? new TextEncoder().encode(data)
        : data;

      // Verify the signature
      const valid = await crypto.subtle.verify(
        'Ed25519',
        publicKeyObj,
        signature,
        dataBytes
      );

      return valid;
    } catch (err) {
      console.error('[Identity] Verification failed:', err);
      return false;
    }
  }

  /**
   * Update identity profile
   */
  async updateProfile(updates: { name?: string; bio?: string }): Promise<void> {
    if (!this.identity) {
      throw new Error('Identity not initialized');
    }

    this.identity = {
      ...this.identity,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.storage.set(this.storageKey, JSON.stringify(this.identity));
    console.log('[Identity] Profile updated');
  }

  /**
   * Export identity for backup
   */
  async exportIdentity(passphrase?: string): Promise<string> {
    if (!this.identity) {
      throw new Error('Identity not initialized');
    }

    // In production, encrypt with passphrase
    // For now, return as JSON
    return JSON.stringify(this.identity, null, 2);
  }

  /**
   * Import identity from backup
   */
  async importIdentity(exportedData: string, passphrase?: string): Promise<void> {
    try {
      const data: IdentityData = JSON.parse(exportedData);
      
      // Validate required fields
      if (!data.peerId || !data.publicKey || !data.privateKey) {
        throw new Error('Invalid identity data');
      }

      this.identity = data;
      this.keypair = {
        publicKey: this.base64ToArrayBuffer(data.publicKey),
        privateKey: this.base64ToArrayBuffer(data.privateKey),
        peerId: data.peerId,
      };

      await this.storage.set(this.storageKey, JSON.stringify(data));
      this.initialized = true;
      
      console.log('[Identity] Imported identity:', data.peerId);
    } catch (err) {
      console.error('[Identity] Import failed:', err);
      throw new Error('Failed to import identity: ' + (err as Error).message);
    }
  }

  /**
   * Clear identity (logout)
   */
  async clear(): Promise<void> {
    await this.storage.delete(this.storageKey);
    this.keypair = null;
    this.identity = null;
    this.initialized = false;
    console.log('[Identity] Identity cleared');
  }

  /**
   * Utility: ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

/**
 * Create identity service with storage
 */
export function createIdentityService(
  storage: IdentityStorage,
  storageKey?: string
): IdentityService {
  return new IdentityService(storage, storageKey);
}
