/**
 * Unit Tests for @isc/core - Cryptographic Functions
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeypair, exportKeypair, importKeypair, sign, verify, formatKeyFingerprint, encryptPrivateKey, decryptPrivateKey, validatePassphraseStrength, } from '../src/crypto/index.js';
describe('Crypto Functions', () => {
    let keypair;
    beforeAll(async () => {
        keypair = await generateKeypair();
    }, 10000);
    describe('generateKeypair', () => {
        it('should generate a valid ed25519 keypair', async () => {
            const kp = await generateKeypair();
            expect(kp.publicKey).toBeDefined();
            expect(kp.privateKey).toBeDefined();
            expect(kp.publicKey.type).toBe('public');
            expect(kp.privateKey.type).toBe('private');
        });
        it('should generate unique keypairs', async () => {
            const kp1 = await generateKeypair();
            const kp2 = await generateKeypair();
            const fp1 = await formatKeyFingerprint(kp1.publicKey);
            const fp2 = await formatKeyFingerprint(kp2.publicKey);
            expect(fp1).not.toBe(fp2);
        });
    });
    describe('exportKeypair & importKeypair', () => {
        it('should export and import keypair correctly', async () => {
            const exported = await exportKeypair(keypair);
            expect(exported.publicKey).toBeDefined();
            expect(exported.privateKey).toBeDefined();
            expect(exported.publicKey).toBeInstanceOf(Uint8Array);
            expect(exported.privateKey).toBeInstanceOf(Uint8Array);
            const imported = await importKeypair(exported.publicKey, exported.privateKey);
            expect(imported.publicKey).toBeDefined();
            expect(imported.privateKey).toBeDefined();
        });
        it('should preserve signing capability after import', async () => {
            const exported = await exportKeypair(keypair);
            const imported = await importKeypair(exported.publicKey, exported.privateKey);
            const message = new TextEncoder().encode('test message');
            const signature = await sign(message, imported.privateKey);
            const isValid = await verify(message, signature, imported.publicKey);
            expect(isValid).toBe(true);
        });
    });
    describe('sign & verify', () => {
        it('should sign and verify a message', async () => {
            const message = new TextEncoder().encode('Hello, World!');
            const signature = await sign(message, keypair.privateKey);
            const isValid = await verify(message, signature, keypair.publicKey);
            expect(isValid).toBe(true);
        });
        it('should reject invalid signatures', async () => {
            const message1 = new TextEncoder().encode('Message 1');
            const message2 = new TextEncoder().encode('Message 2');
            const signature = await sign(message1, keypair.privateKey);
            const isValid = await verify(message2, signature, keypair.publicKey);
            expect(isValid).toBe(false);
        });
        it('should reject tampered signatures', async () => {
            const message = new TextEncoder().encode('Test message');
            const signature = await sign(message, keypair.privateKey);
            // Tamper with signature
            const tamperedSig = {
                data: new Uint8Array(signature.data),
                algorithm: signature.algorithm,
            };
            tamperedSig.data[0] ^= 0xff;
            const isValid = await verify(message, tamperedSig, keypair.publicKey);
            expect(isValid).toBe(false);
        });
        it('should handle empty messages', async () => {
            const message = new Uint8Array([]);
            const signature = await sign(message, keypair.privateKey);
            const isValid = await verify(message, signature, keypair.publicKey);
            expect(isValid).toBe(true);
        });
        it('should handle large messages', async () => {
            const largeMessage = new TextEncoder().encode('A'.repeat(10000));
            const signature = await sign(largeMessage, keypair.privateKey);
            const isValid = await verify(largeMessage, signature, keypair.publicKey);
            expect(isValid).toBe(true);
        });
    });
    describe('formatKeyFingerprint', () => {
        it('should format public key as base58btc string', async () => {
            const fingerprint = await formatKeyFingerprint(keypair.publicKey);
            expect(typeof fingerprint).toBe('string');
            expect(fingerprint.length).toBeGreaterThan(0);
        });
        it('should produce consistent fingerprints', async () => {
            const fp1 = await formatKeyFingerprint(keypair.publicKey);
            const fp2 = await formatKeyFingerprint(keypair.publicKey);
            expect(fp1).toBe(fp2);
        });
        it('should produce different fingerprints for different keys', async () => {
            const kp2 = await generateKeypair();
            const fp1 = await formatKeyFingerprint(keypair.publicKey);
            const fp2 = await formatKeyFingerprint(kp2.publicKey);
            expect(fp1).not.toBe(fp2);
        });
    });
    describe('encryptPrivateKey & decryptPrivateKey', () => {
        it('should encrypt and decrypt private key', async () => {
            const passphrase = 'strong-password-123';
            const exported = await exportKeypair(keypair);
            const encrypted = await encryptPrivateKey(exported.privateKey, passphrase);
            expect(encrypted.encryptedPrivateKey).toBeDefined();
            expect(encrypted.salt).toBeDefined();
            expect(encrypted.iterations).toBeDefined();
            const decrypted = await decryptPrivateKey(encrypted, passphrase);
            expect(decrypted).toEqual(exported.privateKey);
        });
        it('should fail with wrong passphrase', async () => {
            const passphrase = 'correct-password';
            const exported = await exportKeypair(keypair);
            const encrypted = await encryptPrivateKey(exported.privateKey, passphrase);
            await expect(decryptPrivateKey(encrypted, 'wrong-password')).rejects.toThrow();
        });
        it('should use different salts for different encryptions', async () => {
            const passphrase = 'test-passphrase';
            const exported = await exportKeypair(keypair);
            const encrypted1 = await encryptPrivateKey(exported.privateKey, passphrase);
            const encrypted2 = await encryptPrivateKey(exported.privateKey, passphrase);
            expect(encrypted1.salt).not.toEqual(encrypted2.salt);
        });
        it('should handle complex passphrases', async () => {
            const passphrase = 'C0mpl3x!P@ssw0rd#2024$Secure';
            const exported = await exportKeypair(keypair);
            const encrypted = await encryptPrivateKey(exported.privateKey, passphrase);
            const decrypted = await decryptPrivateKey(encrypted, passphrase);
            expect(decrypted).toEqual(exported.privateKey);
        });
        it('should handle unicode passphrases', async () => {
            const passphrase = '密码🔐كلمة';
            const exported = await exportKeypair(keypair);
            const encrypted = await encryptPrivateKey(exported.privateKey, passphrase);
            const decrypted = await decryptPrivateKey(encrypted, passphrase);
            expect(decrypted).toEqual(exported.privateKey);
        });
    });
    describe('validatePassphraseStrength', () => {
        it('should reject weak passphrases', () => {
            expect(validatePassphraseStrength('123456')).toBe(false);
            expect(validatePassphraseStrength('password')).toBe(false);
            expect(validatePassphraseStrength('abc')).toBe(false);
        });
        it('should accept strong passphrases', () => {
            expect(validatePassphraseStrength('StrongP@ssw0rd123')).toBe(true);
            expect(validatePassphraseStrength('MyS3cur3P@ss!')).toBe(true);
        });
        it('should require minimum length', () => {
            expect(validatePassphraseStrength('Short1!')).toBe(false);
            expect(validatePassphraseStrength('LongerP@ss123')).toBe(true);
        });
        it('should require character variety', () => {
            expect(validatePassphraseStrength('alllowercase123')).toBe(false);
            expect(validatePassphraseStrength('ALLUPPERCASE123')).toBe(false);
            expect(validatePassphraseStrength('MixedCase123!')).toBe(true);
        });
    });
});
//# sourceMappingURL=crypto.test.js.map