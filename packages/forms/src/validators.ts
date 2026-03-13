/**
 * Built-in Validators
 *
 * Common validation functions.
 */

import type { Validator, ISCDomainValidators } from './types.js';

/**
 * Required validator
 */
export function required<T>(): Validator<T | null | undefined> {
  return {
    validate: (value) => ({
      valid: value !== null && value !== undefined && value !== '',
      error: 'This field is required',
    }),
  };
}

/**
 * Minimum length validator
 */
export function minLength(min: number): Validator<string> {
  return {
    validate: (value) => ({
      valid: value.length >= min,
      error: `Minimum ${min} characters required`,
    }),
  };
}

/**
 * Maximum length validator
 */
export function maxLength(max: number): Validator<string> {
  return {
    validate: (value) => ({
      valid: value.length <= max,
      error: `Maximum ${max} characters allowed`,
    }),
  };
}

/**
 * Pattern validator
 */
export function pattern(regex: RegExp, message: string): Validator<string> {
  return {
    validate: (value) => ({
      valid: regex.test(value),
      error: message,
    }),
  };
}

/**
 * Email validator
 */
export function email(): Validator<string> {
  return {
    validate: (value) => ({
      valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      error: 'Invalid email address',
    }),
  };
}

/**
 * Number validator
 */
export function number(): Validator<string> {
  return {
    validate: (value) => ({
      valid: !isNaN(Number(value)) && value !== '',
      error: 'Must be a number',
    }),
  };
}

/**
 * Minimum value validator
 */
export function minValue(min: number): Validator<number> {
  return {
    validate: (value) => ({
      valid: value >= min,
      error: `Minimum value is ${min}`,
    }),
  };
}

/**
 * Maximum value validator
 */
export function maxValue(max: number): Validator<number> {
  return {
    validate: (value) => ({
      valid: value <= max,
      error: `Maximum value is ${max}`,
    }),
  };
}

/**
 * Range validator
 */
export function range(min: number, max: number): Validator<number> {
  return {
    validate: (value) => ({
      valid: value >= min && value <= max,
      error: `Value must be between ${min} and ${max}`,
    }),
  };
}

/**
 * Custom validator
 */
export function custom<T>(
  fn: (value: T) => boolean,
  message: string
): Validator<T> {
  return {
    validate: (value) => ({
      valid: fn(value),
      error: message,
    }),
  };
}

/**
 * One of validator
 */
export function oneOf<T>(values: T[], message: string): Validator<T> {
  return {
    validate: (value) => ({
      valid: values.includes(value),
      error: message,
    }),
  };
}

/**
 * Not one of validator
 */
export function notOneOf<T>(values: T[], message: string): Validator<T> {
  return {
    validate: (value) => ({
      valid: !values.includes(value),
      error: message,
    }),
  };
}

/**
 * ISC Domain-Specific Validators
 */
export const iscValidators: ISCDomainValidators = {
  /**
   * Channel name validator
   * 3-30 characters, letters, numbers, spaces, hyphens only
   */
  channelName: (): Validator<string> => ({
    validate: (value) => ({
      valid: /^[a-zA-Z0-9\s_-]{3,30}$/.test(value),
      error: '3-30 characters, letters, numbers, spaces, hyphens only',
    }),
  }),

  /**
   * Channel description validator
   * 10-500 characters
   */
  channelDescription: (): Validator<string> => ({
    validate: (value) => ({
      valid: value.length >= 10 && value.length <= 500,
      error: 'Description must be 10-500 characters',
    }),
  }),

  /**
   * Peer ID validator
   * At least 20 characters, word characters and hyphens
   */
  peerId: (): Validator<string> => ({
    validate: (value) => ({
      valid: /^[\w-]{20,}$/.test(value),
      error: 'Invalid peer ID format',
    }),
  }),

  /**
   * Channel spread validator
   * Between 0 and 0.3
   */
  channelSpread: (): Validator<number> => ({
    validate: (value) => ({
      valid: value >= 0 && value <= 0.3,
      error: 'Spread must be between 0 and 0.3',
    }),
  }),

  /**
   * Relation tag validator
   * Lowercase with underscores
   */
  relationTag: (): Validator<string> => ({
    validate: (value) => ({
      valid: /^[a-z][a-z0-9_]{2,29}$/.test(value),
      error: 'Lowercase letters, numbers, underscores, 3-30 characters',
    }),
  }),

  /**
   * Relation weight validator
   * Between 0.1 and 10
   */
  relationWeight: (): Validator<number> => ({
    validate: (value) => ({
      valid: value >= 0.1 && value <= 10,
      error: 'Weight must be between 0.1 and 10',
    }),
  }),
};

/**
 * Compose multiple validators
 */
export function compose<T>(validators: Validator<T>[]): Validator<T> {
  return {
    validate: (value, context) => {
      for (const validator of validators) {
        const result = validator.validate(value, context);
        if (!result.valid) {
          return result;
        }
      }
      return { valid: true };
    },
  };
}
