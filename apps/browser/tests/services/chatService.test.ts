/* eslint-disable */
/**
 * Chat Service Tests
 *
 * Tests DM delivery, reception, conversation list, and message persistence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  get length() { return Object.keys(store).length; },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

// Mock discoveryService
vi.mock('../../src/services/discoveryService.js', () => ({
  discoveryService: {
    getMatches: vi.fn().mockReturnValue([
      { peerId: 'peer-1', identity: { name: 'Alice' }, similarity: 0.8 },
      { peerId: 'peer-2', identity: { name: 'Bob' }, similarity: 0.6 },
    ]),
  },
}));

// Mock networkService
vi.mock('../../src/services/network.ts', () => ({
  networkService: {
    initialize: vi.fn().mockResolvedValue(true),
    getStatus: vi.fn().mockReturnValue({ connected: true, status: 'connected' }),
  },
}));

// Mock DHT
vi.mock('../../src/network/dht.js', () => ({
  getDHTClient: vi.fn().mockReturnValue({
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
  }),
  initializeDHT: vi.fn().mockResolvedValue(undefined),
}));

// Mock identity
vi.mock('../../src/identity/index.js', () => ({
  getPeerID: vi.fn().mockResolvedValue('my-peer-id'),
  getKeypair: vi.fn().mockReturnValue({
    privateKey: {} as CryptoKey,
    publicKey: {} as CryptoKey,
  }),
}));

// Mock logger
vi.mock('../../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock @isc/core
vi.mock('@isc/core', () => ({
  encode: vi.fn((data) => new TextEncoder().encode(JSON.stringify(data))),
}));

describe('Chat Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store['isc:chat:unread:peer-1'] = '0';
    store['isc:chat:unread:peer-2'] = '0';
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('receiveMessage', () => {
    it('should store incoming message and increment unread count', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      chatService.receiveMessage('peer-1', {
        id: 'msg-1',
        content: 'Hello!',
        timestamp: 1000,
      });

      const messages = chatService.getMessages('peer-1');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        id: 'msg-1',
        content: 'Hello!',
        fromMe: false,
        delivered: true,
      });

      expect(store['isc:chat:unread:peer-1']).toBe('1');
    });

    it('should auto-generate message ID if not provided', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      chatService.receiveMessage('peer-1', {
        content: 'No ID',
      });

      const messages = chatService.getMessages('peer-1');
      expect(messages[0].id).toBeDefined();
      expect(messages[0].id.startsWith('msg-')).toBe(true);
    });
  });

  describe('sendMessage', () => {
    it('should store sent message with fromMe=true', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      await chatService.sendMessage('peer-1', 'Hi Alice!');

      const messages = chatService.getMessages('peer-1');
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        content: 'Hi Alice!',
        fromMe: true,
        peerId: 'peer-1',
      });
    });

    it('should queue message to pending if DHT send fails', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      await chatService.sendMessage('peer-unknown', 'Nobody here');

      const messages = chatService.getMessages('peer-unknown');
      expect(messages).toHaveLength(1);
      expect(messages[0].pending).toBe(true);
    });
  });

  describe('getConversations', () => {
    it('should merge discovery matches with DM peers from localStorage', async () => {
      // Add a DM-only peer (not in discovery matches)
      mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
        store[key] = value;
        return undefined;
      });
      store['isc:chat:dm-peer-3'] = 'true';

      const { chatService } = await import('../../src/services/chatService.js');
      const convos = chatService.getConversations();

      // Should include Alice, Bob (from matches) + peer-3 (from DM storage)
      const peerIds = convos.map((c: { peerId: string }) => c.peerId);
      expect(peerIds).toContain('peer-1');
      expect(peerIds).toContain('peer-2');
      expect(peerIds).toContain('peer-3');
    });

    it('should sort conversations by most recent message', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      // Add messages with different timestamps
      chatService.receiveMessage('peer-1', { content: 'Old', timestamp: 100 });
      chatService.receiveMessage('peer-2', { content: 'New', timestamp: 200 });

      const convos = chatService.getConversations();
      expect(convos[0].peerId).toBe('peer-2'); // Most recent first
    });
  });

  describe('markAsRead', () => {
    it('should reset unread count', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      // First receive a message
      chatService.receiveMessage('peer-1', { id: 'msg-1', content: 'Hi' });
      expect(store['isc:chat:unread:peer-1']).toBe('1');

      chatService.markAsRead('peer-1');
      expect(store['isc:chat:unread:peer-1']).toBe('0');
    });
  });

  describe('getUnreadCount', () => {
    it('should return total unread across all conversations', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      chatService.receiveMessage('peer-1', { id: 'msg-1', content: 'Hi' });
      chatService.receiveMessage('peer-1', { id: 'msg-2', content: 'Hi 2' });
      chatService.receiveMessage('peer-2', { id: 'msg-3', content: 'Hey' });

      const total = chatService.getTotalUnread();
      expect(total).toBe(3);
    });
  });

  describe('deleteConversation', () => {
    it('should remove all messages and unread count', async () => {
      const { chatService } = await import('../../src/services/chatService.js');

      chatService.receiveMessage('peer-1', { id: 'msg-1', content: 'Hi' });
      expect(chatService.getMessages('peer-1')).toHaveLength(1);

      chatService.deleteConversation('peer-1');
      expect(chatService.getMessages('peer-1')).toHaveLength(0);
      expect(store['isc:chat:unread:peer-1']).toBe('0');
    });
  });
});
