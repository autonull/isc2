/**
 * Centralized Error Handling
 *
 * Consistent error types and handling utilities across the application.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly recoverable: boolean;
  public readonly context?: string;
  public readonly cause?: unknown;

  constructor(
    message: string,
    code: string,
    {
      recoverable = true,
      context,
      cause,
    }: {
      recoverable?: boolean;
      context?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.recoverable = recoverable;
    this.context = context;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      context: this.context,
    };
  }
}

/**
 * Error codes for common application errors
 */
export const ErrorCodes = {
  // Identity errors
  IDENTITY_REQUIRED: 'IDENTITY_REQUIRED',
  IDENTITY_NOT_FOUND: 'IDENTITY_NOT_FOUND',
  KEYPAIR_INVALID: 'KEYPAIR_INVALID',

  // Network errors
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  PEER_NOT_FOUND: 'PEER_NOT_FOUND',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',

  // Delegation errors
  DELEGATION_FAILED: 'DELEGATION_FAILED',
  SUPERNOSE_UNAVAILABLE: 'SUPERNOSE_UNAVAILABLE',
  QUEUE_FULL: 'QUEUE_FULL',

  // Validation errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SHAMIR_INVALID: 'SHAMIR_INVALID',

  // Storage errors
  STORAGE_FULL: 'STORAGE_FULL',
  STORAGE_CORRUPTED: 'STORAGE_CORRUPTED',

  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE: 'DUPLICATE',
  RATE_LIMITED: 'RATE_LIMITED',

  // Internal errors
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * Safely execute an async function, returning fallback on error
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/**
 * Safely execute an async function with explicit error handling
 */
export async function tryAsync<T>(
  fn: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    onError?.(error);
    return null;
  }
}

/**
 * Create an error handler that logs and rethrows
 */
export function logAndRethrow(context: string): (error: unknown) => never {
  return (error) => {
    console.error(`[${context}]`, error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error instanceof Error ? error.message : String(error),
      ErrorCodes.UNKNOWN,
      { context, cause: error }
    );
  };
}

/**
 * Create an error handler that logs and returns a default value
 */
export function logAndDefault<T>(context: string, defaultValue: T): (error: unknown) => T {
  return (error) => {
    console.error(`[${context}]`, error);
    return defaultValue;
  };
}

/**
 * Check if an error is recoverable
 */
export function isRecoverable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.recoverable;
  }
  return true;
}

/**
 * Get error code from an error
 */
export function getErrorCode(error: unknown, defaultCode: string = ErrorCodes.UNKNOWN): string {
  if (error instanceof AppError) {
    return error.code;
  }
  return defaultCode;
}

/**
 * Create a specific error type for common scenarios
 */
export function createError(
  code: keyof typeof ErrorCodes,
  message: string,
  options?: { recoverable?: boolean; context?: string; cause?: unknown }
): AppError {
  return new AppError(message, ErrorCodes[code], options);
}

/**
 * Wrap a function to automatically handle errors
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
  onError?: (error: AppError) => void
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              error instanceof Error ? error.message : String(error),
              ErrorCodes.UNKNOWN,
              { context, cause: error }
            );

      onError?.(appError);
      throw appError;
    }
  };
}
