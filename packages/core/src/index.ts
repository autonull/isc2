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
 */

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

// Interoperability (Phase 9)
export * from './interop/index.js';
