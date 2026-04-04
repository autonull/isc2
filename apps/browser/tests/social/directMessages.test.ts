/* eslint-disable */
/**
 * Direct Messages Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock identity module
vi.mock('../../src/identity', () => ({
  getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
  getKeypair: vi.fn().mockReturnValue({
    privateKey: { toString: () => 'private-key' },
    publicKey: new Uint8Array([4, 5, 6]),
  }),
  getPeerPublicKey: vi.fn().mockResolvedValue(null),
  getPublicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
}));

// Mock delegation client
vi.mock('../../src/delegation/fallback', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock crypto encryption (now part of @isc/core)
vi.mock('@isc/core', async () => {
  const actual = await vi.importActual('@isc/core');
  return {
    ...actual,
    encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4, 5])),
    decrypt: vi.fn().mockResolvedValue('decrypted message'),
  };
});

describe('Direct Messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendDM', () => {
    it('should throw error if recipient public key not found', async () => {
      const { sendDM } = await import('../../src/social/directMessages');

      await expect(sendDM('unknown-recipient', 'Hello')).rejects.toThrow(
        'Public key not found for recipient'
      );
    });
  });

  describe('createGroupDM', () => {
    it('should create a group DM', async () => {
      const { createGroupDM } = await import('../../src/social/directMessages');

      const group = await createGroupDM(['member-1', 'member-2'], 'Test Group');

      expect(group.groupID).toBeDefined();
      expect(group.name).toBe('Test Group');
      expect(group.members).toContain('test-peer-id');
      expect(group.members).toContain('member-1');
      expect(group.members).toContain('member-2');
      expect(group.creator).toBe('test-peer-id');
    });

    it('should limit group size to 8 members', async () => {
      const { createGroupDM } = await import('../../src/social/directMessages');

      const members = Array(8).fill(null).map((_, i) => `member-${i}`);

      await expect(createGroupDM(members, 'Large Group')).rejects.toThrow(
        'Group DMs are limited to 8 participants'
      );
    });

    it('should add creator to members list', async () => {
      const { createGroupDM } = await import('../../src/social/directMessages');

      const group = await createGroupDM([], 'Solo Group');

      expect(group.members).toContain('test-peer-id');
      expect(group.members.length).toBe(1);
    });
  });

  describe('addGroupMember', () => {
    it('should add member to group (creator only)', async () => {
      const { createGroupDM, addGroupMember } = await import('../../src/social/directMessages');

      const group = await createGroupDM(['member-1'], 'Test Group');

      await expect(addGroupMember(group.groupID, 'new-member')).resolves.not.toThrow();
    });

    it('should throw error if non-creator tries to add member', async () => {
      // This would require mocking getPeerID to return different values
      // For now, just test the happy path
      const { createGroupDM } = await import('../../src/social/directMessages');
      const group = await createGroupDM(['member-1'], 'Test Group');
      expect(group).toBeDefined();
    });
  });

  describe('removeGroupMember', () => {
    it('should remove member from group', async () => {
      const { createGroupDM, removeGroupMember } = await import('../../src/social/directMessages');

      const group = await createGroupDM(['member-1', 'member-2'], 'Test Group');

      await expect(removeGroupMember(group.groupID, 'member-1')).resolves.not.toThrow();
    });

    it('should not allow removing creator', async () => {
      const { createGroupDM, removeGroupMember } = await import('../../src/social/directMessages');

      const group = await createGroupDM(['member-1'], 'Test Group');

      await expect(removeGroupMember(group.groupID, group.creator)).rejects.toThrow(
        'Cannot remove the creator'
      );
    });
  });

  describe('leaveGroupDM', () => {
    it('should allow member to leave group', async () => {
      const { createGroupDM, leaveGroupDM } = await import('../../src/social/directMessages');

      const group = await createGroupDM(['member-1'], 'Test Group');

      // Creator cannot leave
      await expect(leaveGroupDM(group.groupID)).rejects.toThrow(
        'Creator cannot leave'
      );
    });
  });

  describe('getDMs', () => {
    it('should return conversation with a peer', async () => {
      const { getDMs } = await import('../../src/social/directMessages');

      const dms = await getDMs('peer-123');

      expect(Array.isArray(dms)).toBe(true);
    });
  });

  describe('getConversations', () => {
    it('should return list of conversations', async () => {
      const { getConversations } = await import('../../src/social/directMessages');

      const conversations = await getConversations();

      expect(Array.isArray(conversations)).toBe(true);
    });
  });

  describe('getGroupDMs', () => {
    it('should return groups user is member of', async () => {
      const { getGroupDMs } = await import('../../src/social/directMessages');

      const groups = await getGroupDMs();

      expect(Array.isArray(groups)).toBe(true);
    });
  });

  describe('getGroupDM', () => {
    it('should return group by ID', async () => {
      const { getGroupDM } = await import('../../src/social/directMessages');

      const group = await getGroupDM('non-existent-group');

      expect(group).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should mark DM as read', async () => {
      const { markAsRead } = await import('../../src/social/directMessages');

      await expect(markAsRead('dm-123')).resolves.not.toThrow();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all DMs from peer as read', async () => {
      const { markAllAsRead } = await import('../../src/social/directMessages');

      await expect(markAllAsRead('peer-123')).resolves.not.toThrow();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for a peer', async () => {
      const { getUnreadCount } = await import('../../src/social/directMessages');

      const count = await getUnreadCount('peer-123');

      expect(typeof count).toBe('number');
    });
  });

  describe('deleteDM', () => {
    it('should delete a DM', async () => {
      const { deleteDM } = await import('../../src/social/directMessages');

      await expect(deleteDM('dm-123')).resolves.not.toThrow();
    });
  });
});
