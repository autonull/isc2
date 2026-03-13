/**
 * Message Sender Service
 *
 * Handles sending messages with rate limiting and delivery confirmation.
 */

import type { Libp2p } from 'libp2p';
import { fromString } from 'uint8arrays';
import type { ChatMessage, MessageStatus } from '../types/chat.js';
import { CHAT_CONFIG } from '../config/chatConfig.js';
import { MessageQueue } from '../models/MessageQueue.js';
import { checkChatRate } from '../../../rateLimit.js';

export class MessageSender {
  private queue: MessageQueue;

  constructor(queue: MessageQueue) {
    this.queue = queue;
  }

  /**
   * Send message with delivery confirmation
   */
  async send(
    peerId: string,
    message: ChatMessage,
    node: Libp2p,
    onStatusUpdate?: (messageId: number, status: MessageStatus) => void
  ): Promise<void> {
    // Rate limit check
    const rateCheck = checkChatRate(node.peerId.toString());
    if (!rateCheck.allowed) {
      const reason = rateCheck.blocked ? 'blocked' : 'rate limited';
      throw new Error(
        rateCheck.blocked
          ? `Chat blocked due to repeated violations. Try again in ${rateCheck.retryAfter}s`
          : `Chat rate limit exceeded. Try again in ${rateCheck.retryAfter}s`
      );
    }

    const messageId = this.queue.add(
      message,
      CHAT_CONFIG.messageTimeout,
      () => {},
      onStatusUpdate
    );

    const messageWithId = { ...message, id: String(messageId), status: 'pending' };

    try {
      const stream: any = await node.dialProtocol(peerId as any, CHAT_CONFIG.protocolChat);

      const encoded = fromString(JSON.stringify(messageWithId), 'utf-8');
      await stream.sink([encoded]);

      if (onStatusUpdate) {
        onStatusUpdate(messageId, 'sent');
      }

      return new Promise((resolve, reject) => {
        const pending = this.queue.get(messageId);
        if (pending) {
          pending.resolve = resolve;
          pending.reject = reject;
        }
      });
    } catch (err) {
      this.queue.reject(messageId, err as Error, onStatusUpdate);
      throw err;
    }
  }
}
