/* eslint-disable */
import { AppError, ErrorCodes } from './errors.js';
import type { Keypair } from './crypto/keypair.js';

export interface DelegationHealth {
  type: 'delegation_health';
  peerID: string;
  signature: Uint8Array;
  successRate: number;
  avgLatencyMs: number;
  requestsServed24h: number;
  timestamp: number;
}

export interface ValidDelegationHealth extends DelegationHealth {
  successRate: number;
}

export const Validators = {
  keypair: (kp?: Keypair | null): asserts kp is Keypair => {
    if (!kp) {
      throw new AppError('Identity not initialized', ErrorCodes.IDENTITY_REQUIRED);
    }
  },

  health: (h: unknown): h is ValidDelegationHealth => {
    if (!h || typeof h !== 'object') {return false;}
    const health = h as Partial<DelegationHealth>;
    return (
      health.type === 'delegation_health' &&
      typeof health.peerID === 'string' &&
      health.peerID.length > 0 &&
      health.signature instanceof Uint8Array &&
      typeof health.successRate === 'number' &&
      health.successRate >= 0 &&
      health.successRate <= 1
    );
  },

  shamirConfig: (threshold: number, total: number): void => {
    if (threshold > total) {
      throw new AppError('Threshold exceeds total shares', ErrorCodes.SHAMIR_INVALID, {
        recoverable: false,
      });
    }
    if (threshold < 1) {
      throw new AppError('Threshold must be >= 1', ErrorCodes.SHAMIR_INVALID, {
        recoverable: false,
      });
    }
  },

  peerID: (peerID: unknown): peerID is string =>
    typeof peerID === 'string' && peerID.length > 0,

  nonEmptyBytes: (data: unknown): data is Uint8Array =>
    data instanceof Uint8Array && data.length > 0,

  inRange: (value: number, min: number, max: number): boolean =>
    typeof value === 'number' && value >= min && value <= max,

  successRate: (rate: unknown): rate is number =>
    typeof rate === 'number' && rate >= 0 && rate <= 1,

  minLength: <T>(arr: unknown, min: number): arr is T[] =>
    Array.isArray(arr) && arr.length >= min,

  nonEmptyString: (str: unknown): str is string =>
    typeof str === 'string' && str.length > 0,

  hasProps: <T extends object>(obj: unknown, props: (keyof T)[]): obj is T => {
    if (!obj || typeof obj !== 'object') {return false;}
    return props.every((prop) => prop in obj);
  },
};

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export function assert(condition: boolean, message: string, code?: string): asserts condition {
  if (!condition) {
    throw new AppError(message, code ?? ErrorCodes.VALIDATION_FAILED);
  }
}

export function requireValue<T>(
  value: T | null | undefined,
  message: string,
  code?: string
): T {
  if (value === null || value === undefined) {
    throw new AppError(message, code ?? ErrorCodes.NOT_FOUND);
  }
  return value;
}
