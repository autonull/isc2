import { PROTOCOL_CHAT } from '../constants.js';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export class ChatHandler {
    config;
    keepaliveTimers = new Map();
    constructor(config) {
        this.config = {
            messageTimeout: 30000,
            ...config,
        };
    }
    async handleStream(stream, peerId) {
        try {
            this.startKeepalive(peerId, stream);
            for await (const chunk of stream.source) {
                const data = decoder.decode(chunk);
                const message = JSON.parse(data);
                const isValid = await this.validateMessage(message);
                if (!isValid) {
                    const error = {
                        code: 'INVALID_SIGNATURE',
                        message: 'Message signature verification failed',
                    };
                    await this.sendError(stream, error);
                    continue;
                }
                this.config.onMessage(message, peerId);
                const ack = {
                    type: 'ack',
                    timestamp: message.timestamp,
                    receivedAt: Date.now(),
                };
                await stream.sink({
                    [Symbol.asyncIterator]: async function* () {
                        yield encoder.encode(JSON.stringify(ack));
                    },
                });
            }
        }
        catch (error) {
            if (this.isTimeoutError(error)) {
                const chatError = {
                    code: 'TIMEOUT',
                    message: 'Stream timed out',
                };
                await this.sendError(stream, chatError);
            }
            console.error('Chat stream error:', error);
        }
        finally {
            this.stopKeepalive(peerId);
        }
    }
    async initiateChat(dial, peerId, channelId, message) {
        const keypair = await this.config.getSigningKey();
        const timestamp = Date.now();
        const payload = JSON.stringify({ channelID: channelId, msg: message, timestamp });
        const signature = await globalThis.crypto.subtle.sign({ name: 'Ed25519' }, keypair.privateKey, encoder.encode(payload));
        const chatMessage = {
            channelID: channelId,
            msg: message,
            timestamp,
            signature: new Uint8Array(signature),
        };
        const stream = await dial(peerId, PROTOCOL_CHAT);
        await stream.sink({
            [Symbol.asyncIterator]: async function* () {
                yield encoder.encode(JSON.stringify(chatMessage));
            },
        });
        return stream;
    }
    async validateMessage(message) {
        try {
            const payload = JSON.stringify({
                channelID: message.channelID,
                msg: message.msg,
                timestamp: message.timestamp,
            });
            const peerIdBytes = this.derivePublicKeyFromPeerId(message.signature);
            const publicKey = await globalThis.crypto.subtle.importKey('raw', peerIdBytes.buffer, { name: 'Ed25519' }, true, ['verify']);
            return await globalThis.crypto.subtle.verify({ name: 'Ed25519' }, publicKey, message.signature.buffer, encoder.encode(payload));
        }
        catch {
            return false;
        }
    }
    async sendError(stream, error) {
        await stream.sink({
            [Symbol.asyncIterator]: async function* () {
                yield encoder.encode(JSON.stringify({ type: 'error', ...error }));
            },
        });
    }
    startKeepalive(peerId, stream) {
        const interval = setInterval(async () => {
            try {
                await stream.sink({
                    [Symbol.asyncIterator]: async function* () {
                        yield encoder.encode(JSON.stringify({ type: 'ping' }));
                    },
                });
            }
            catch {
                this.stopKeepalive(peerId);
            }
        }, 30000);
        this.keepaliveTimers.set(peerId, interval);
    }
    stopKeepalive(peerId) {
        const timer = this.keepaliveTimers.get(peerId);
        if (timer) {
            clearInterval(timer);
            this.keepaliveTimers.delete(peerId);
        }
    }
    isTimeoutError(error) {
        return error instanceof Error && error.message.includes('timeout');
    }
    derivePublicKeyFromPeerId(signature) {
        return signature.slice(0, 32);
    }
}
//# sourceMappingURL=chat.js.map