/**
 * Unified Error Handling Service
 * 
 * Provides consistent error handling across the application with:
 * - Typed error codes
 * - Error context tracking
 * - User-friendly messages
 * - Recovery guidance
 */

import { createLogger } from './logger.js';

export enum ErrorCode {
  // Network errors
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  DHT_CONNECTION_FAILED = 'DHT_CONNECTION_FAILED',
  
  // Authentication errors
  AUTH_NOT_INITIALIZED = 'AUTH_NOT_INITIALIZED',
  AUTH_INVALID_KEYPAIR = 'AUTH_INVALID_KEYPAIR',
  AUTH_SIGNATURE_FAILED = 'AUTH_SIGNATURE_FAILED',
  
  // Media errors
  MEDIA_PERMISSION_DENIED = 'MEDIA_PERMISSION_DENIED',
  MEDIA_DEVICE_NOT_FOUND = 'MEDIA_DEVICE_NOT_FOUND',
  MEDIA_DEVICE_IN_USE = 'MEDIA_DEVICE_IN_USE',
  MEDIA_CONSTRAINT_ERROR = 'MEDIA_CONSTRAINT_ERROR',
  
  // Data errors
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_INVALID = 'DATA_INVALID',
  DATA_QUOTA_EXCEEDED = 'DATA_QUOTA_EXCEEDED',
  
  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_REQUIRED = 'VALIDATION_REQUIRED',
  
  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  RATE_BLOCKED = 'RATE_BLOCKED',
  
  // Unknown
  UNKNOWN = 'UNKNOWN',
}

export interface ErrorContext {
  namespace: string;
  operation?: string;
  peerId?: string;
  channelID?: string;
  messageId?: string;
  showUserMessage?: boolean;
  recoverable?: boolean;
  [key: string]: unknown;
}

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public context?: Record<string, unknown>,
    public recoverable = true,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AppError';
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      recoverable: this.recoverable,
      stack: this.stack,
    };
  }
}

// User-friendly error messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // Network
  [ErrorCode.NETWORK_OFFLINE]: 'You\'re offline. Changes will sync when reconnected.',
  [ErrorCode.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.NETWORK_UNREACHABLE]: 'Cannot reach network. Check your connection.',
  [ErrorCode.DHT_CONNECTION_FAILED]: 'Failed to connect to peers.',
  
  // Auth
  [ErrorCode.AUTH_NOT_INITIALIZED]: 'Identity not initialized. Please refresh the page.',
  [ErrorCode.AUTH_INVALID_KEYPAIR]: 'Invalid identity. Please re-initialize.',
  [ErrorCode.AUTH_SIGNATURE_FAILED]: 'Signature verification failed.',
  
  // Media
  [ErrorCode.MEDIA_PERMISSION_DENIED]: 'Camera/microphone permission denied. Enable in browser settings.',
  [ErrorCode.MEDIA_DEVICE_NOT_FOUND]: 'No camera or microphone found.',
  [ErrorCode.MEDIA_DEVICE_IN_USE]: 'Camera/microphone is in use by another application.',
  [ErrorCode.MEDIA_CONSTRAINT_ERROR]: 'Device settings not supported.',
  
  // Data
  [ErrorCode.DATA_NOT_FOUND]: 'Requested data not found.',
  [ErrorCode.DATA_INVALID]: 'Invalid data format.',
  [ErrorCode.DATA_QUOTA_EXCEEDED]: 'Storage quota exceeded. Clear some data.',
  
  // Validation
  [ErrorCode.VALIDATION_FAILED]: 'Validation failed. Please check your input.',
  [ErrorCode.VALIDATION_REQUIRED]: 'Required field is missing.',
  
  // Rate limiting
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait.',
  [ErrorCode.RATE_BLOCKED]: 'Action blocked due to repeated violations.',
  
  // Unknown
  [ErrorCode.UNKNOWN]: 'An unexpected error occurred.',
};

export function getUserFriendlyMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN];
}

