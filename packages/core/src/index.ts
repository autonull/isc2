/**
 * @isc/core - Environment-agnostic core functionality for ISC
 *
 * This package provides:
 * - Mathematical functions (cosine similarity, LSH, sampling)
 * - Semantic matching (relational matching, spatiotemporal)
 * - Cryptographic primitives (keypair, sign, verify)
 * - Encoding utilities (CBOR-like binary encoding)
 * - Type definitions
 * - Interoperability (AT Protocol, data portability)
 * - Configuration management
 * - Error handling utilities
 * - Reputation system (Phase 2)
 * - Stake signaling (Phase 2.2)
 */

// Configuration
export { Config } from './config.js';
export * from './config/features.js';

// Error handling
export {
  AppError,
  ErrorCodes,
  safeAsync,
  tryAsync,
  logAndRethrow,
  logAndDefault,
  isRecoverable,
  getErrorCode,
  createError,
  withErrorHandling,
} from './errors.js';

// Validators
export {
  Validators,
  isDefined,
  isNonEmptyArray,
  isValidNumber,
  assert,
  requireValue,
} from './validators.js';

// Mathematical functions
export * from './math/index.js';

// Semantic matching
export * from './semantic/index.js';

// Cryptographic primitives
export * from './crypto/index.js';

// Encoding utilities
export * from './encoding.js';

// Type definitions
export * from './types.js';

// Reputation system (Phase 2)
export * from './reputation/index.js';

// Stake signaling (Phase 2.2)
export * from './stake/index.js';

// Moderation courts (Phase 2.3)
export * from './moderation/index.js';

// Hierarchical DHT (Phase 2.4)
export * from './dht/index.js';

// Interoperability (Phase 9)
export * from './interop/index.js';

// Social layer
export * from './social/index.js';

// Channel management
export * from './channels/index.js';

// Peer-aware rate limiting (from isc1)
export * from './peerRateLimiter.js';
