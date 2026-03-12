/**
 * Real WebRTC Chat Handler
 * 
 * No mocks - actual P2P chat via libp2p
 */

import type { Libp2p } from 'libp2p';
import { fromString, toString } from 'uint8arrays';

const PROTOCOL_CHAT = '/isc/chat/1.0';

export interface ChatMessage {
  channelID: string;
  msg: string;
  timestamp: number;
  sender: string;
}

export interface ChatHandler {
  handleStream(stream: any): Promise<void>;
}

export class RealChatHandler implements ChatHandler {
  private onMessage?: (msg: ChatMessage) => void;
  private activeStreams: Map<string, any> = new Map();

  setOnMessage(callback: (msg: ChatMessage) => void): void {
    this.onMessage = callback;
  }

  async handleStream(stream: any): Promise<void> {
    console.log('[Chat] Incoming stream');

    try {
      // Read messages from stream
      for await (const chunk of stream.source as AsyncIterable<Uint8Array>) {
        try {
          const msg: ChatMessage = JSON.parse(toString(chunk, 'utf-8'));
          console.log('[Chat] Received:', msg);
          
          if (this.onMessage) {
            this.onMessage(msg);
          }

          // Send acknowledgment
          const ack = { ack: msg.timestamp };
          await stream.sink([fromString(JSON.stringify(ack))]);
        } catch (err) {
          console.error('[Chat] Failed to parse message:', err);
        }
      }
    } catch (err) {
      console.error('[Chat] Stream error:', err);
    }
  }

  async sendMessage(peerId: string, message: ChatMessage, node: Libp2p): Promise<void> {
    try {
      // Dial peer
      const stream: any = await node.dialProtocol(peerId as any, PROTOCOL_CHAT);
      this.activeStreams.set(peerId, stream);

      // Send message
      const encoded = fromString(JSON.stringify(message), 'utf-8');
      await stream.sink([encoded]);

      console.log('[Chat] Sent message to:', peerId);
    } catch (err) {
      console.error('[Chat] Failed to send message:', err);
      throw err;
    }
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
