import type { NetworkAdapter } from '@isc/adapters';

export interface ChatMessage {
  channelID: string;
  senderID: string;
  msg: string;
  timestamp: number;
  signature: Uint8Array;
}

export interface ChatConfig {
  network: NetworkAdapter;
  getSigningKey: () => Promise<CryptoKeyPair>;
  getPeerId: () => string;
  onMessage?: (message: ChatMessage) => void;
}

const PROTOCOL_CHAT = '/isc/chat/1.0.0';

export class ChatHandler {
  private config: ChatConfig;
  private activeStreams = new Map<string, any>();

  constructor(config: ChatConfig) {
    this.config = config;
  }

  async initiateChat(peerId: string, channelId: string): Promise<void> {
    try {
      const stream = await this.config.network.dial(peerId, PROTOCOL_CHAT);
      this.activeStreams.set(peerId, stream);

      const greeting = await this.createMessage(channelId, 'Hello!');
      await this.sendMessage(peerId, greeting);
    } catch (error) {
      console.error(`Failed to initiate chat with ${peerId}:`, error);
      throw error;
    }
  }

  async sendMessage(peerId: string, message: ChatMessage): Promise<void> {
    const stream = this.activeStreams.get(peerId);
    if (!stream) throw new Error(`No active stream with ${peerId}`);

    const encoder = new TextEncoder();
    await stream.sink([encoder.encode(JSON.stringify(message))]);
  }

  private async createMessage(channelId: string, msg: string): Promise<ChatMessage> {
    const keypair = await this.config.getSigningKey();
    const timestamp = Date.now();
    const payload = JSON.stringify({ channelID: channelId, msg, timestamp });

    const signature = await crypto.subtle.sign(
      { name: 'Ed25519' },
      keypair.privateKey,
      new TextEncoder().encode(payload)
    );

    return {
      channelID: channelId,
      senderID: this.config.getPeerId(),
      msg,
      timestamp,
      signature: new Uint8Array(signature),
    };
  }

  async verifyMessage(message: ChatMessage): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        channelID: message.channelID,
        msg: message.msg,
        timestamp: message.timestamp,
      });

      const keyData = new Uint8Array(32);
      keyData.set(
        message.senderID
          .slice(0, 32)
          .split('')
          .map((c) => c.charCodeAt(0))
      );

      const key = await crypto.subtle.importKey(
        'raw',
        keyData.buffer as ArrayBuffer,
        { name: 'Ed25519' },
        true,
        ['verify']
      );

      return crypto.subtle.verify(
        { name: 'Ed25519' },
        key,
        message.signature.buffer as ArrayBuffer,
        new TextEncoder().encode(payload)
      );
    } catch {
      return false;
    }
  }

  closePeer(peerId: string): void {
    const stream = this.activeStreams.get(peerId);
    if (stream) {
      stream.close();
      this.activeStreams.delete(peerId);
    }
  }

  closeAll(): void {
    for (const peerId of this.activeStreams.keys()) {
      this.closePeer(peerId);
    }
  }
}
