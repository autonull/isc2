/**
 * Unit Tests for Encoding and Validators
 */

import { describe, it, expect } from 'vitest';
import { encode, decode } from '../src/encoding.js';
import {
  Validators,
  isDefined,
  isNonEmptyArray,
  isValidNumber,
  assert,
  requireValue,
} from '../src/validators.js';
import { AppError, ErrorCodes, safeAsync, tryAsync } from '../src/errors.js';

describe('Encoding', () => {
  describe('encode & decode', () => {
    it('should encode and decode simple objects', () => {
      const obj = { name: 'test', value: 42 };
      const encoded = encode(obj);
      const decoded = decode(encoded);
      expect(decoded).toEqual(obj);
    });

    it('should encode and decode nested objects', () => {
      const obj = {
        user: {
          name: 'Alice',
          profile: {
            age: 30,
            active: true,
          },
        },
      };
      const encoded = encode(obj);
      const decoded = decode(encoded);
      expect(decoded).toEqual(obj);
    });

    it('should encode and decode arrays', () => {
      const arr = [1, 2, 3, 'four', { five: 5 }];
      const encoded = encode(arr);
      const decoded = decode(encoded);
      expect(decoded).toEqual(arr);
    });

    it('should encode and decode Uint8Array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const obj = { binary: data };
      const encoded = encode(obj);
      const decoded = decode(encoded);
      expect(decoded.binary).toBeInstanceOf(Uint8Array);
      expect(Array.from(decoded.binary)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should encode and decode null values', () => {
      const obj = { value: null };
      const encoded = encode(obj);
      const decoded = decode(encoded);
      expect(decoded.value).toBeNull();
    });

    it('should encode and decode undefined values', () => {
      const obj = { value: undefined };
      const encoded = encode(obj);
      const decoded = decode(encoded);
      expect(decoded.value).toBeUndefined();
    });

    it('should handle empty objects', () => {
      const obj = {};
      const encoded = encode(obj);
      const decoded = decode(encoded);
      expect(decoded).toEqual({});
    });

    it('should handle empty arrays', () => {
      const arr: any[] = [];
      const encoded = encode(arr);
      const decoded = decode(encoded);
      expect(decoded).toEqual([]);
    });
  });
});

describe('Validators', () => {
  describe('isDefined', () => {
    it('should return true for defined values', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(null)).toBe(true);
      expect(isDefined(false)).toBe(true);
      expect(isDefined({})).toBe(true);
      expect(isDefined([])).toBe(true);
    });

    it('should return false for undefined', () => {
      expect(isDefined(undefined)).toBe(false);
    });
  });

  describe('isNonEmptyArray', () => {
    it('should return true for non-empty arrays', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray(['a'])).toBe(true);
    });

    it('should return false for empty arrays', () => {
      expect(isNonEmptyArray([])).toBe(false);
    });

    it('should return false for non-arrays', () => {
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray(undefined)).toBe(false);
      expect(isNonEmptyArray('string')).toBe(false);
      expect(isNonEmptyArray(123)).toBe(false);
      expect(isNonEmptyArray({})).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(1.5)).toBe(true);
      expect(isValidNumber(-10)).toBe(true);
      expect(isValidNumber(Number.MAX_VALUE)).toBe(true);
      expect(isValidNumber(Number.MIN_VALUE)).toBe(true);
    });

    it('should return false for invalid numbers', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
      expect(isValidNumber('123')).toBe(false);
      expect(isValidNumber(true)).toBe(false);
    });
  });

  describe('assert', () => {
    it('should not throw for true conditions', () => {
      expect(() => assert(true, 'message')).not.toThrow();
    });

    it('should throw for false conditions', () => {
      expect(() => assert(false, 'error message')).toThrow('error message');
    });
  });

  describe('requireValue', () => {
    it('should return value for defined values', () => {
      expect(requireValue(0, 'value')).toBe(0);
      expect(requireValue('', 'value')).toBe('');
      expect(requireValue(null, 'value')).toBe(null);
      expect(requireValue(false, 'value')).toBe(false);
    });

    it('should throw for undefined', () => {
      expect(() => requireValue(undefined, 'value')).toThrow('value is required');
    });
  });

  describe('Validators.keypair', () => {
    it('should not throw for valid keypair', () => {
      const keypair = {
        publicKey: new Uint8Array([1, 2, 3]),
        privateKey: new Uint8Array([4, 5, 6]),
      };
      expect(() => Validators.keypair(keypair)).not.toThrow();
    });

    it('should throw for missing publicKey', () => {
      const keypair = { privateKey: new Uint8Array([4, 5, 6]) };
      expect(() => Validators.keypair(keypair as any)).toThrow();
    });

    it('should throw for missing privateKey', () => {
      const keypair = { publicKey: new Uint8Array([1, 2, 3]) };
      expect(() => Validators.keypair(keypair as any)).toThrow();
    });

    it('should throw for null keypair', () => {
      expect(() => Validators.keypair(null)).toThrow();
    });
  });
});

describe('Error Handling', () => {
  describe('AppError', () => {
    it('should create error with code and message', () => {
      const error = new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid input');
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
    });

    it('should include cause in error', () => {
      const cause = new Error('root cause');
      const error = new AppError(ErrorCodes.NETWORK_ERROR, 'Failed', cause);
      expect(error.cause).toBe(cause);
    });
  });

  describe('safeAsync', () => {
    it('should return result for successful operations', async () => {
      const result = await safeAsync(Promise.resolve(42));
      expect(result).toEqual({ success: true, data: 42 });
    });

    it('should return error for failed operations', async () => {
      const result = await safeAsync(Promise.reject(new Error('failed')));
      expect(result).toEqual({
        success: false,
        error: expect.any(Error),
      });
    });
  });

  describe('tryAsync', () => {
    it('should return tuple with error first', async () => {
      const [error, data] = await tryAsync(Promise.resolve(42));
      expect(error).toBeNull();
      expect(data).toBe(42);
    });

    it('should return error for failed operations', async () => {
      const [error, data] = await tryAsync(Promise.reject(new Error('failed')));
      expect(error).toBeInstanceOf(Error);
      expect(data).toBeUndefined();
    });
  });

  describe('createError', () => {
    it('should create error with code and message', () => {
      const error = createError(ErrorCodes.VALIDATION_ERROR, 'Test error');
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.message).toBe('Test error');
    });
  });

  describe('withErrorHandling', () => {
    it('should handle errors in async function', async () => {
      const fn = withErrorHandling(
        async () => {
          throw new Error('test error');
        },
        ErrorCodes.NETWORK_ERROR,
        'Operation failed'
      );

      await expect(fn()).rejects.toThrow('Operation failed');
    });

    it('should return result for successful function', async () => {
      const fn = withErrorHandling(
        async () => 42,
        ErrorCodes.NETWORK_ERROR,
        'Operation failed'
      );

      const result = await fn();
      expect(result).toBe(42);
    });
  });
});
