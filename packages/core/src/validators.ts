/**
 * Centralized Type Guards and Validators
 *
 * Reusable validation logic for common types and patterns.
 */

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
  /**
   * Validate keypair is present
   * @throws AppError with code IDENTITY_REQUIRED
   */
  keypair: (kp?: Keypair | null): asserts kp is Keypair => {
    if (!kp) {
      throw new AppError('Identity not initialized', ErrorCodes.IDENTITY_REQUIRED);
    }
  },

  /**
   * Validate delegation health object
   */
  health: (h: unknown): h is ValidDelegationHealth => {
    if (!h || typeof h !== 'object') return false;
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

  /**
   * Validate Shamir secret sharing configuration
   * @throws AppError with code SHAMIR_INVALID
   */
  shamirConfig: (threshold: number, total: number): void => {
    if (threshold > total) {
      throw new AppError(
        'Threshold exceeds total shares',
        ErrorCodes.SHAMIR_INVALID,
        { recoverable: false }
      );
    }
    if (threshold < 1) {
      throw new AppError('Threshold must be >= 1', ErrorCodes.SHAMIR_INVALID, {
        recoverable: false,
      });
    }
  },

  /**
   * Validate peer ID format
   */
  peerID: (peerID: unknown): peerID is string => {
    return typeof peerID === 'string' && peerID.length > 0;
  },

  /**
   * Validate Uint8Array is not empty
   */
  nonEmptyBytes: (data: unknown): data is Uint8Array => {
    return data instanceof Uint8Array && data.length > 0;
  },

  /**
   * Validate number is in range
   */
  inRange: (value: number, min: number, max: number): boolean => {
    return typeof value === 'number' && value >= min && value <= max;
  },

  /**
   * Validate success rate (0-1)
   */
  successRate: (rate: unknown): rate is number => {
    return typeof rate === 'number' && rate >= 0 && rate <= 1;
  },

  /**
   * Validate array has minimum length
   */
  minLength: <T>(arr: unknown, min: number): arr is T[] => {
    return Array.isArray(arr) && arr.length >= min;
  },

  /**
   * Validate string is not empty
   */
  nonEmptyString: (str: unknown): str is string => {
    return typeof str === 'string' && str.length > 0;
  },

  /**
   * Validate object has required properties
   */
  hasProps: <T extends object>(obj: unknown, props: (keyof T)[]): obj is T => {
    if (!obj || typeof obj !== 'object') return false;
    return props.every((prop) => prop in obj);
  },
};

/**
 * Type guard for non-null values
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for non-empty arrays
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Type guard for valid numbers
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Assert condition or throw error
 */
export function assert(condition: boolean, message: string, code?: string): asserts condition {
  if (!condition) {
    throw new AppError(message, code ?? ErrorCodes.VALIDATION_FAILED);
  }
}

/**
 * Require value or throw error
 */
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
