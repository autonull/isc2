/**
 * WebRTC Chat Type Definitions
 */

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface ChatMessage {
  channelID: string;
  msg: string;
  timestamp: number;
  sender: string;
  id?: string;
  status?: MessageStatus;
  signature?: Uint8Array | string;
  publicKey?: string;
}

export interface TypingIndicator {
  channelID: string;
  timestamp: number;
  sender: string;
}

export interface PendingMessage {
  message: ChatMessage;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface MessageSendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

export interface ChatConfig {
  messageTimeout: number;
  typingCooldown: number;
  typingTimeout: number;
  signatureKeyPrefix: string;
  protocolChat: string;
}
