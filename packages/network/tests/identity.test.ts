/**
 * ISC Identity Service - Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IdentityService, createIdentityService } from '../src/identity.js';

// In-memory storage for testing
class MemoryStorage {
  private data: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

describe('IdentityService', () => {
  let storage: MemoryStorage;
  let service: IdentityService;

  beforeEach(() => {
    storage = new MemoryStorage();
    service = createIdentityService(storage);
  });

  it('should create new identity on initialize', async () => {
    await service.initialize();
    
    expect(service.isInitialized()).toBe(true);
    expect(service.getPeerId()).toBeDefined();
    expect(service.getPublicKey()).toBeDefined();
  });

  it('should generate valid peer ID', async () => {
    await service.initialize();
    
    const peerId = service.getPeerId();
    expect(peerId).toBeDefined();
    // Peer ID should be colon-separated hex pairs
    expect(peerId?.split(':')).toHaveLength(8);
  });

  it('should sign data', async () => {
    await service.initialize();
    
    const data = 'Hello, World!';
    const signature = await service.sign(data);
    
    expect(signature).toBeDefined();
    expect(signature.length).toBeGreaterThan(0);
  });

  it('should verify signature', async () => {
    await service.initialize();
    
    const data = 'Test data for signing';
    const signature = await service.sign(data);
    const publicKey = service.getKeypair()?.publicKey;
    
    expect(publicKey).toBeDefined();
    const valid = await service.verify(data, signature, publicKey!);
    expect(valid).toBe(true);
  });

  it('should reject invalid signature', async () => {
    await service.initialize();
    
    const data = 'Original data';
    const signature = await service.sign(data);
    const publicKey = service.getKeypair()?.publicKey;
    
    // Try to verify with different data
    const valid = await service.verify('Tampered data', signature, publicKey!);
    expect(valid).toBe(false);
  });

  it('should persist identity to storage', async () => {
    await service.initialize();
    
    const peerId = service.getPeerId();
    
    // Create new service instance
    const service2 = createIdentityService(storage);
    await service2.initialize();
    
    expect(service2.getPeerId()).toBe(peerId);
  });

  it('should update profile', async () => {
    await service.initialize();
    
    await service.updateProfile({
      name: 'Test User',
      bio: 'Test bio',
    });
    
    const identity = service.getIdentity();
    expect(identity?.name).toBe('Test User');
    expect(identity?.bio).toBe('Test bio');
  });

  it('should export identity', async () => {
    await service.initialize();
    
    const exported = await service.exportIdentity();
    expect(exported).toBeDefined();
    expect(exported).toContain('peerId');
    expect(exported).toContain('publicKey');
  });

  it('should import identity', async () => {
    await service.initialize();
    
    const exported = await service.exportIdentity();
    
    // Create new service and import
    const service2 = createIdentityService(storage);
    await service2.importIdentity(exported);
    
    expect(service2.getPeerId()).toBe(service.getPeerId());
  });

  it('should clear identity', async () => {
    await service.initialize();
    const peerId = service.getPeerId();
    expect(peerId).toBeDefined();
    
    await service.clear();
    
    expect(service.isInitialized()).toBe(false);
    expect(service.getPeerId()).toBeNull();
  });

  it('should handle string and Uint8Array for signing', async () => {
    await service.initialize();
    
    // String data
    const sig1 = await service.sign('string data');
    expect(sig1).toBeDefined();
    
    // Uint8Array data
    const encoder = new TextEncoder();
    const data = encoder.encode('uint8array data');
    const sig2 = await service.sign(data);
    expect(sig2).toBeDefined();
  });

  it('should generate consistent peer IDs', async () => {
    await service.initialize();
    const peerId1 = service.getPeerId();
    
    // Clear and reinitialize
    await service.clear();
    await service.initialize();
    const peerId2 = service.getPeerId();
    
    // Different identities should have different peer IDs
    expect(peerId1).not.toBe(peerId2);
  });
});

describe('IdentityService Edge Cases', () => {
  it('should handle corrupted storage data', async () => {
    const storage = new MemoryStorage();
    await storage.set('isc-identity', 'invalid json');
    
    const service = createIdentityService(storage);
    
    // Should create new identity instead of failing
    await expect(service.initialize()).resolves.not.toThrow();
    expect(service.isInitialized()).toBe(true);
  });

  it('should handle missing storage data', async () => {
    const storage = new MemoryStorage();
    const service = createIdentityService(storage);
    
    await service.initialize();
    expect(service.isInitialized()).toBe(true);
  });
});
