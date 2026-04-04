/* eslint-disable */
/**
 * Audio Spaces Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock identity module
vi.mock('../../src/identity', () => ({
  getPeerID: vi.fn().mockResolvedValue('test-peer-id'),
  getKeypair: vi.fn().mockReturnValue({
    privateKey: {},
    publicKey: new Uint8Array([4, 5, 6]),
  }),
}));

// Mock channels manager
vi.mock('../../src/channels/manager', () => ({
  getChannel: vi.fn().mockResolvedValue({
    id: 'test-channel',
    name: 'Test Channel',
    distributions: [{ mu: [0.1, 0.2, 0.3, 0.4], sigma: [0.1, 0.1, 0.1, 0.1] }],
  }),
}));

// Mock delegation discovery
vi.mock('../../src/delegation/discovery', () => ({
  queryProximals: vi.fn().mockResolvedValue([]),
}));

// Mock delegation fallback
vi.mock('../../src/delegation/fallback', () => ({
  DelegationClient: {
    getInstance: vi.fn().mockReturnValue({
      announce: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    }),
  },
}));

// Mock navigator.mediaDevices
const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
  getAudioTracks: vi.fn().mockReturnValue([{ enabled: true, stop: vi.fn() }]),
  getVideoTracks: vi.fn().mockReturnValue([]),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
  clone: vi.fn().mockReturnValue({}),
};

beforeAll(() => {
  (global as any).navigator = {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
    },
  };
});

describe('Audio Spaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAudioSpace', () => {
    it('should create a new audio space', async () => {
      const { createAudioSpace } = await import('../../src/social/audioSpaces');

      const space = await createAudioSpace('test-channel');

      expect(space.spaceID).toBeDefined();
      expect(space.channelID).toBe('test-channel');
      expect(space.creator).toBe('test-peer-id');
      expect(space.participants).toContain('test-peer-id');
      expect(space.isMuted).toBe(false);
    });
  });

  describe('joinAudioSpace', () => {
    it('should join an existing audio space', async () => {
      const { createAudioSpace, joinAudioSpace } = await import('../../src/social/audioSpaces');

      const space = await createAudioSpace('test-channel');
      const joined = await joinAudioSpace(space.spaceID);

      expect(joined.spaceID).toBe(space.spaceID);
      expect(joined.participants.length).toBeGreaterThan(0);
    });

    it('should throw error if space not found', async () => {
      const { joinAudioSpace } = await import('../../src/social/audioSpaces');

      await expect(joinAudioSpace('non-existent-space')).rejects.toThrow('not found');
    });
  });

  describe('leaveAudioSpace', () => {
    it('should leave an audio space', async () => {
      const { createAudioSpace, leaveAudioSpace, getAudioSpace } = await import('../../src/social/audioSpaces');

      const space = await createAudioSpace('test-channel');
      await leaveAudioSpace(space.spaceID);

      // After leaving, space should be cleaned up if empty
      const remaining = getAudioSpace(space.spaceID);
      // Space is deleted when empty, so remaining could be undefined
      if (remaining) {
        expect(remaining.participants).not.toContain('test-peer-id');
      }
    });
  });

  describe('toggleMute', () => {
    it('should toggle mute state', async () => {
      const { createAudioSpace, toggleMute, getAudioSpace } = await import('../../src/social/audioSpaces');

      const space = await createAudioSpace('test-channel');
      expect(space.isMuted).toBe(false);

      // Inject mock local stream
      space.setLocalStream(mockMediaStream as unknown as MediaStream);

      const muted = await toggleMute(space.spaceID);
      expect(muted).toBe(true);

      const unmuted = await toggleMute(space.spaceID);
      expect(unmuted).toBe(false);
    });
  });

  describe('getAudioSpace', () => {
    it('should get audio space by ID', async () => {
      const { createAudioSpace, getAudioSpace } = await import('../../src/social/audioSpaces');

      const space = await createAudioSpace('test-channel');
      const retrieved = getAudioSpace(space.spaceID);

      expect(retrieved).toBeDefined();
      expect(retrieved?.spaceID).toBe(space.spaceID);
    });

    it('should return undefined for non-existent space', async () => {
      const { getAudioSpace } = await import('../../src/social/audioSpaces');

      const space = getAudioSpace('non-existent');
      expect(space).toBeUndefined();
    });
  });

  describe('getAllActiveSpaces', () => {
    it('should return all active spaces', async () => {
      const { createAudioSpace, getAllActiveSpaces } = await import('../../src/social/audioSpaces');

      await createAudioSpace('channel-1');
      await createAudioSpace('channel-2');

      const spaces = getAllActiveSpaces();
      expect(spaces.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('handleAudioMessage', () => {
    it('should handle join message', async () => {
      const { createAudioSpace, handleAudioMessage, getAudioSpace } = await import('../../src/social/audioSpaces');

      const space = await createAudioSpace('test-channel');
      
      const message = {
        type: 'join' as const,
        spaceID: space.spaceID,
        sender: 'new-participant',
        data: null,
        timestamp: Date.now(),
      };

      await handleAudioMessage(message);
      const updated = getAudioSpace(space.spaceID);
      expect(updated?.participants).toContain('new-participant');
    });

    it('should handle leave message', async () => {
      const { createAudioSpace, handleAudioMessage, getAudioSpace } = await import('../../src/social/audioSpaces');

      const space = await createAudioSpace('test-channel');
      space.participants.push('participant-to-leave');
      
      const message = {
        type: 'leave' as const,
        spaceID: space.spaceID,
        sender: 'participant-to-leave',
        data: null,
        timestamp: Date.now(),
      };

      await handleAudioMessage(message);
      const updated = getAudioSpace(space.spaceID);
      expect(updated?.participants).not.toContain('participant-to-leave');
    });
  });
});
