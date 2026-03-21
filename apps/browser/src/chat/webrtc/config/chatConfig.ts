/**
 * WebRTC Chat Configuration
 */

import type { ChatConfig } from '../types/chat.js';

export const CHAT_CONFIG: ChatConfig = {
  messageTimeout: 10000,
  typingCooldown: 2000,
  typingTimeout: 3000,
  signatureKeyPrefix: 'isc-pubkey-',
  protocolChat: '/isc/chat/1.0.0',
} as const;

export const CHAT_CONSTANTS = {
  SIGNATURE_KEY_PREFIX: 'isc-pubkey-',
  PROTOCOL_CHAT: '/isc/chat/1.0.0',
  MESSAGE_TIMEOUT_MS: 10000,
  TYPING_COOLDOWN_MS: 2000,
  TYPING_TIMEOUT_MS: 3000,
} as const;
