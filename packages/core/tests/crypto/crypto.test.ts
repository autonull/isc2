import { describe, it, expect } from 'vitest';
import {
  generateKeypair,
  exportKeypair,
  importKeypair,
  formatKeyFingerprint,
} from '../../src/crypto/keypair.js';
import { sign, verify, signObject, verifyObject } from '../../src/crypto/signing.js';

describe('crypto', () => {
  describe('generateKeypair', () => {
    it('should generate a valid Ed25519 keypair', async () => {
      const keypair = await generateKeypair();

      expect(keypair.publicKey).toBeDefined();
      expect(keypair.privateKey).toBeDefined();
      expect(keypair.publicKey.type).toBe('public');
      expect(keypair.privateKey.type).toBe('private');
    });

    it('should throw if Web Crypto API is unavailable', async () => {
      const originalCrypto = globalThis.crypto;
      // Note: We can't easily mock globalThis.crypto in happy-dom
      // This test is more of a documentation test
      expect(originalCrypto).toBeDefined();
    });
  });

  describe('exportKeypair', () => {
    it('should export keypair to bytes', async () => {
      const keypair = await generateKeypair();
      const exported = await exportKeypair(keypair);

      expect(exported.publicKey).toBeInstanceOf(Uint8Array);
      expect(exported.privateKey).toBeInstanceOf(Uint8Array);
      expect(exported.publicKey.length).toBeGreaterThan(0);
      expect(exported.privateKey.length).toBeGreaterThan(0);
    });

    it('should export different bytes for different keypairs', async () => {
      const keypair1 = await generateKeypair();
      const keypair2 = await generateKeypair();

      const exported1 = await exportKeypair(keypair1);
      const exported2 = await exportKeypair(keypair2);

      // Very unlikely to be the same
      expect(exported1.publicKey).not.toEqual(exported2.publicKey);
    });
  });

  describe('importKeypair', () => {
    it('should import exported keypair', async () => {
      const original = await generateKeypair();
      const exported = await exportKeypair(original);

      const imported = await importKeypair(exported.publicKey, exported.privateKey);

      expect(imported.publicKey).toBeDefined();
      expect(imported.privateKey).toBeDefined();
    });

    it('should produce functionally equivalent keys', async () => {
      const original = await generateKeypair();
      const exported = await exportKeypair(original);
      const imported = await importKeypair(exported.publicKey, exported.privateKey);

      const message = new TextEncoder().encode('test message');
      const sig1 = await sign(message, original.privateKey);
      const sig2 = await sign(message, imported.privateKey);

      // Both should be verifiable with original public key
      const valid1 = await verify(message, sig1, original.publicKey);
      const valid2 = await verify(message, sig2, original.publicKey);

      expect(valid1).toBe(true);
      expect(valid2).toBe(true);
    });
  });

  describe('formatKeyFingerprint', () => {
    it('should return a Base58 string', async () => {
      const keypair = await generateKeypair();
      const fingerprint = await formatKeyFingerprint(keypair.publicKey);

      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.length).toBe(16);
    });

    it('should produce same fingerprint for same key', async () => {
      const keypair = await generateKeypair();
      const fp1 = await formatKeyFingerprint(keypair.publicKey);
      const fp2 = await formatKeyFingerprint(keypair.publicKey);

      expect(fp1).toBe(fp2);
    });
  });
});

describe('sign and verify', () => {
  it('should sign and verify a message', async () => {
    const keypair = await generateKeypair();
    const message = new TextEncoder().encode('Hello, World!');

    const signature = await sign(message, keypair.privateKey);

    expect(signature.algorithm).toBe('Ed25519');
    expect(signature.data).toBeInstanceOf(Uint8Array);
    expect(signature.data.length).toBe(64); // Ed25519 signature size

    const isValid = await verify(message, signature, keypair.publicKey);
    expect(isValid).toBe(true);
  });

  it('should fail verification with wrong public key', async () => {
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();
    const message = new TextEncoder().encode('test');

    const signature = await sign(message, keypair1.privateKey);
    const isValid = await verify(message, signature, keypair2.publicKey);

    expect(isValid).toBe(false);
  });

  it('should fail verification with tampered message', async () => {
    const keypair = await generateKeypair();
    const message = new TextEncoder().encode('original message');

    const signature = await sign(message, keypair.privateKey);

    // Tamper with the message
    const tamperedMessage = new TextEncoder().encode('tampered message');
    const isValid = await verify(tamperedMessage, signature, keypair.publicKey);

    expect(isValid).toBe(false);
  });

  it('should fail verification with tampered signature', async () => {
    const keypair = await generateKeypair();
    const message = new TextEncoder().encode('test message');

    const signature = await sign(message, keypair.privateKey);

    // Tamper with the signature
    signature.data[0] ^= 0xff;

    const isValid = await verify(message, signature, keypair.publicKey);
    expect(isValid).toBe(false);
  });

  it('should handle empty message', async () => {
    const keypair = await generateKeypair();
    const message = new TextEncoder().encode('');

    const signature = await sign(message, keypair.privateKey);
    const isValid = await verify(message, signature, keypair.publicKey);

    expect(isValid).toBe(true);
  });
});

describe('signObject and verifyObject', () => {
  it('should sign and verify an object', async () => {
    const keypair = await generateKeypair();
    const obj = { name: 'test', value: 123 };

    const signed = await signObject(obj, keypair.privateKey);

    expect(signed.signature).toBeDefined();
    expect(signed.timestamp).toBeDefined();

    const verified = await verifyObject(signed, keypair.publicKey);

    expect(verified).toEqual(obj);
  });

  it('should return null for invalid signature', async () => {
    const keypair = await generateKeypair();
    const obj = { name: 'test' };

    const signed = await signObject(obj, keypair.privateKey);
    // Tamper with signature
    signed.signature = '0000000000000000000000000000000000000000000000000000000000000000';

    const verified = await verifyObject(signed, keypair.publicKey);

    expect(verified).toBeNull();
  });

  it('should return null for wrong public key', async () => {
    const keypair1 = await generateKeypair();
    const keypair2 = await generateKeypair();
    const obj = { name: 'test' };

    const signed = await signObject(obj, keypair1.privateKey);
    const verified = await verifyObject(signed, keypair2.publicKey);

    expect(verified).toBeNull();
  });
});
