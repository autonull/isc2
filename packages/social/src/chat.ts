/* eslint-disable */
/**
 * Chat Service
 *
 * Direct messaging business logic.
 * Storage and identity are injected via adapters.
 */

import type { Message, Conversation } from './types';
import type { SocialStorage, SocialIdentity, SocialNetwork } from './adapters/interfaces';

export interface ChatService {
  getConversations(): Promise<Conversation[]>;
  getMessages(peerId: string): Promise<Message[]>;
  sendMessage(peerId: string, content: string): Promise<Message>;
  markAsRead(peerId: string): Promise<void>;
  setIncomingHandler(handler: (data: { peerId: string; message: Message }) => void): void;
  receiveMessage(peerId: string, messageData: Partial<Message>): Promise<Message>;
}

export function createChatService(
  storage: SocialStorage,
  identity: SocialIdentity,
  network?: SocialNetwork
): ChatService {
  let incomingHandler: ((data: { peerId: string; message: Message }) => void) | null = null;

  return {
    setIncomingHandler(handler) {
      incomingHandler = handler;
    },

    async receiveMessage(peerId: string, messageData: Partial<Message>): Promise<Message> {
      const myId = await identity.getPeerId();

      const message: Message = {
        id: messageData.id ?? `msg_${Date.now()}`,
        conversationId: `${[myId, peerId].sort().join(':')}`,
        senderId: peerId,
        content: messageData.content ?? '',
        timestamp: messageData.timestamp ?? Date.now(),
        read: false,
      };

      // Save locally
      await storage.saveMessage(message);

      // Notify handler
      if (incomingHandler) {
        incomingHandler({ peerId, message });
      }

      return message;
    },

    async getConversations(): Promise<Conversation[]> {
      const messages = await storage.getMessages('');
      const peerIds = new Set(messages.map((m: Message) => m.senderId));
      const myId = await identity.getPeerId();

      const conversations: Conversation[] = [];

      for (const peerId of peerIds) {
        const peerMessages = await storage.getMessages(peerId);
        const lastMessage = peerMessages[peerMessages.length - 1];
        const unreadCount = peerMessages.filter((m: Message) => !m.read && m.senderId !== myId).length;

        if (lastMessage) {
          conversations.push({
            id: lastMessage.conversationId,
            peerId,
            peerName: peerId.slice(0, 8),
            lastMessage,
            unreadCount,
            online: false,
            createdAt: peerMessages[0].timestamp,
            updatedAt: lastMessage.timestamp,
          });
        }
      }

      return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async getMessages(peerId: string): Promise<Message[]> {
      return storage.getMessages(peerId);
    },

    async sendMessage(peerId: string, content: string): Promise<Message> {
      const myId = await identity.getPeerId();
      const conversationId = `${[myId, peerId].sort().join(':')}`;

      const message: Message = {
        id: `msg_${Date.now()}`,
        conversationId,
        senderId: myId,
        content,
        timestamp: Date.now(),
        read: true,
      };

      // Save locally
      await storage.saveMessage(message);

      // Send via network
      if (network) {
        await network.sendMessage(peerId, message);
      }

      return message;
    },

    async markAsRead(peerId: string): Promise<void> {
      const messages = await storage.getMessages(peerId);
      const myId = await identity.getPeerId();

      for (const message of messages) {
        if (message.senderId !== myId && !message.read) {
          message.read = true;
          await storage.saveMessage(message);
        }
      }
    },
  };
}
