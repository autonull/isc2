/**
 * Message Receiver Service
 *
 * Handles incoming message processing, verification, and acknowledgments.
 */

import type { Stream } from '@libp2p/interface';
import { fromString, toString } from 'uint8arrays';
import type { ChatMessage, TypingIndicator, MessageStatus } from '../types/chat.js';
import { verifySignature, isPeerBlocked } from '../../../crypto/verifier.js';
import { loggers } from '../../../utils/logger.js';

const logger = loggers.chat;

interface MessageCallbacks {
  onMessage?: (msg: ChatMessage) => void;
  onStatusUpdate?: (messageId: number, status: MessageStatus) => void;
  onTyping?: (indicator: TypingIndicator) => void;
}

export class MessageReceiver {
  private callbacks: MessageCallbacks;
  private publicKeyCache: Map<string, string> = new Map();
  private pendingAcks = new Map<number, { timestamp: number; peerId: string }>();

  constructor(callbacks: MessageCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Handle incoming stream
   */
  async handleStream(stream: Stream): Promise<void> {
    try {
      for await (const chunk of (stream as any).source as AsyncIterable<Uint8Array>) {
        try {
          const data = JSON.parse(toString(chunk, 'utf-8'));

          if (data.type === 'typing') {
            this.handleTypingIndicator(data);
            continue;
          }

          if (data.ack) {
            this.handleAcknowledgment(data.ack);
            continue;
          }

          const msg: ChatMessage = data;
          await this.processMessage(msg, stream);
        } catch (err) {
          logger.warn('Failed to parse message', { error: (err as Error).message });
        }
      }
    } catch (err) {
      logger.error('Stream error', undefined, { error: (err as Error).message });
    }
  }

  /**
   * Process incoming message
   */
  private async processMessage(msg: ChatMessage, stream: Stream): Promise<void> {
    // Verify signature if present
    if (msg.signature && msg.publicKey) {
      if (isPeerBlocked(msg.sender)) {
        logger.warn('Blocked peer message ignored', { sender: msg.sender });
        return;
      }

      try {
        const publicKey = await this.getPublicKey(msg.sender, msg.publicKey);
        const result = await verifySignature(msg, publicKey, msg.sender);

        if (!result.valid) {
          logger.warn('Invalid signature', { sender: msg.sender, reason: result.reason });
          return;
        }
      } catch (err) {
        logger.error('Signature verification failed', undefined, { error: (err as Error).message });
        // Continue anyway - don't block messages due to verification errors
      }
    }

    // Mark message as delivered locally
    if (msg.id) {
      const messageId = parseInt(msg.id, 10);
      if (!isNaN(messageId)) {
        this.pendingAcks.set(messageId, {
          timestamp: msg.timestamp,
          peerId: msg.sender,
        });
      }
    }

    // Notify callback
    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(msg);
    }

    // Send acknowledgment
    await this.sendAcknowledgment(msg.timestamp, stream);
  }

  /**
   * Handle typing indicator
   */
  private handleTypingIndicator(indicator: TypingIndicator): void {
    if (this.callbacks.onTyping) {
      this.callbacks.onTyping(indicator);
    }
  }

  /**
   * Handle acknowledgment - marks message as delivered
   */
  private handleAcknowledgment(messageId: number): void {
    logger.debug('Message acknowledged', { messageId: String(messageId) });
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(messageId, 'delivered');
    }

    // Clean up pending ack
    this.pendingAcks.delete(messageId);
  }

  /**
   * Send acknowledgment
   */
  private async sendAcknowledgment(timestamp: number, stream: Stream): Promise<void> {
    try {
      const ack = { ack: timestamp };
      await (stream as any).sink([fromString(JSON.stringify(ack))]);
    } catch (err) {
      logger.warn('Failed to send acknowledgment', { error: (err as Error).message });
    }
  }

  /**
   * Get or cache public key
   */
  private async getPublicKey(peerId: string, publicKeyHex: string): Promise<CryptoKey> {
    if (this.publicKeyCache.has(peerId) && this.publicKeyCache.get(peerId) === publicKeyHex) {
      const keyData = this.hexToBytes(publicKeyHex);
      return await this.importPublicKey(keyData);
    }

    const keyData = this.hexToBytes(publicKeyHex);
    const key = await this.importPublicKey(keyData);
    this.publicKeyCache.set(peerId, publicKeyHex);
    return key;
  }

  /**
   * Import public key
   */
  private async importPublicKey(keyData: Uint8Array): Promise<CryptoKey> {
    return await globalThis.crypto.subtle.importKey(
      'raw',
      keyData.buffer as ArrayBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    );
  }

  /**
   * Convert hex to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
      parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    );
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: MessageCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Clear public key cache
   */
  clearKeyCache(): void {
    this.publicKeyCache.clear();
  }

  /**
   * Get pending acknowledgments count
   */
  getPendingAcksCount(): number {
    return this.pendingAcks.size;
  }

  /**
   * Clear pending acknowledgments older than timeout
   */
  cleanupPendingAcks(timeoutMs: number = 30000): void {
    const now = Date.now();
    for (const [messageId, data] of this.pendingAcks.entries()) {
      if (now - data.timestamp > timeoutMs) {
        this.pendingAcks.delete(messageId);
        if (this.callbacks.onStatusUpdate) {
          this.callbacks.onStatusUpdate(messageId, 'failed');
        }
      }
    }
  }
}
