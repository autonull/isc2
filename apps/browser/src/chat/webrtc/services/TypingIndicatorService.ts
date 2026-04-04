/* eslint-disable */
/**
 * Typing Indicator Service
 *
 * Manages typing indicator state with debouncing and timeouts.
 */

import type { Libp2p } from 'libp2p';
import { fromString } from 'uint8arrays';
import type { TypingIndicator } from '../types/chat.ts';
import { CHAT_CONFIG } from '../config/chatConfig.ts';

interface TypingCallbacks {
  onTyping?: (indicator: TypingIndicator) => void;
}

export class TypingIndicatorService {
  private callbacks: TypingCallbacks;
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private lastTypingSent: Map<string, number> = new Map();

  constructor(callbacks: TypingCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Send typing indicator with debouncing
   */
  send(peerId: string, channelID: string, node: Libp2p): void {
    const now = Date.now();
    const lastSent = this.lastTypingSent.get(peerId) || 0;

    if (now - lastSent < CHAT_CONFIG.typingCooldown) {
      return;
    }

    this.lastTypingSent.set(peerId, now);

    const indicator: TypingIndicator = {
      channelID,
      timestamp: now,
      sender: 'me',
    };

    this.sendIndicator(peerId, indicator, node);
  }

  /**
   * Send typing indicator (fire and forget)
   */
  private async sendIndicator(
    peerId: string,
    indicator: TypingIndicator,
    node: Libp2p
  ): Promise<void> {
    try {
      const stream: any = await node.dialProtocol(peerId as any, CHAT_CONFIG.protocolChat);
      const encoded = fromString(JSON.stringify({ type: 'typing', ...indicator }), 'utf-8');
      await stream.sink([encoded]);
    } catch (err) {
      // Ignore errors for typing indicators
    }
  }

  /**
   * Handle incoming typing indicator
   */
  handleIncoming(indicator: TypingIndicator): void {
    const key = indicator.sender;

    if (this.typingTimeouts.has(key)) {
      clearTimeout(this.typingTimeouts.get(key));
    }

    this.typingTimeouts.set(
      key,
      setTimeout(() => {
        this.typingTimeouts.delete(key);
        if (this.callbacks.onTyping) {
          this.callbacks.onTyping({ ...indicator, timestamp: 0 });
        }
      }, CHAT_CONFIG.typingTimeout)
    );

    if (this.callbacks.onTyping) {
      this.callbacks.onTyping(indicator);
    }
  }

  /**
   * Clear typing indicator for peer
   */
  clear(peerId: string): void {
    const timeout = this.typingTimeouts.get(peerId);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(peerId);
    }
  }

  /**
   * Clear all typing indicators
   */
  clearAll(): void {
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.typingTimeouts.clear();
    this.lastTypingSent.clear();
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: TypingCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}