export function handleError(error: unknown, context: ErrorContext): never | void {
  const appError = error instanceof AppError ? error : createAppError(error, context);
  
  const log = createLogger(context.namespace);
  log.error(appError.message, appError, context);
  
  // Show user message if requested
  if (context.showUserMessage !== false) {
    const userMessage = getUserFriendlyMessage(appError.code);
    
    // Dispatch custom event for UI to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-error', {
        detail: {
          code: appError.code,
          message: userMessage,
          recoverable: appError.recoverable,
        },
      }));
    }
  }
  
  // Re-throw if not recoverable
  if (!appError.recoverable) {
    throw appError;
  }
}

export function createAppError(error: unknown, context: ErrorContext): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const nativeError = error instanceof Error ? error : new Error(String(error));
  
  // Map common error types to error codes
  let code = ErrorCode.UNKNOWN;
  let message = nativeError.message;
  let recoverable = true;

  // Network errors
  if (!navigator.onLine) {
    code = ErrorCode.NETWORK_OFFLINE;
    message = 'Network connection lost';
  } else if (nativeError.name === 'TimeoutError') {
    code = ErrorCode.NETWORK_TIMEOUT;
  } else if (nativeError.name === 'NetworkError') {
    code = ErrorCode.NETWORK_UNREACHABLE;
  }
  
  // Media errors
  else if (nativeError.name === 'NotAllowedError' || nativeError.name === 'PermissionDeniedError') {
    code = ErrorCode.MEDIA_PERMISSION_DENIED;
  } else if (nativeError.name === 'NotFoundError' || nativeError.name === 'DevicesNotFoundError') {
    code = ErrorCode.MEDIA_DEVICE_NOT_FOUND;
  } else if (nativeError.name === 'NotReadableError' || nativeError.name === 'TrackStartError') {
    code = ErrorCode.MEDIA_DEVICE_IN_USE;
  } else if (nativeError.name === 'OverconstrainedError') {
    code = ErrorCode.MEDIA_CONSTRAINT_ERROR;
  }
  
  // Storage errors
  else if (nativeError.name === 'QuotaExceededError') {
    code = ErrorCode.DATA_QUOTA_EXCEEDED;
    recoverable = false;
  }
  
  // Validation errors
  else if (nativeError.message.includes('required') || nativeError.message.includes('missing')) {
    code = ErrorCode.VALIDATION_REQUIRED;
  }
  
  // Rate limiting
  else if (nativeError.message.includes('rate limit')) {
    code = ErrorCode.RATE_LIMITED;
  } else if (nativeError.message.includes('blocked')) {
    code = ErrorCode.RATE_BLOCKED;
    recoverable = false;
  }

  return new AppError(
    message,
    code,
    context,
    recoverable,
    nativeError
  );
}

export function assert(condition: boolean, message: string, context: ErrorContext): asserts condition {
  if (!condition) {
    throw new AppError(message, ErrorCode.VALIDATION_FAILED, context, false);
  }
}

export function requireValue<T>(value: T | null | undefined, message: string, context: ErrorContext): T {
  if (value === null || value === undefined) {
    throw new AppError(message, ErrorCode.VALIDATION_REQUIRED, context, false);
  }
  return value;
}

// Error boundary helper
export function tryCatch<T>(
  fn: () => Promise<T>,
  context: ErrorContext,
  fallback?: T
): Promise<T | undefined> {
  return fn().catch((error) => {
    handleError(error, context);
    return fallback;
  });
}

// Async wrapper with automatic error handling
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: ErrorContext,
  options: {
    fallback?: T;
    rethrow?: boolean;
    showUserMessage?: boolean;
  } = {}
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    const errorContext = { ...context, showUserMessage: options.showUserMessage };
    const appError = error instanceof AppError ? error : createAppError(error, errorContext);
    
    if (options.rethrow !== false && !appError.recoverable) {
      throw appError;
    }
    
    if (options.fallback !== undefined) {
      return options.fallback;
    }
    
    return undefined;
  }
}
