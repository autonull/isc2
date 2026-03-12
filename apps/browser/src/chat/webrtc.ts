/**
 * Real WebRTC Chat Handler
 *
 * No mocks - actual P2P chat via libp2p
 */

import type { Libp2p } from 'libp2p';
import { fromString, toString } from 'uint8arrays';
import { verifySignature, isPeerBlocked } from '../crypto/verifier.js';
import { checkChatRate } from '../rateLimit.js';

const PROTOCOL_CHAT = '/isc/chat/1.0';
const MESSAGE_TIMEOUT = 10000; // 10 seconds for delivery confirmation
const SIGNATURE_KEY_PREFIX = 'isc-pubkey-';

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

interface PendingMessage {
  message: ChatMessage;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface ChatHandler {
  handleStream(stream: any): Promise<void>;
  registerWithNode(node: Libp2p): void;
}

export class RealChatHandler implements ChatHandler {
  private onMessage?: (msg: ChatMessage) => void;
  private onStatusUpdate?: (messageId: number, status: MessageStatus) => void;
  private onTyping?: (indicator: TypingIndicator) => void;
  private activeStreams: Map<string, any> = new Map();
  private registeredNode: Libp2p | null = null;
  private pendingMessages = new Map<number, PendingMessage>();
  private messageCounter = 0;
  private typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private lastTypingSent = new Map<string, number>();
  private readonly TYPING_COOLDOWN = 2000; // 2s between typing events
  private readonly TYPING_TIMEOUT = 3000; // 3s to clear typing indicator

  setOnMessage(callback: (msg: ChatMessage) => void): void {
    this.onMessage = callback;
  }

  setOnStatusUpdate(callback: (messageId: number, status: MessageStatus) => void): void {
    this.onStatusUpdate = callback;
  }

  setOnTyping(callback: (indicator: TypingIndicator) => void): void {
    this.onTyping = callback;
  }

  sendTypingIndicator(peerId: string, channelID: string, node: Libp2p): void {
    const now = Date.now();
    const lastSent = this.lastTypingSent.get(peerId) || 0;

    // Debounce: only send if cooldown has passed
    if (now - lastSent < this.TYPING_COOLDOWN) {
      return;
    }

    this.lastTypingSent.set(peerId, now);

    const indicator: TypingIndicator = {
      channelID,
      timestamp: now,
      sender: 'me',
    };

    // Send typing indicator (fire and forget, don't wait)
    (async () => {
      try {
        const stream: any = await node.dialProtocol(peerId as any, PROTOCOL_CHAT);
        const encoded = fromString(JSON.stringify({ type: 'typing', ...indicator }), 'utf-8');
        await (stream as any).sink([encoded]);
      } catch (err) {
        // Ignore errors for typing indicators
      }
    })();
  }

  /**
   * Get or cache public key for a peer
   */
  private async getPublicKey(peerId: string, publicKeyHex: string): Promise<CryptoKey> {
    const cacheKey = SIGNATURE_KEY_PREFIX + peerId;
    
    // Try to get from localStorage cache
    const cached = localStorage.getItem(cacheKey);
    if (cached && cached === publicKeyHex) {
      const keyData = this.hexToBytes(publicKeyHex);
      return await this.importPublicKey(keyData);
    }

    // Import and cache new key
    const keyData = this.hexToBytes(publicKeyHex);
    const key = await this.importPublicKey(keyData);
    localStorage.setItem(cacheKey, publicKeyHex);
    return key;
  }

  private async importPublicKey(keyData: Uint8Array): Promise<CryptoKey> {
    return await globalThis.crypto.subtle.importKey(
      'raw',
      keyData.buffer as ArrayBuffer,
      { name: 'Ed25519' },
      true,
      ['verify']
    );
  }

  private hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from({ length: hex.length / 2 }, (_, i) => 
      parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    );
  }

  /**
   * Register this handler with libp2p node to receive incoming streams
   */
  registerWithNode(node: Libp2p): void {
    this.registeredNode = node;
    node.handle(PROTOCOL_CHAT, (event: any) => this.handleStream(event.stream));
    console.log('[Chat] Registered handler for', PROTOCOL_CHAT);
  }

