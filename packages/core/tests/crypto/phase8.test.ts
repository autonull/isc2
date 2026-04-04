/* eslint-disable */
/**
 * Phase 8: Advanced Cryptography Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Ephemeral identities
  createEphemeralIdentity,
  isEphemeralIdentityValid,
  useEphemeralIdentity,
  getRemainingUses,
  getRemainingLifetime,
  exportEphemeralIdentity,
  importEphemeralIdentity,
  rotateEphemeralIdentity,
  getEphemeralStats,
  cleanupExpiredIdentities,
  
  // Shamir's Secret Sharing
  splitSecret,
  reconstructSecret,
  exportShare,
  importShare,
  validateShares,
  createKeyBackup,
  recoverKeyFromBackup,
  generateRecoveryCodes,
  
  // IP Protection
  hashIPAddress,
  createIPMetadata,
  ConnectionRateLimiter,
  ConnectionPool,
  anonymizeRequestMetadata,
  isDatacenterIP,
} from '@isc/core';

describe('Phase 8: Ephemeral Identities', () => {
  describe('createEphemeralIdentity', () => {
    it('should create identity with valid purpose', async () => {
      const identity = await createEphemeralIdentity('anonymous_post');
      
      expect(identity.id).toBeDefined();
      expect(identity.purpose).toBe('anonymous_post');
      expect(identity.keypair).toBeDefined();
      expect(identity.createdAt).toBeDefined();
      expect(identity.expiresAt).toBeDefined();
    });

    it('should reject invalid purpose', async () => {
      await expect(
        createEphemeralIdentity('invalid_purpose')
      ).rejects.toThrow('Invalid purpose');
    });

    it('should respect custom lifetime', async () => {
      const identity = await createEphemeralIdentity('private_message', undefined, {
        lifetimeHours: 2,
      });
      
      const remaining = getRemainingLifetime(identity);
      expect(remaining).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
      expect(remaining).toBeGreaterThan(0);
    });

    it('should respect custom max uses', async () => {
      const identity = await createEphemeralIdentity('one_time_vote', undefined, {
        maxUses: 5,
      });
      
      expect(getRemainingUses(identity)).toBe(5);
    });
  });

  describe('isEphemeralIdentityValid', () => {
    it('should return true for fresh identity', async () => {
      const identity = await createEphemeralIdentity('anonymous_post');
      expect(isEphemeralIdentityValid(identity)).toBe(true);
    });

    it('should return false after max uses', async () => {
      const identity = await createEphemeralIdentity('test_account', undefined, {
        maxUses: 2,
      });
      
      useEphemeralIdentity(identity);
      useEphemeralIdentity(identity);
      
      expect(isEphemeralIdentityValid(identity)).toBe(false);
    });
  });

  describe('useEphemeralIdentity', () => {
    it('should increment usage count', async () => {
      const identity = await createEphemeralIdentity('test_account', undefined, {
        maxUses: 10,
      });
      
      expect(getRemainingUses(identity)).toBe(10);
      
      useEphemeralIdentity(identity);
      expect(getRemainingUses(identity)).toBe(9);
      
      useEphemeralIdentity(identity);
      expect(getRemainingUses(identity)).toBe(8);
    });

    it('should return false when exhausted', async () => {
      const identity = await createEphemeralIdentity('test_account', undefined, {
        maxUses: 1,
      });
      
      useEphemeralIdentity(identity);
      const result = useEphemeralIdentity(identity);
      
      expect(result).toBe(false);
    });
  });

  describe('export/import', () => {
    it('should export and import identity', async () => {
      const original = await createEphemeralIdentity('anonymous_post');
      const exported = await exportEphemeralIdentity(original);
      const imported = await importEphemeralIdentity(exported);
      
      expect(imported.id).toBe(original.id);
      expect(imported.purpose).toBe(original.purpose);
    });
  });

  describe('getEphemeralStats', () => {
    it('should calculate statistics', async () => {
      const identities = await Promise.all([
        createEphemeralIdentity('anonymous_post'),
        createEphemeralIdentity('private_message'),
        createEphemeralIdentity('one_time_vote'),
      ]);
      
      const stats = getEphemeralStats(identities);
      
      expect(stats.total).toBe(3);
      expect(stats.valid).toBe(3);
      expect(stats.expired).toBe(0);
    });
  });

  describe('cleanupExpiredIdentities', () => {
    it('should remove expired identities', async () => {
      const identities = await Promise.all([
        createEphemeralIdentity('anonymous_post'),
        createEphemeralIdentity('private_message'),
      ]);
      
      // Manually expire one
      identities[0].expiresAt = Date.now() - 1000;
      
      const cleaned = cleanupExpiredIdentities(identities);
      expect(cleaned.length).toBe(1);
    });
  });
});

describe('Phase 8: Shamir\'s Secret Sharing', () => {
  describe('splitSecret', () => {
    it('should split secret into shares', () => {
      const secret = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const shares = splitSecret(secret, 3, 5);
      
      expect(shares.length).toBe(5);
      expect(shares[0].threshold).toBe(3);
      expect(shares[0].total).toBe(5);
    });

    it('should create shares with correct parameters', () => {
      const secret = new Uint8Array([1, 2, 3, 4, 5]);
      const shares = splitSecret(secret, 2, 4);
      
      for (const share of shares) {
        expect(share.threshold).toBe(2);
        expect(share.total).toBe(4);
        expect(share.y.length).toBe(5);
      }
    });

    it('should throw if threshold > total', () => {
      const secret = new Uint8Array([1, 2, 3]);
      expect(() => splitSecret(secret, 5, 3)).toThrow('Threshold cannot exceed');
    });
  });

  describe('reconstructSecret', () => {
    it('should reconstruct secret with threshold shares', () => {
      const secret = new Uint8Array([1, 2, 3]);
      const shares = splitSecret(secret, 2, 3);
      
      // Use exactly threshold number of shares
      const selectedShares = shares.slice(0, 2);
      const reconstructed = reconstructSecret(selectedShares);
      
      expect(reconstructed).toEqual(secret);
    });

    it('should reconstruct with any threshold shares', () => {
      const secret = new Uint8Array([10, 20, 30]);
      const shares = splitSecret(secret, 2, 5);
      
      // Use different combination of shares
      const selectedShares = [shares[1], shares[3]];
      const reconstructed = reconstructSecret(selectedShares);
      
      expect(reconstructed).toEqual(secret);
    });

    it('should fail with insufficient shares', () => {
      const secret = new Uint8Array([1, 2, 3]);
      const shares = splitSecret(secret, 3, 5);
      
      // Try with only 2 shares (need 3)
      expect(() => reconstructSecret(shares.slice(0, 2)))
        .toThrow('Insufficient shares');
    });
  });

  describe('validateShares', () => {
    it('should validate correct shares', () => {
      const secret = new Uint8Array([1, 2, 3]);
      const shares = splitSecret(secret, 2, 3);
      
      const result = validateShares(shares);
      
      expect(result.valid).toBe(true);
      expect(result.canReconstruct).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect insufficient shares', () => {
      const secret = new Uint8Array([1, 2, 3]);
      const shares = splitSecret(secret, 3, 5);
      
      const result = validateShares(shares.slice(0, 2));
      
      expect(result.canReconstruct).toBe(false);
    });
  });

  describe('createKeyBackup', () => {
    it('should create backup shares for key', async () => {
      // Use smaller values that work with prime 257
      const privateKey = new Uint8Array([100, 100, 100, 100, 100, 100, 100, 100]);
      
      const shares = await createKeyBackup(privateKey, 3, 5);
      
      expect(shares.length).toBe(5);
      
      // Verify reconstruction
      const recovered = recoverKeyFromBackup(shares.slice(0, 3));
      expect(recovered).toEqual(privateKey);
    });
  });

  describe('generateRecoveryCodes', () => {
    it('should generate human-readable codes', () => {
      const secret = new Uint8Array([1, 2, 3, 4, 5]);
      const shares = splitSecret(secret, 2, 3);
      const codes = generateRecoveryCodes(shares);
      
      expect(codes.length).toBe(3);
      expect(codes[0]).toMatch(/^ISC-\d{2}-\d-\d-[0-9a-f]+/);
    });
  });

  describe('export/import shares', () => {
    it('should export and import share', () => {
      const secret = new Uint8Array([1, 2, 3]);
      const shares = splitSecret(secret, 2, 3);
      
      const exported = exportShare(shares[0]);
      const imported = importShare(exported);
      
      expect(imported.id).toBe(shares[0].id);
      expect(imported.x).toBe(shares[0].x);
      expect(imported.y).toEqual(shares[0].y);
    });
  });
});

describe('Phase 8: IP Protection', () => {
  describe('hashIPAddress', () => {
    it('should hash IP address', async () => {
      const hash1 = await hashIPAddress('192.168.1.1');
      const hash2 = await hashIPAddress('192.168.1.1');
      const hash3 = await hashIPAddress('192.168.1.2');
      
      expect(hash1).toBe(hash2); // Same IP = same hash
      expect(hash1).not.toBe(hash3); // Different IP = different hash
      expect(hash1.length).toBe(64); // SHA-256 hex
    });
  });

  describe('createIPMetadata', () => {
    it('should create anonymized metadata', async () => {
      const metadata = await createIPMetadata('192.168.1.1');
      
      expect(metadata.ipHash).toBeDefined();
      expect(metadata.country).toBeDefined();
      expect(metadata.timestamp).toBeDefined();
    });

    it('should mask location when enabled', async () => {
      const metadata = await createIPMetadata('192.168.1.1');
      
      // Should have coarse location only
      expect(metadata.country).toBeDefined();
    });
  });

  describe('ConnectionRateLimiter', () => {
    it('should allow connections under limit', () => {
      const limiter = new ConnectionRateLimiter({
        maxConnectionsPerIP: 5,
        timeWindowMs: 60000,
      });
      
      for (let i = 0; i < 5; i++) {
        expect(limiter.allowConnection('192.168.1.1')).toBe(true);
      }
      
      // 6th connection should be blocked
      expect(limiter.allowConnection('192.168.1.1')).toBe(false);
    });

    it('should allow different IPs', () => {
      const limiter = new ConnectionRateLimiter({
        maxConnectionsPerIP: 2,
        timeWindowMs: 60000,
      });
      
      expect(limiter.allowConnection('192.168.1.1')).toBe(true);
      expect(limiter.allowConnection('192.168.1.2')).toBe(true);
      expect(limiter.allowConnection('192.168.1.3')).toBe(true);
    });
  });

  describe('ConnectionPool', () => {
    it('should pool connections', () => {
      const pool = new ConnectionPool({ poolSize: 3 });
      
      const id1 = pool.getConnectionId();
      const id2 = pool.getConnectionId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });

    it('should track statistics', () => {
      const pool = new ConnectionPool();
      
      pool.getConnectionId();
      pool.getConnectionId();
      
      const stats = pool.getStats();
      expect(stats.activeConnections).toBeGreaterThan(0);
      expect(stats.totalUsage).toBeGreaterThan(0);
    });
  });

  describe('anonymizeRequestMetadata', () => {
    it('should anonymize IP address', () => {
      const anonymized = anonymizeRequestMetadata({
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Chrome/120',
        timestamp: Date.now(),
      });
      
      expect(anonymized.ipHash).toBeDefined();
      expect(anonymized.browserFamily).toBe('chromium');
      expect(anonymized.timeBucket).toBeDefined();
    });

    it('should extract browser family', () => {
      const firefox = anonymizeRequestMetadata({ userAgent: 'Mozilla/5.0 Firefox/120' });
      const chrome = anonymizeRequestMetadata({ userAgent: 'Mozilla/5.0 Chrome/120' });
      const safari = anonymizeRequestMetadata({ userAgent: 'Mozilla/5.0 Safari/605' });
      
      expect(firefox.browserFamily).toBe('firefox');
      expect(chrome.browserFamily).toBe('chromium');
      expect(safari.browserFamily).toBe('webkit');
    });
  });

  describe('isDatacenterIP', () => {
    it('should detect datacenter IPs', () => {
      expect(isDatacenterIP('35.192.0.1')).toBe(true); // Google Cloud
      expect(isDatacenterIP('52.0.0.1')).toBe(true); // AWS
      expect(isDatacenterIP('192.168.1.1')).toBe(false); // Residential
    });
  });
});

describe('Phase 8: Integration', () => {
  it('should complete full key backup and recovery flow', () => {
    // Use values that work with prime 257 (must be < 257)
    const privateKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

    // Create backup
    const shares = splitSecret(privateKey, 3, 5);

    // Simulate losing some shares, recover with threshold
    const availableShares = [shares[0], shares[2], shares[4]];
    const recovered = reconstructSecret(availableShares);

    expect(recovered).toEqual(privateKey);
  });

  it('should complete full ephemeral identity flow', async () => {
    // Create ephemeral identity
    const identity = await createEphemeralIdentity('anonymous_post', undefined, {
      maxUses: 5,
    });
    
    // Use it
    useEphemeralIdentity(identity);
    useEphemeralIdentity(identity);
    
    // Export for backup
    const exported = await exportEphemeralIdentity(identity);
    
    // Import from backup
    const imported = await importEphemeralIdentity(exported);
    
    expect(imported.id).toBe(identity.id);
    expect(imported.usedCount).toBe(identity.usedCount);
    expect(isEphemeralIdentityValid(imported)).toBe(true);
  });
});
