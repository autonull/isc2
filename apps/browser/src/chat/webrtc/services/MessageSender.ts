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
import { loggers } from '../../../utils/logger.js';

const logger = loggers.chat;

export class MessageSender {
  private queue: MessageQueue;
  private pendingDelivery = new Map<
    number,
    {
      messageId: number;
      timestamp: number;
      peerId: string;
      retryCount: number;
    }
  >();

  constructor(queue: MessageQueue) {
    this.queue = queue;

    // Start delivery monitoring
    this.startDeliveryMonitor();
  }

  /**
   * Monitor pending deliveries and mark as failed if timeout
   */
  private startDeliveryMonitor(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [messageId, data] of this.pendingDelivery.entries()) {
        const elapsed = now - data.timestamp;

        // Timeout after 30 seconds
        if (elapsed > CHAT_CONFIG.messageTimeout) {
          if (data.retryCount < 3) {
            // Retry sending
            data.retryCount++;
            data.timestamp = now;
            logger.debug('Retrying message', {
              messageId: String(messageId),
              attempt: String(data.retryCount),
            });
          } else {
            // Mark as failed after 3 retries
            this.pendingDelivery.delete(messageId);
            logger.warn('Message failed after retries', { messageId: String(messageId) });
          }
        }
      }
    }, 5000); // Check every 5 seconds
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
      throw new Error(
        rateCheck.blocked
          ? `Chat blocked due to repeated violations. Try again in ${rateCheck.retryAfter}s`
          : `Chat rate limit exceeded. Try again in ${rateCheck.retryAfter}s`
      );
    }

    const messageId = this.queue.add(message, CHAT_CONFIG.messageTimeout, () => {}, onStatusUpdate);

    const messageWithId = { ...message, id: String(messageId), status: 'pending' as MessageStatus };

    // Track pending delivery
    this.pendingDelivery.set(messageId, {
      messageId,
      timestamp: Date.now(),
      peerId,
      retryCount: 0,
    });

    try {
      const stream: any = await node.dialProtocol(peerId as any, CHAT_CONFIG.protocolChat);

      const encoded = fromString(JSON.stringify(messageWithId), 'utf-8');
      await stream.sink([encoded]);

      // Update status to sent (message left our client)
      if (onStatusUpdate) {
        onStatusUpdate(messageId, 'sent');
      }

      // Wait for delivery confirmation or timeout
      return new Promise((resolve, reject) => {
        const pending = this.queue.get(messageId);
        if (pending) {
          pending.resolve = () => {
            this.pendingDelivery.delete(messageId);
            resolve();
          };
          pending.reject = (err: Error) => {
            this.pendingDelivery.delete(messageId);
            reject(err);
          };
        } else {
          resolve();
        }
      });
    } catch (err) {
      this.pendingDelivery.delete(messageId);
      this.queue.reject(messageId, err as Error, onStatusUpdate);
      throw err;
    }
  }

  /**
   * Mark message as delivered
   */
  markDelivered(messageId: number): void {
    this.pendingDelivery.delete(messageId);
  }

  /**
   * Get pending delivery count
   */
  getPendingDeliveryCount(): number {
    return this.pendingDelivery.size;
  }

  /**
   * Clear all pending deliveries
   */
  clearPending(): void {
    this.pendingDelivery.clear();
  }
}
