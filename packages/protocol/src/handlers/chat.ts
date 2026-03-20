import type { Stream } from '../interfaces/network.js';
import type { ChatMessage } from '../messages.js';
import { PROTOCOL_CHAT } from '../constants.js';

export interface ChatHandlerConfig {
  getSigningKey: () => Promise<CryptoKeyPair>;
  verifyMessage: (msg: ChatMessage, publicKey: Uint8Array) => Promise<boolean>;
  onMessage: (msg: ChatMessage, peerId: string) => void;
  getSecurityTier?: () => number;
  messageTimeout?: number;
}

export interface ChatError {
  code: 'TIMEOUT' | 'INVALID_SIGNATURE' | 'MODEL_MISMATCH' | 'NAT_UNREACHABLE';
  message: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function* encodeJson(data: unknown): AsyncGenerator<Uint8Array> {
  yield encoder.encode(JSON.stringify(data));
}

async function* decodeJsonStream<T>(source: AsyncIterable<Uint8Array>): AsyncGenerator<T> {
  for await (const chunk of source) {
    yield JSON.parse(decoder.decode(chunk)) as T;
  }
}

export class ChatHandler {
  private keepaliveTimers = new Map<string, number>();

  constructor(private config: ChatHandlerConfig) {
    this.config = { messageTimeout: 30000, ...config };
  }

  async handleStream(stream: Stream, peerId: string): Promise<void> {
    try {
      this.startKeepalive(peerId, stream);

      for await (const message of decodeJsonStream<ChatMessage>(stream.source)) {
        if (!(await this.validateMessage(message))) {
          await this.sendError(stream, {
            code: 'INVALID_SIGNATURE',
            message: 'Message signature verification failed',
          });
          continue;
        }

        this.config.onMessage(message, peerId);

        const ack = { type: 'ack', timestamp: message.timestamp, receivedAt: Date.now() };
        await stream.sink(encodeJson(ack));
      }
    } catch (error) {
      if (this.isTimeoutError(error)) {
        await this.sendError(stream, { code: 'TIMEOUT', message: 'Stream timed out' });
      }
      console.error('Chat stream error:', error);
    } finally {
      this.stopKeepalive(peerId);
    }
  }

  async initiateChat(
    dial: (peerId: string, protocol: string) => Promise<Stream>,
    peerId: string,
    channelId: string,
    message: string
  ): Promise<Stream> {
    const keypair = await this.config.getSigningKey();
    const timestamp = Date.now();
    const payload = JSON.stringify({ channelID: channelId, msg: message, timestamp });
    const signature = await globalThis.crypto.subtle.sign(
      { name: 'Ed25519' },
      keypair.privateKey,
      encoder.encode(payload)
    );

    const chatMessage: ChatMessage = {
      channelID: channelId,
      msg: message,
      timestamp,
      tier: (this.config.getSecurityTier?.() ?? 2) as 0 | 1 | 2,
      signature: new Uint8Array(signature),
    };

    const stream = await dial(peerId, PROTOCOL_CHAT);
    await stream.sink(encodeJson(chatMessage));

    return stream;
  }

  private async validateMessage(message: ChatMessage): Promise<boolean> {
    if (!message.signature) return false;
    try {
      const payload = JSON.stringify({
        channelID: message.channelID,
        msg: message.msg,
        timestamp: message.timestamp,
      });
      const peerIdBytes = this.derivePublicKeyFromPeerId(message.signature);
      const publicKey = await globalThis.crypto.subtle.importKey(
        'raw',
        peerIdBytes.buffer as ArrayBuffer,
        { name: 'Ed25519' },
        true,
        ['verify']
      );

      return await globalThis.crypto.subtle.verify(
        { name: 'Ed25519' },
        publicKey,
        message.signature.buffer as ArrayBuffer,
        encoder.encode(payload)
      );
    } catch {
      return false;
    }
  }

  private async sendError(stream: Stream, error: ChatError): Promise<void> {
    await stream.sink(encodeJson({ type: 'error', ...error }));
  }

  private startKeepalive(peerId: string, stream: Stream): void {
    const interval = setInterval(async () => {
      try {
        await stream.sink(encodeJson({ type: 'ping' }));
      } catch {
        this.stopKeepalive(peerId);
      }
    }, 30000);

    this.keepaliveTimers.set(peerId, interval as unknown as number);
  }

  private stopKeepalive(peerId: string): void {
    const timer = this.keepaliveTimers.get(peerId);
    if (timer) {
      clearInterval(timer);
      this.keepaliveTimers.delete(peerId);
    }
  }

  private isTimeoutError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('timeout');
  }

  private derivePublicKeyFromPeerId(signature: Uint8Array): Uint8Array {
    return signature.slice(0, 32);
  }
}
