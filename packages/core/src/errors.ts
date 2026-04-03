/**
 * @isc/core - Error handling
 */

export const ErrorCodes = {
  UNKNOWN: 'UNKNOWN_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NETWORK: 'NETWORK_ERROR',
  INTERNAL: 'INTERNAL_ERROR',
} as const;

export class AppError extends Error {
  constructor(message: string, public code: string = ErrorCodes.UNKNOWN) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.NETWORK);
    this.name = 'NetworkError';
  }
}

export class ChannelError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.VALIDATION);
    this.name = 'ChannelError';
  }
}

export class MessageError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.VALIDATION);
    this.name = 'MessageError';
  }
}

export class IdentityError extends AppError {
  constructor(message: string) {
    super(message, ErrorCodes.UNAUTHORIZED);
    this.name = 'IdentityError';
  }
}

export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  return ErrorCodes.UNKNOWN;
}

export function createError(message: string, code?: string): AppError {
  return new AppError(message, code);
}

export async function withErrorHandling<T>(
  promise: Promise<T>,
  defaultMessage = 'An unexpected error occurred'
): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error instanceof Error ? error.message : defaultMessage,
      ErrorCodes.INTERNAL
    );
  }
}
export function isRecoverable(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.code === ErrorCodes.NETWORK || error.code === ErrorCodes.UNKNOWN;
  }
  return false;
}
export function logAndDefault<T>(error: unknown, defaultValue: T): T {
  console.warn('[Error]', error);
  return defaultValue;
}
export function logAndRethrow(error: unknown): never {
  console.error('[Fatal Error]', error);
  throw error;
}
export async function safeAsync<T>(promise: Promise<T>): Promise<[T | null, unknown]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error];
  }
}
export function safeSync<T>(fn: () => T): [T | null, unknown] {
  try {
    return [fn(), null];
  } catch (error) {
    return [null, error];
  }
}
export async function tryAsync<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}
export function trySync<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
