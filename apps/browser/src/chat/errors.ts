export enum ChatErrorCode {
  TIMEOUT = 'TIMEOUT',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  MODEL_MISMATCH = 'MODEL_MISMATCH',
  NAT_UNREACHABLE = 'NAT_UNREACHABLE',
  CONNECTION_CLOSED = 'CONNECTION_CLOSED',
  RATE_LIMITED = 'RATE_LIMITED',
}

export interface ChatError extends Error {
  code: ChatErrorCode;
  peerId?: string;
  recoverable: boolean;
}

export function createChatError(
  code: ChatErrorCode,
  message: string,
  peerId?: string,
  recoverable: boolean = true
): ChatError {
  const error = new Error(message) as ChatError;
  error.code = code;
  error.peerId = peerId;
  error.recoverable = recoverable;
  return error;
}

export function isChatError(error: unknown): error is ChatError {
  return error instanceof Error && 'code' in error;
}

export const ERROR_MESSAGES: Record<ChatErrorCode, string> = {
  [ChatErrorCode.TIMEOUT]: 'Connection timed out',
  [ChatErrorCode.INVALID_SIGNATURE]: 'Message signature verification failed',
  [ChatErrorCode.MODEL_MISMATCH]: 'Peer using incompatible model version',
  [ChatErrorCode.NAT_UNREACHABLE]: 'Cannot establish direct connection, NAT traversal failed',
  [ChatErrorCode.CONNECTION_CLOSED]: 'Connection was closed unexpectedly',
  [ChatErrorCode.RATE_LIMITED]: 'Too many requests, please slow down',
};
