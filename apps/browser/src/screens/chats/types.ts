/**
 * Chat types
 */

export interface Conversation {
  peerId: string;
  channelID: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
}

export const CONVERSATIONS_KEY = 'isc-conversations';
export const MESSAGES_KEY_PREFIX = 'isc-messages-';
