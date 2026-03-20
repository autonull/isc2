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
    }: { recoverable?: boolean; context?: string; cause?: unknown } = {}
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

export const ErrorCodes = {
  IDENTITY_REQUIRED: 'IDENTITY_REQUIRED',
  IDENTITY_NOT_FOUND: 'IDENTITY_NOT_FOUND',
  KEYPAIR_INVALID: 'KEYPAIR_INVALID',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  PEER_NOT_FOUND: 'PEER_NOT_FOUND',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  DELEGATION_FAILED: 'DELEGATION_FAILED',
  SUPERNOSE_UNAVAILABLE: 'SUPERNOSE_UNAVAILABLE',
  QUEUE_FULL: 'QUEUE_FULL',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SHAMIR_INVALID: 'SHAMIR_INVALID',
  STORAGE_FULL: 'STORAGE_FULL',
  STORAGE_CORRUPTED: 'STORAGE_CORRUPTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE: 'DUPLICATE',
  RATE_LIMITED: 'RATE_LIMITED',
  TIER_MISMATCH: 'TIER_MISMATCH',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  RLN_QUOTA_EXCEEDED: 'RLN_QUOTA_EXCEEDED',
  MODEL_NOT_IN_REGISTRY: 'MODEL_NOT_IN_REGISTRY',
  VOUCH_TIMEOUT: 'VOUCH_TIMEOUT',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export async function safeAsync<T>(fn: () => Promise<T>, fallback?: T): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

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

export function logAndRethrow(context: string): (error: unknown) => never {
  return (error) => {
    console.error(`[${context}]`, error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(error instanceof Error ? error.message : String(error), ErrorCodes.UNKNOWN, {
      context,
      cause: error,
    });
  };
}

export function logAndDefault<T>(context: string, defaultValue: T): (error: unknown) => T {
  return (error) => {
    console.error(`[${context}]`, error);
    return defaultValue;
  };
}

export function isRecoverable(error: unknown): boolean {
  return error instanceof AppError ? error.recoverable : true;
}

export function getErrorCode(error: unknown, defaultCode = ErrorCodes.UNKNOWN): string {
  return error instanceof AppError ? error.code : defaultCode;
}

export function createError(
  code: keyof typeof ErrorCodes,
  message: string,
  options?: { recoverable?: boolean; context?: string; cause?: unknown }
): AppError {
  return new AppError(message, ErrorCodes[code], options);
}

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
              {
                context,
                cause: error,
              }
            );

      onError?.(appError);
      throw appError;
    }
  };
}
