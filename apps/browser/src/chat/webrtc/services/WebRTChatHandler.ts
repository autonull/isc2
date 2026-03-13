/**
 * WebRTC Chat Handler
 *
 * Coordinates message sending, receiving, typing indicators, and stream management.
 */

import type { Libp2p } from 'libp2p';
import type { ChatMessage, TypingIndicator, MessageStatus } from '../types/chat.js';
import { MessageQueue } from '../models/MessageQueue.js';
import { MessageSender } from '../services/MessageSender.js';
import { MessageReceiver } from '../services/MessageReceiver.js';
import { TypingIndicatorService } from '../services/TypingIndicatorService.js';
import { StreamManager } from '../services/StreamManager.js';

interface ChatCallbacks {
  onMessage?: (msg: ChatMessage) => void;
  onStatusUpdate?: (messageId: number, status: MessageStatus) => void;
  onTyping?: (indicator: TypingIndicator) => void;
}

export class WebRTChatHandler {
  private queue: MessageQueue;
  private sender: MessageSender;
  private receiver: MessageReceiver;
  private typingService: TypingIndicatorService;
  private streamManager: StreamManager;
  private callbacks: ChatCallbacks;
  private registeredNode: Libp2p | null = null;

  constructor() {
    this.queue = new MessageQueue();
    this.callbacks = {};

    this.receiver = new MessageReceiver({
      onMessage: (msg) => this.callbacks.onMessage?.(msg),
      onStatusUpdate: (id, status) => this.callbacks.onStatusUpdate?.(id, status),
      onTyping: (indicator) => this.callbacks.onTyping?.(indicator),
    });

    this.typingService = new TypingIndicatorService({
      onTyping: (indicator) => this.callbacks.onTyping?.(indicator),
    });

    this.sender = new MessageSender(this.queue);
    this.streamManager = new StreamManager();
  }

  /**
   * Set message callback
   */
  setOnMessage(callback: (msg: ChatMessage) => void): void {
    this.callbacks.onMessage = callback;
  }

  /**
   * Set status update callback
   */
  setOnStatusUpdate(callback: (messageId: number, status: MessageStatus) => void): void {
    this.callbacks.onStatusUpdate = callback;
  }

  /**
   * Set typing callback
   */
  setOnTyping(callback: (indicator: TypingIndicator) => void): void {
    this.callbacks.onTyping = callback;
  }

  /**
   * Register with libp2p node
   */
  registerWithNode(node: Libp2p): void {
    this.registeredNode = node;
    this.streamManager.registerHandler(node, (stream) => this.handleStream(stream));
  }

  /**
   * Check if registered with node
   */
  isRegistered(): boolean {
    return this.registeredNode !== null;
  }

  /**
   * Handle incoming stream
   */
  async handleStream(stream: any): Promise<void> {
    await this.receiver.handleStream(stream);
  }

  /**
   * Send message
   */
  async sendMessage(peerId: string, message: ChatMessage, node: Libp2p): Promise<void> {
    return this.sender.send(peerId, message, node, this.callbacks.onStatusUpdate);
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(peerId: string, channelID: string, node: Libp2p): void {
    this.typingService.send(peerId, channelID, node);
  }

  /**
   * Handle incoming typing indicator
   */
  handleTypingIndicator(indicator: TypingIndicator): void {
    this.typingService.handleIncoming(indicator);
  }

  /**
   * Close stream for peer
   */
  async closeStream(peerId: string): Promise<void> {
    await this.streamManager.closeStream(peerId);
  }

  /**
   * Close all streams
   */
  async closeAll(): Promise<void> {
    await this.streamManager.closeAll();
    this.typingService.clearAll();
    this.queue.clear();
  }

  /**
   * Get active stream count
   */
  getActiveStreamCount(): number {
    return this.streamManager.getActiveCount();
  }

  /**
   * Clear public key cache
   */
  clearKeyCache(): void {
    this.receiver.clearKeyCache();
  }
}
