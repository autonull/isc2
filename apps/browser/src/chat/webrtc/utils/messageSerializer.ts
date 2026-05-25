/* eslint-disable */
/**
 * Message Serializer Utilities
 *
 * Handles message encoding/decoding for WebRTC transport.
 */

import { fromString, toString } from 'uint8arrays';
import type { ChatMessage, TypingIndicator } from '../types/chat.ts';

/**
 * Encode message to Uint8Array
 */
export function encodeMessage(message: ChatMessage | { type: string } & Partial<TypingIndicator>): Uint8Array {
  return fromString(JSON.stringify(message), 'utf-8');
}

/**
 * Decode message from Uint8Array
 */
export function decodeMessage<T>(data: Uint8Array): T {
  return JSON.parse(toString(data, 'utf-8')) as T;
}

/**
 * Encode acknowledgment
 */
export function encodeAck(timestamp: number): Uint8Array {
  return fromString(JSON.stringify({ ack: timestamp }), 'utf-8');
}

/**
 * Decode acknowledgment
 */
export function decodeAck(data: Uint8Array): number | null {
  const parsed = JSON.parse(toString(data, 'utf-8'));
  return parsed.ack ?? null;
}

/**
 * Check if message is typing indicator
 */
export function isTypingIndicator(data: any): data is { type: 'typing' } & TypingIndicator {
  return data.type === 'typing';
}

/**
 * Check if message is acknowledgment
 */
export function isAcknowledgment(data: any): data is { ack: number } {
  return typeof data.ack === 'number';
}
