/**
 * Stream Manager Service
 *
 * Manages WebRTC stream lifecycle.
 */

import type { Libp2p } from 'libp2p';
import type { Stream } from '@libp2p/interface';
import { CHAT_CONFIG } from '../config/chatConfig.js';

export class StreamManager {
  private activeStreams: Map<string, Stream> = new Map();

  /**
   * Get or create stream for peer
   */
  async getStream(peerId: string, node: Libp2p): Promise<Stream> {
    const existing = this.activeStreams.get(peerId);
    if (existing) {
      return existing;
    }

    const stream = await node.dialProtocol(peerId as any, CHAT_CONFIG.protocolChat);
    this.activeStreams.set(peerId, stream);
    return stream;
  }

  /**
   * Close stream for peer
   */
  async closeStream(peerId: string): Promise<void> {
    const stream = this.activeStreams.get(peerId);
    if (stream) {
      await stream.close();
      this.activeStreams.delete(peerId);
    }
  }

  /**
   * Close all streams
   */
  async closeAll(): Promise<void> {
    for (const [peerId, stream] of this.activeStreams.entries()) {
      await stream.close();
    }
    this.activeStreams.clear();
  }

  /**
   * Get active stream count
   */
  getActiveCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Check if stream exists for peer
   */
  hasStream(peerId: string): boolean {
    return this.activeStreams.has(peerId);
  }

  /**
   * Register stream handler
   */
  registerHandler(node: Libp2p, handler: (stream: Stream) => Promise<void>): void {
    node.handle(CHAT_CONFIG.protocolChat, (event: any) => handler(event.stream));
  }

  /**
   * Clear all streams without closing
   */
  clear(): void {
    this.activeStreams.clear();
  }
}