  async handleStream(stream: any): Promise<void> {
    console.log('[Chat] Incoming stream');

    try {
      // Read messages from stream
      for await (const chunk of stream.source as AsyncIterable<Uint8Array>) {
        try {
          const data = JSON.parse(toString(chunk, 'utf-8'));

          // Check if it's a typing indicator
          if (data.type === 'typing') {
            const indicator: TypingIndicator = data;
            console.log('[Chat] Received typing indicator from:', indicator.sender);
            
            if (this.onTyping) {
              this.onTyping(indicator);
            }
            
            // Clear existing timeout and set new one
            const key = indicator.sender;
            if (this.typingTimeouts.has(key)) {
              clearTimeout(this.typingTimeouts.get(key));
            }
            
            // Clear typing indicator after timeout
            this.typingTimeouts.set(key, setTimeout(() => {
              this.typingTimeouts.delete(key);
              if (this.onTyping) {
                this.onTyping({ ...indicator, timestamp: 0 }); // timestamp 0 means stopped typing
              }
            }, this.TYPING_TIMEOUT));
            
            continue;
          }

          // Check if it's an acknowledgment
          if (data.ack) {
            console.log('[Chat] Received ack:', data.ack);
            const pending = this.pendingMessages.get(data.ack);
            if (pending) {
              clearTimeout(pending.timeoutId);
              this.pendingMessages.delete(data.ack);
              pending.resolve();
              // Update message status to delivered
              if (this.onStatusUpdate) {
                this.onStatusUpdate(data.ack, 'delivered');
              }
            }
            continue;
          }

          const msg: ChatMessage = data;
          console.log('[Chat] Received:', msg);

          // Verify signature if present
          if (msg.signature && msg.publicKey) {
            // Check if peer is blocked
            if (isPeerBlocked(msg.sender)) {
              console.warn('[Chat] Blocked peer message ignored:', msg.sender);
              continue;
            }

            try {
              // Get or create public key
              let publicKey = await this.getPublicKey(msg.sender, msg.publicKey);
              
              // Verify signature
              const result = await verifySignature(msg, publicKey, msg.sender);
              
              if (!result.valid) {
                console.warn('[Chat] Invalid signature from:', msg.sender, result.reason);
                continue; // Skip invalid messages
              }
            } catch (err) {
              console.error('[Chat] Signature verification failed:', err);
              // Still accept message but log warning
            }
          }

          if (this.onMessage) {
            this.onMessage(msg);
          }

          // Send acknowledgment
          const ack = { ack: msg.timestamp };
          await (stream as any).sink([fromString(JSON.stringify(ack))]);
        } catch (err) {
          console.error('[Chat] Failed to parse message:', err);
        }
      }
    } catch (err) {
      console.error('[Chat] Stream error:', err);
    }
  }

  async sendMessage(peerId: string, message: ChatMessage, node: Libp2p): Promise<void> {
    // Rate limit check
    const rateCheck = checkChatRate(node.peerId.toString());
    if (!rateCheck.allowed) {
      const reason = rateCheck.blocked ? 'blocked' : 'rate limited';
      console.warn('[Chat] Send rejected:', reason, 'peer:', node.peerId.toString());
      throw new Error(
        rateCheck.blocked 
          ? `Chat blocked due to repeated violations. Try again in ${rateCheck.retryAfter}s`
          : `Chat rate limit exceeded. Try again in ${rateCheck.retryAfter}s`
      );
    }

    const messageId = ++this.messageCounter;
    const messageWithId: ChatMessage = { ...message, id: String(messageId), status: 'pending' };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        if (this.onStatusUpdate) {
          this.onStatusUpdate(messageId, 'failed');
        }
        reject(new Error('Message delivery timeout'));
      }, MESSAGE_TIMEOUT);

      this.pendingMessages.set(messageId, {
        message: messageWithId,
        resolve,
        reject,
        timeoutId,
      });

      (async () => {
        try {
          // Dial peer
          const stream: any = await node.dialProtocol(peerId as any, PROTOCOL_CHAT);
          this.activeStreams.set(peerId, stream);

          // Send message
          const encoded = fromString(JSON.stringify(messageWithId), 'utf-8');
          await (stream as any).sink([encoded]);

          // Mark as sent (waiting for ack)
          if (this.onStatusUpdate) {
            this.onStatusUpdate(messageId, 'sent');
          }

          console.log('[Chat] Sent message to:', peerId);
        } catch (err) {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(messageId);
          if (this.onStatusUpdate) {
            this.onStatusUpdate(messageId, 'failed');
          }
          console.error('[Chat] Failed to send message:', err);
          reject(err);
        }
      })();
    });
  }

  async closeStream(peerId: string): Promise<void> {
    const stream = this.activeStreams.get(peerId);
    if (stream) {
      await stream.close();
      this.activeStreams.delete(peerId);
      console.log('[Chat] Closed stream with:', peerId);
    }
  }

  async closeAll(): Promise<void> {
    for (const [peerId, stream] of this.activeStreams.entries()) {
      await stream.close();
    }
    this.activeStreams.clear();
    console.log('[Chat] Closed all streams');
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
