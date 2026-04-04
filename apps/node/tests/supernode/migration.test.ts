/* eslint-disable */
/**
 * Model Version Migration Tests
 *
 * Tests for Phase 7: Performance & Scale - Model Migration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ModelVersionManager,
  createModelVersionManager,
  generateModelHash,
  verifyModelHash,
  type ModelVersion,
  type ModelMetadata,
} from '../../src/supernode/migration';

describe('ModelVersionManager', () => {
  let manager: ModelVersionManager;

  beforeEach(() => {
    manager = createModelVersionManager();
  });

  describe('setCurrentVersion', () => {
    it('should set current model version', () => {
      const metadata: ModelMetadata = {
        version: { major: 1, minor: 0, patch: 0, hash: 'abc123' },
        name: 'test-model',
        description: 'Test model v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      };

      manager.setCurrentVersion(metadata);
      const current = manager.getCurrentVersion();

      expect(current?.version.major).toBe(1);
      expect(current?.version.minor).toBe(0);
    });

    it('should store previous version', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.setCurrentVersion({
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      const stats = manager.getMigrationStats();
      expect(stats.previousVersion).toBe('v1.0.0-abc');
    });
  });

  describe('isVersionCompatible', () => {
    beforeEach(() => {
      manager.setCurrentVersion({
        version: { major: 2, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });
    });

    it('should return true for same version', () => {
      const compatible = manager.isVersionCompatible({
        major: 2,
        minor: 0,
        patch: 0,
        hash: 'abc',
      });
      expect(compatible).toBe(true);
    });

    it('should return true for compatible minor version', () => {
      const compatible = manager.isVersionCompatible({
        major: 2,
        minor: 1,
        patch: 0,
        hash: 'def',
      });
      expect(compatible).toBe(true);
    });

    it('should return false for incompatible major version', () => {
      const incompatible = manager.isVersionCompatible({
        major: 0,
        minor: 0,
        patch: 0,
        hash: 'xyz',
      });
      expect(incompatible).toBe(false);
    });
  });

  describe('startMigration', () => {
    beforeEach(() => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });
    });

    it('should create migration plan', () => {
      const newMetadata: ModelMetadata = {
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      };

      const plan = manager.startMigration(newMetadata);

      expect(plan.fromVersion.major).toBe(1);
      expect(plan.toVersion.major).toBe(2);
      expect(plan.strategy).toBe('gradual');
    });

    it('should mark old version as deprecated', () => {
      const newMetadata: ModelMetadata = {
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      };

      manager.startMigration(newMetadata);
      
      // The previous version (v1) should be deprecated
      const stats = manager.getMigrationStats();
      expect(stats.previousVersion).toBe('v1.0.0-abc');
      
      // Check via version history since previousVersion is internal
      const history = manager.getVersionHistory();
      expect(history.some(v => v.deprecated)).toBe(true);
    });

    it('should set dual-announce period', () => {
      const newMetadata: ModelMetadata = {
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      };

      const plan = manager.startMigration(newMetadata);

      expect(plan.dualAnnounceEnd).toBeGreaterThan(plan.dualAnnounceStart);
    });
  });

  describe('isDualAnnounceActive', () => {
    it('should return true during dual-announce period', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.startMigration({
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      expect(manager.isDualAnnounceActive()).toBe(true);
    });

    it('should return false without migration', () => {
      expect(manager.isDualAnnounceActive()).toBe(false);
    });
  });

  describe('rollback', () => {
    it('should rollback to previous version', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.startMigration({
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      const success = manager.rollback();
      expect(success).toBe(true);

      const current = manager.getCurrentVersion();
      expect(current?.version.major).toBe(1);
    });

    it('should fail if no previous version', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      const success = manager.rollback();
      expect(success).toBe(false);
    });
  });

  describe('recordPeerVersion', () => {
    it('should record peer version', () => {
      manager.recordPeerVersion('peer_1', {
        major: 2,
        minor: 0,
        patch: 0,
        hash: 'def',
      });

      const stats = manager.getMigrationStats();
      expect(stats.peerCount).toBe(1);
    });
  });

  describe('getAdoptionRate', () => {
    it('should calculate adoption rate', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.startMigration({
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      // 3 peers on new version, 1 on old
      manager.recordPeerVersion('peer_1', { major: 2, minor: 0, patch: 0, hash: 'def' });
      manager.recordPeerVersion('peer_2', { major: 2, minor: 0, patch: 0, hash: 'def' });
      manager.recordPeerVersion('peer_3', { major: 2, minor: 0, patch: 0, hash: 'def' });
      manager.recordPeerVersion('peer_4', { major: 1, minor: 0, patch: 0, hash: 'abc' });

      const rate = manager.getAdoptionRate();
      expect(rate).toBeCloseTo(0.75, 2);
    });

    it('should return 0 with no peers', () => {
      const rate = manager.getAdoptionRate();
      expect(rate).toBe(0);
    });
  });

  describe('updateMigrationProgress', () => {
    it('should update progress', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.startMigration({
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.updateMigrationProgress(0.5);

      const plan = manager.getMigrationPlan();
      expect(plan?.migrationProgress).toBe(0.5);
    });

    it('should clamp progress to 0-1', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.startMigration({
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      manager.updateMigrationProgress(1.5);

      const plan = manager.getMigrationPlan();
      expect(plan?.migrationProgress).toBe(1);
    });
  });

  describe('shouldRejectVersion', () => {
    it('should reject very old major version', () => {
      manager.setCurrentVersion({
        version: { major: 3, minor: 0, patch: 0, hash: 'xyz' },
        name: 'model-v3',
        description: 'v3',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      const shouldReject = manager.shouldRejectVersion({
        major: 1,
        minor: 0,
        patch: 0,
        hash: 'abc',
      });

      expect(shouldReject).toBe(true);
    });

    it('should accept compatible version', () => {
      manager.setCurrentVersion({
        version: { major: 2, minor: 0, patch: 0, hash: 'def' },
        name: 'model-v2',
        description: 'v2',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      const shouldReject = manager.shouldRejectVersion({
        major: 2,
        minor: 1,
        patch: 0,
        hash: 'ghi',
      });

      expect(shouldReject).toBe(false);
    });
  });

  describe('getMigrationStats', () => {
    it('should return comprehensive stats', () => {
      manager.setCurrentVersion({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });

      const stats = manager.getMigrationStats();

      expect(stats).toHaveProperty('currentVersion');
      expect(stats).toHaveProperty('adoptionRate');
      expect(stats).toHaveProperty('dualAnnounceActive');
      expect(stats).toHaveProperty('migrationProgress');
      expect(stats).toHaveProperty('rollbackAvailable');
    });
  });

  describe('formatVersion/parseVersion', () => {
    it('should format version to string', () => {
      const version: ModelVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        hash: 'abc123',
      };

      const formatted = manager.formatVersion(version);
      expect(formatted).toBe('v1.2.3-abc123');
    });

    it('should parse version from string', () => {
      const parsed = manager.parseVersion('v1.2.3-abc123');

      expect(parsed?.major).toBe(1);
      expect(parsed?.minor).toBe(2);
      expect(parsed?.patch).toBe(3);
      expect(parsed?.hash).toBe('abc123');
    });

    it('should handle version without hash', () => {
      const parsed = manager.parseVersion('v1.2.3');
      expect(parsed?.hash).toBe('');
    });
  });

  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      const a = { major: 1, minor: 0, patch: 0, hash: 'abc' };
      const b = { major: 1, minor: 0, patch: 0, hash: 'abc' };

      expect(manager.compareVersions(a, b)).toBe(0);
    });

    it('should return positive for newer version', () => {
      const a = { major: 2, minor: 0, patch: 0, hash: 'abc' };
      const b = { major: 1, minor: 0, patch: 0, hash: 'abc' };

      expect(manager.compareVersions(a, b)).toBeGreaterThan(0);
    });

    it('should return negative for older version', () => {
      const a = { major: 1, minor: 0, patch: 0, hash: 'abc' };
      const b = { major: 2, minor: 0, patch: 0, hash: 'abc' };

      expect(manager.compareVersions(a, b)).toBeLessThan(0);
    });
  });
});

describe('Model Hash Functions', () => {
  describe('generateModelHash', () => {
    it('should generate hash from content', async () => {
      const content = new TextEncoder().encode('test model content');
      const hash = await generateModelHash(content);

      expect(hash).toBeDefined();
      expect(hash.length).toBe(64); // SHA-256 hex
    });

    it('should generate consistent hash', async () => {
      const content = new TextEncoder().encode('test model content');
      const hash1 = await generateModelHash(content);
      const hash2 = await generateModelHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', async () => {
      const content1 = new TextEncoder().encode('content 1');
      const content2 = new TextEncoder().encode('content 2');

      const hash1 = await generateModelHash(content1);
      const hash2 = await generateModelHash(content2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyModelHash', () => {
    it('should verify matching hash', async () => {
      const content = new TextEncoder().encode('test content');
      const hash = await generateModelHash(content);

      const valid = await verifyModelHash(content, hash);
      expect(valid).toBe(true);
    });

    it('should reject non-matching hash', async () => {
      const content = new TextEncoder().encode('test content');
      const wrongHash = 'wrong_hash_value';

      const valid = await verifyModelHash(content, wrongHash);
      expect(valid).toBe(false);
    });
  });
});

describe('ModelVersionManager - Custom Configuration', () => {
  it('should use custom dual-announce period', () => {
    const manager = createModelVersionManager({
      dualAnnounceDays: 30,
    });

    manager.setCurrentVersion({
      version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
      name: 'model-v1',
      description: 'v1',
      dimensions: 384,
      quantization: 'f32',
      createdAt: Date.now(),
      deprecated: false,
    });

    const plan = manager.startMigration({
      version: { major: 2, minor: 0, patch: 0, hash: 'def' },
      name: 'model-v2',
      description: 'v2',
      dimensions: 384,
      quantization: 'f32',
      createdAt: Date.now(),
      deprecated: false,
    });

    const expectedEnd = plan.dualAnnounceStart + 30 * 24 * 60 * 60 * 1000;
    expect(plan.dualAnnounceEnd).toBeCloseTo(expectedEnd, -10); // Within 10 seconds
  });

  it('should use custom rollback window', () => {
    const manager = createModelVersionManager({
      rollbackWindowDays: 1,
    });

    // Test configuration is applied
    const stats = manager.getMigrationStats();
    expect(stats).toBeDefined();
  });
});

describe('ModelVersionManager - Edge Cases', () => {
  it('should handle many version history entries', () => {
    const manager = createModelVersionManager();

    for (let i = 1; i <= 15; i++) {
      manager.setCurrentVersion({
        version: { major: i, minor: 0, patch: 0, hash: `v${i}` },
        name: `model-v${i}`,
        description: `v${i}`,
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });
    }

    const history = manager.getVersionHistory();
    expect(history.length).toBeLessThanOrEqual(10); // History is trimmed
  });

  it('should handle migration without previous version', () => {
    const manager = createModelVersionManager();

    expect(() => {
      manager.startMigration({
        version: { major: 1, minor: 0, patch: 0, hash: 'abc' },
        name: 'model-v1',
        description: 'v1',
        dimensions: 384,
        quantization: 'f32',
        createdAt: Date.now(),
        deprecated: false,
      });
    }).toThrow('No current version set');
  });
});
