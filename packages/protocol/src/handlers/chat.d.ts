import type { Stream } from '../interfaces/network.js';
import type { ChatMessage } from '../messages.js';
export interface ChatHandlerConfig {
    getSigningKey: () => Promise<CryptoKeyPair>;
    verifyMessage: (msg: ChatMessage, publicKey: Uint8Array) => Promise<boolean>;
    onMessage: (msg: ChatMessage, peerId: string) => void;
    messageTimeout?: number;
}
export interface ChatError {
    code: 'TIMEOUT' | 'INVALID_SIGNATURE' | 'MODEL_MISMATCH' | 'NAT_UNREACHABLE';
    message: string;
}
export declare class ChatHandler {
    private config;
    private keepaliveTimers;
    constructor(config: ChatHandlerConfig);
    handleStream(stream: Stream, peerId: string): Promise<void>;
    initiateChat(dial: (peerId: string, protocol: string) => Promise<Stream>, peerId: string, channelId: string, message: string): Promise<Stream>;
    private validateMessage;
    private sendError;
    private startKeepalive;
    private stopKeepalive;
    private isTimeoutError;
    private derivePublicKeyFromPeerId;
}
//# sourceMappingURL=chat.d.ts.map