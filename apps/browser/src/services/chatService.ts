/**
 * Chat Service
 *
 * Manages direct message conversations and message history.
 */

import { dbGetAll, dbPut, dbFilter } from '../db/helpers.js';
import { getPeerID } from '../identity/index.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.social;
const CONVERSATIONS_STORE = 'conversations';
const MESSAGES_STORE = 'messages';

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  createdAt: number;
  updatedAt: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  read: boolean;
}

/**
 * Handle database errors consistently
 */
function handleDbError(
  operation: string,
  err: unknown,
  context?: Record<string, unknown>
): never[] {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error(`Failed to ${operation}`, error, context);
  return [];
}

class ChatServiceImpl {
  async getConversations(): Promise<Conversation[]> {
    try {
      const conversations = await dbGetAll<Conversation>(CONVERSATIONS_STORE);
      return conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
      return handleDbError('get conversations', err);
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const messages = await dbFilter<Message>(
        MESSAGES_STORE,
        (m) => m.conversationId === conversationId
      );
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (err) {
      return handleDbError('get messages', err, { conversationId });
    }
  }

  async send(conversationId: string, content: string): Promise<void> {
    try {
      const senderId = await getPeerID();
      const message: Message = {
        id: `msg_${crypto.randomUUID()}`,
        conversationId,
        senderId,
        content,
        timestamp: Date.now(),
        read: false,
      };

      await dbPut(MESSAGES_STORE, message);

      // Update conversation last message
      const conversations = await this.getConversations();
      const conversation = conversations.find((c) => c.id === conversationId);
      if (conversation) {
        conversation.lastMessage = content;
        conversation.lastMessageTime = Date.now();
        conversation.updatedAt = Date.now();
        await dbPut(CONVERSATIONS_STORE, conversation);
      }

      logger.info('Message sent', { conversationId, messageId: message.id });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to send message', error, { conversationId });
      throw error;
    }
  }

  async createConversation(userId: string): Promise<Conversation> {
    try {
      const conversations = await this.getConversations();
      const existing = conversations.find((c) => c.participantId === userId);
      if (existing) {
        return existing;
      }

      const conversation: Conversation = {
        id: `conv_${crypto.randomUUID()}`,
        participantId: userId,
        participantName: `@${userId.slice(0, 8)}`,
        unreadCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await dbPut(CONVERSATIONS_STORE, conversation);
      logger.info('Conversation created', { conversationId: conversation.id, participant: userId });
      return conversation;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to create conversation', error, { userId });
      throw error;
    }
  }
}

let _instance: ChatServiceImpl | null = null;

export function getChatService(): ChatServiceImpl {
  if (!_instance) {
    _instance = new ChatServiceImpl();
  }
  return _instance;
}

export function createChatService(): ChatServiceImpl {
  return getChatService();
}
