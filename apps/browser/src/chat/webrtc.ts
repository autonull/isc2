/* eslint-disable */
/**
 * Real WebRTC Chat Handler
 *
 * No mocks - actual P2P chat via libp2p
 *
 * Facade module re-exporting WebRTC chat functionality.
 */

export type {
  MessageStatus,
  ChatMessage,
  TypingIndicator,
  PendingMessage,
  MessageSendResult,
  ChatConfig,
} from './webrtc/types/chat.ts';

export { CHAT_CONFIG, CHAT_CONSTANTS } from './webrtc/config/chatConfig.ts';

export { MessageQueue } from './webrtc/models/MessageQueue.ts';

export { MessageSender } from './webrtc/services/MessageSender.ts';
export { MessageReceiver } from './webrtc/services/MessageReceiver.ts';
export { TypingIndicatorService } from './webrtc/services/TypingIndicatorService.ts';
export { StreamManager } from './webrtc/services/StreamManager.ts';
export { WebRTChatHandler } from './webrtc/services/WebRTChatHandler.ts';

export {
  encodeMessage,
  decodeMessage,
  encodeAck,
  decodeAck,
  isTypingIndicator,
  isAcknowledgment,
} from './webrtc/utils/messageSerializer.ts';

// Re-export for backward compatibility
import type { Libp2p } from 'libp2p';
import type { Stream } from '@libp2p/interface';
import type { ChatMessage, TypingIndicator, MessageStatus } from './webrtc/types/chat.ts';
import { WebRTChatHandler } from './webrtc/services/WebRTChatHandler.ts';

export interface ChatHandler {
  handleStream(stream: Stream): Promise<void>;
  registerWithNode(node: Libp2p): void;
  setOnMessage(callback: (msg: ChatMessage) => void): void;
  setOnStatusUpdate(callback: (messageId: number, status: MessageStatus) => void): void;
  setOnTyping(callback: (indicator: TypingIndicator) => void): void;
  sendTypingIndicator(peerId: string, channelID: string, node: Libp2p): void;
  sendMessage(peerId: string, message: ChatMessage, node: Libp2p): Promise<void>;
  closeStream(peerId: string): Promise<void>;
  closeAll(): Promise<void>;
}

export class RealChatHandler implements ChatHandler {
  private handler: WebRTChatHandler;
  // Expose for backward compatibility with code checking ['registeredNode']
  public registeredNode: Libp2p | null = null;

  constructor() {
    this.handler = new WebRTChatHandler();
  }

  setOnMessage(callback: (msg: ChatMessage) => void): void {
    this.handler.setOnMessage(callback);
  }

  setOnStatusUpdate(callback: (messageId: number, status: MessageStatus) => void): void {
    this.handler.setOnStatusUpdate(callback);
  }

  setOnTyping(callback: (indicator: TypingIndicator) => void): void {
    this.handler.setOnTyping(callback);
  }

  sendTypingIndicator(peerId: string, channelID: string, node: Libp2p): void {
    this.handler.sendTypingIndicator(peerId, channelID, node);
  }

  registerWithNode(node: Libp2p): void {
    this.registeredNode = node;
    this.handler.registerWithNode(node);
  }

  async handleStream(stream: Stream): Promise<void> {
    await this.handler.handleStream(stream);
  }

  async sendMessage(peerId: string, message: ChatMessage, node: Libp2p): Promise<void> {
    return this.handler.sendMessage(peerId, message, node);
  }

  async closeStream(peerId: string): Promise<void> {
    await this.handler.closeStream(peerId);
  }

  async closeAll(): Promise<void> {
    await this.handler.closeAll();
  }
}

// Singleton instance
let chatHandlerInstance: RealChatHandler | null = null;

export function getChatHandler(): RealChatHandler {
  if (!chatHandlerInstance) {
    chatHandlerInstance = new RealChatHandler();
  }
  return chatHandlerInstance;
}
