import { describe, it, expect } from 'vitest';
import {
  deriveKeyFromPassphrase,
  encryptPrivateKey,
  decryptPrivateKey,
  validatePassphraseStrength,
  EncryptedKeypair
} from '../../src/crypto/encryption.js';

describe('encryption', () => {
  const testPassphrase = 'testPassphrase123!';
  const testPrivateKey = new Uint8Array([1, 2, 3, 4, 5]);

  describe('validatePassphraseStrength', () => {
    it('should return score 0 and feedback for empty passphrase', () => {
      const result = validatePassphraseStrength('');
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Use at least 8 characters');
      expect(result.feedback).toContain('Add lowercase letters');
      expect(result.feedback).toContain('Add uppercase letters');
      expect(result.feedback).toContain('Add numbers');
      expect(result.feedback).toContain('Add special characters');
    });

    it('should return score 6 for strong passphrase', () => {
      const result = validatePassphraseStrength(testPassphrase);
      expect(result.score).toBe(6);
      expect(result.feedback).toHaveLength(0);
    });

    it('should increment score for length >= 8', () => {
      const result = validatePassphraseStrength('abcdefgh');
      expect(result.score).toBeGreaterThanOrEqual(1);
    });

    it('should increment score for length >= 12', () => {
      const result = validatePassphraseStrength('abcdefghijkl');
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    it('should detect lowercase letters', () => {
      const result = validatePassphraseStrength('ABCDEFGH123!');
      expect(result.score).toBeLessThan(6); // missing lowercase
      expect(result.feedback).toContain('Add lowercase letters');
    });

    it('should detect uppercase letters', () => {
      const result = validatePassphraseStrength('abcdefgh123!');
      expect(result.score).toBeLessThan(6); // missing uppercase
      expect(result.feedback).toContain('Add uppercase letters');
    });

    it('should detect numbers', () => {
      const result = validatePassphraseStrength('abcdefghijk!');
      expect(result.score).toBeLessThan(6); // missing numbers
      expect(result.feedback).toContain('Add numbers');
    });

    it('should detect special characters', () => {
      const result = validatePassphraseStrength('abcdefgh123');
      expect(result.score).toBeLessThan(6); // missing special
      expect(result.feedback).toContain('Add special characters');
    });
  });

  describe('deriveKeyFromPassphrase', () => {
    it('should derive a key from passphrase and salt', async () => {
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const key = await deriveKeyFromPassphrase(testPassphrase, salt);
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should use default iterations if not provided', async () => {
      const salt = new Uint8Array(16);
      const key = await deriveKeyFromPassphrase(testPassphrase, salt);
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should use custom iterations', async () => {
      const salt = new Uint8Array(16);
      const key = await deriveKeyFromPassphrase(testPassphrase, salt, 50000);
      expect(key).toBeInstanceOf(CryptoKey);
    });
  });

  describe('encryptPrivateKey', () => {
    it('should encrypt a private key and return EncryptedKeypair', async () => {
      const result = await encryptPrivateKey(testPrivateKey, testPassphrase);
      expect(result).toHaveProperty('publicKey');
      expect(result).toHaveProperty('encryptedPrivateKey');
      expect(result).toHaveProperty('salt');
      expect(result).toHaveProperty('iterations');
      expect(result.publicKey).toBeInstanceOf(Uint8Array);
      expect(result.encryptedPrivateKey).toBeInstanceOf(Uint8Array);
      expect(result.salt).toBeInstanceOf(Uint8Array);
      expect(typeof result.iterations).toBe('number');
      expect(result.salt.length).toBe(16); // SALT_LENGTH
      expect(result.iterations).toBe(100000); // PBKDF2_ITERATIONS
    });

    it('should produce different output for same input due to random salt', async () => {
      const result1 = await encryptPrivateKey(testPrivateKey, testPassphrase);
      const result2 = await encryptPrivateKey(testPrivateKey, testPassphrase);
      expect(result1.salt).not.toEqual(result2.salt);
      expect(result1.encryptedPrivateKey).not.toEqual(result2.encryptedPrivateKey);
    });
  });

  describe('decryptPrivateKey', () => {
    it('should decrypt a private key that was encrypted', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassphrase);
      const decrypted = await decryptPrivateKey(encrypted, testPassphrase);
      expect(decrypted).toEqual(testPrivateKey);
    });

    it('should fail to decrypt with wrong passphrase', async () => {
      const encrypted = await encryptPrivateKey(testPrivateKey, testPassphrase);
      await expect(decryptPrivateKey(encrypted, 'wrongPassphrase')).rejects.toThrow();
    });
  });
});