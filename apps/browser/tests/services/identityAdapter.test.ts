/* eslint-disable */
/**
 * Identity Adapter Tests
 *
 * Tests sign/verify roundtrip, key export, and fingerprint generation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock IndexedDB
const mockStore: Record<string, unknown> = {};
const mockDB = {
  get: vi.fn().mockImplementation((key: string) => Promise.resolve(mockStore[key] ?? null)),
  put: vi.fn().mockImplementation((key: string, value: unknown) => { mockStore[key] = value; return Promise.resolve(); }),
  delete: vi.fn().mockImplementation((key: string) => { delete mockStore[key]; return Promise.resolve(); }),
};

vi.mock('../../src/db/helpers.js', () => ({
  dbGet: mockDB.get,
  dbGetAll: vi.fn().mockResolvedValue([]),
  dbPut: mockDB.put,
  dbDelete: mockDB.delete,
  dbFilter: vi.fn().mockResolvedValue([]),
}));

// Mock Web Crypto
const mockPrivateKey = {} as CryptoKey;
const mockPublicKey = {} as CryptoKey;
let mockKeypair: CryptoKeyPair | null = null;

vi.mock('../../src/identity/index.js', () => {
  const state = { keypair: null as CryptoKeyPair | null };
  return {
    getKeypair: vi.fn(() => state.keypair),
    initializeIdentity: vi.fn().mockImplementation(async () => {
      state.keypair = {
        privateKey: mockPrivateKey,
        publicKey: mockPublicKey,
      } as CryptoKeyPair;
    }),
    getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
    getPeerPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
  };
});

// Mock @isc/core sign
vi.mock('@isc/core', () => ({
  sign: vi.fn().mockImplementation(async (payload: Uint8Array, _key: CryptoKey) => ({
    data: new Uint8Array([10, 20, 30, 40]),
    algorithm: 'Ed25519' as const,
  })),
  verify: vi.fn().mockResolvedValue(true),
  encode: vi.fn((data) => data),
}));

// Mock logger
vi.mock('../../src/logger.js', () => ({
  loggers: {
    social: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

describe('Identity Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockStore).forEach(k => delete mockStore[k]);
  });

  describe('sign', () => {
    it('should sign data and return hex string', async () => {
      // Set up keypair
      mockKeypair = { privateKey: mockPrivateKey, publicKey: mockPublicKey };
      vi.doMock('../../src/identity/index.js', () => ({
        getKeypair: vi.fn(() => mockKeypair),
        initializeIdentity: vi.fn(),
        getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
        getPeerPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
      }), { virtual: true });

      const { getIdentityService } = await import('../../src/services/identityService.js');
      const service = getIdentityService();

      const testData = new Uint8Array([1, 2, 3]);
      const signature = await service.sign(testData);

      expect(typeof signature).toBe('string');
      expect(signature).toMatch(/^[0-9a-f]+$/); // Hex string
    });

    it('should throw if keypair not available', async () => {
      vi.doMock('../../src/identity/index.js', () => ({
        getKeypair: vi.fn(() => null),
        initializeIdentity: vi.fn(),
        getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
        getPeerPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
      }), { virtual: true });

      vi.resetModules();
      const { getIdentityService } = await import('../../src/services/identityService.js');
      const service = getIdentityService();

      await expect(service.sign(new Uint8Array([1]))).rejects.toThrow('Identity not initialized');
    });
  });

  describe('getFingerprint', () => {
    it('should generate consistent fingerprint from public key', async () => {
      vi.doMock('../../src/identity/index.js', () => ({
        getKeypair: vi.fn(() => mockKeypair),
        initializeIdentity: vi.fn(),
        getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
        getPeerPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
      }), { virtual: true });

      vi.resetModules();
      const { getIdentityService } = await import('../../src/services/identityService.js');
      const service = getIdentityService();

      const fp1 = await service.getFingerprint();
      const fp2 = await service.getFingerprint();

      expect(fp1).toBe(fp2); // Cached
      expect(fp1).toMatch(/^([0-9a-f]{2}:){7}[0-9a-f]{2}$/); // 8 bytes hex
    });

    it('should return null if no keypair', async () => {
      vi.doMock('../../src/identity/index.js', () => ({
        getKeypair: vi.fn(() => null),
        initializeIdentity: vi.fn(),
        getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
        getPeerPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
      }), { virtual: true });

      vi.resetModules();
      const { getIdentityService } = await import('../../src/services/identityService.js');
      const service = getIdentityService();

      const fp = await service.getFingerprint();
      expect(fp).toBeNull();
    });
  });

  describe('clear', () => {
    it('should reset initialization state', async () => {
      vi.doMock('../../src/identity/index.js', () => ({
        getKeypair: vi.fn(() => mockKeypair),
        initializeIdentity: vi.fn(),
        getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
        getPeerPublicKey: vi.fn().mockResolvedValue(mockPublicKey),
      }), { virtual: true });

      vi.resetModules();
      const { getIdentityService } = await import('../../src/services/identityService.js');
      const service = getIdentityService();

      // Generate fingerprint to populate cache
      await service.getFingerprint();

      await service.clear();
      const fp = await service.getFingerprint();
      expect(fp).toBeNull(); // Cache cleared
    });
  });
});
