/**
 * Message Receiver Service
 *
 * Handles incoming message processing, verification, and acknowledgments.
 */

import type { Libp2p } from 'libp2p';
import { fromString, toString } from 'uint8arrays';
import type { ChatMessage, TypingIndicator, MessageStatus } from '../types/chat.js';
import { CHAT_CONFIG } from '../config/chatConfig.js';
import { verifySignature, isPeerBlocked } from '../../../crypto/verifier.js';

interface MessageCallbacks {
  onMessage?: (msg: ChatMessage) => void;
  onStatusUpdate?: (messageId: number, status: MessageStatus) => void;
  onTyping?: (indicator: TypingIndicator) => void;
}

export class MessageReceiver {
  private callbacks: MessageCallbacks;
  private publicKeyCache: Map<string, string> = new Map();

  constructor(callbacks: MessageCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Handle incoming stream
   */
  async handleStream(stream: any): Promise<void> {
    try {
      for await (const chunk of stream.source as AsyncIterable<Uint8Array>) {
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
          console.error('[Chat] Failed to parse message:', err);
        }
      }
    } catch (err) {
      console.error('[Chat] Stream error:', err);
    }
  }

  /**
   * Process incoming message
   */
  private async processMessage(msg: ChatMessage, stream: any): Promise<void> {
    if (msg.signature && msg.publicKey) {
      if (isPeerBlocked(msg.sender)) {
        console.warn('[Chat] Blocked peer message ignored:', msg.sender);
        return;
      }

      try {
        const publicKey = await this.getPublicKey(msg.sender, msg.publicKey);
        const result = await verifySignature(msg, publicKey, msg.sender);

        if (!result.valid) {
          console.warn('[Chat] Invalid signature from:', msg.sender, result.reason);
          return;
        }
      } catch (err) {
        console.error('[Chat] Signature verification failed:', err);
      }
    }

    if (this.callbacks.onMessage) {
      this.callbacks.onMessage(msg);
    }

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
   * Handle acknowledgment
   */
  private handleAcknowledgment(messageId: number): void {
    if (this.callbacks.onStatusUpdate) {
      this.callbacks.onStatusUpdate(messageId, 'delivered');
    }
  }

  /**
   * Send acknowledgment
   */
  private async sendAcknowledgment(timestamp: number, stream: any): Promise<void> {
    const ack = { ack: timestamp };
    await stream.sink([fromString(JSON.stringify(ack))]);
  }

  /**
   * Get or cache public key
   */
  private async getPublicKey(peerId: string, publicKeyHex: string): Promise<CryptoKey> {
    const cacheKey = CHAT_CONFIG.signatureKeyPrefix + peerId;

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
}
