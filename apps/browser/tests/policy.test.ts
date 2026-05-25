/* eslint-disable */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DelegationPolicyManager,
  createMinimalPolicy,
  isChannelDescriptionSafe,
  sanitizeForDelegation,
  type DelegationPolicy,
} from '@isc/delegation';

describe('DelegationPolicyManager', () => {
  let manager: DelegationPolicyManager;
  let mockStorage: any;

  const defaultPolicy: DelegationPolicy = {
    allowEmbedDelegation: true,
    allowANNDelegation: true,
    allowSigVerifyDelegation: true,
    delegateOnlyChannels: false,
    allowedChannels: new Set(),
  };

  beforeEach(() => {
    const channelOverrides = new Map<string, DelegationPolicy>();
    mockStorage = {
      get: async (channelID: string) => channelOverrides.get(channelID) ?? null,
      set: async (channelID: string, policy: DelegationPolicy) =>
        channelOverrides.set(channelID, policy),
      delete: async (channelID: string) => channelOverrides.delete(channelID),
      getDefault: async () => defaultPolicy,
      setDefault: async () => {},
    };

    manager = new DelegationPolicyManager({
      defaultPolicy,
      channelOverrides,
      storage: mockStorage,
    });
  });

  describe('getPolicy', () => {
    it('should return default policy when no channelID provided', async () => {
      const policy = await manager.getPolicy();
      expect(policy).toEqual(defaultPolicy);
    });

    it('should return channel-specific policy when set', async () => {
      const channelPolicy: DelegationPolicy = {
        ...defaultPolicy,
        allowEmbedDelegation: false,
      };

      await mockStorage.set('channel-1', channelPolicy);

      const policy = await manager.getPolicy('channel-1');
      expect(policy.allowEmbedDelegation).toBe(false);
    });
  });

  describe('canDelegate', () => {
    it('should check embed delegation permission', async () => {
      const can = await manager.canDelegate('embed');
      expect(can).toBe(true);
    });

    it('should return false when embed delegation disabled', async () => {
      await manager.setDefaultPolicy({ allowEmbedDelegation: false });
      const can = await manager.canDelegate('embed');
      expect(can).toBe(false);
    });
  });

  describe('shouldDelegate', () => {
    it('should return true when delegateOnlyChannels is false', async () => {
      const should = await manager.shouldDelegate('channel-1', 'embed');
      expect(should).toBe(true);
    });

    it('should check channel in allowed list when delegateOnlyChannels is true', async () => {
      await manager.setDefaultPolicy({ delegateOnlyChannels: true });
      const should = await manager.shouldDelegate('channel-1', 'embed');
      expect(should).toBe(false);

      await manager.addAllowedChannel('channel-1');
      const shouldAfterAdd = await manager.shouldDelegate('channel-1', 'embed');
      expect(shouldAfterAdd).toBe(true);
    });
  });

  describe('channel policy management', () => {
    it('should set and clear channel policy', async () => {
      await manager.setChannelPolicy('channel-1', { allowEmbedDelegation: false });
      let policy = await manager.getPolicy('channel-1');
      expect(policy.allowEmbedDelegation).toBe(false);

      await manager.clearChannelPolicy('channel-1');
      policy = await manager.getPolicy('channel-1');
      expect(policy.allowEmbedDelegation).toBe(true);
    });

    it('should add and remove allowed channels', async () => {
      await manager.setDefaultPolicy({ delegateOnlyChannels: true });

      await manager.addAllowedChannel('channel-2');
      let policy = await manager.getPolicy('channel-2');
      expect(policy.allowedChannels.has('channel-2')).toBe(true);

      await manager.removeAllowedChannel('channel-2');
      policy = await manager.getPolicy('channel-2');
      expect(policy.allowedChannels.has('channel-2')).toBe(false);
    });
  });
});

describe('createMinimalPolicy', () => {
  it('should create policy with all services disabled', () => {
    const policy = createMinimalPolicy();
    expect(policy.allowEmbedDelegation).toBe(false);
    expect(policy.allowANNDelegation).toBe(false);
    expect(policy.allowSigVerifyDelegation).toBe(false);
  });
});

describe('isChannelDescriptionSafe', () => {
  it('should accept safe descriptions', () => {
    expect(isChannelDescriptionSafe('AI Ethics and philosophy')).toBe(true);
    expect(isChannelDescriptionSafe('Discussing machine learning')).toBe(true);
  });

  it('should reject descriptions with passwords', () => {
    expect(isChannelDescriptionSafe('My password: secret123')).toBe(false);
    expect(isChannelDescriptionSafe('passwd = admin')).toBe(false);
  });

  it('should reject descriptions with API keys', () => {
    expect(isChannelDescriptionSafe('api_key: sk-123456')).toBe(false);
  });

  it('should reject descriptions with private keys', () => {
    expect(isChannelDescriptionSafe('BEGIN RSA PRIVATE KEY')).toBe(false);
  });
});

describe('sanitizeForDelegation', () => {
  it('should mask phone numbers', () => {
    const result = sanitizeForDelegation('Call me at 555-123-4567');
    expect(result).toContain('[PHONE]');
    expect(result).not.toContain('555-123-4567');
  });

  it('should mask email addresses', () => {
    const result = sanitizeForDelegation('Contact me at test@example.com');
    expect(result).toContain('[EMAIL]');
    expect(result).not.toContain('test@example.com');
  });

  it('should mask IP addresses', () => {
    const result = sanitizeForDelegation('Server at 192.168.1.1');
    expect(result).toContain('[IP]');
    expect(result).not.toContain('192.168.1.1');
  });

  it('should preserve non-sensitive text', () => {
    const result = sanitizeForDelegation('AI Ethics discussion group');
    expect(result).toBe('AI Ethics discussion group');
  });
});
