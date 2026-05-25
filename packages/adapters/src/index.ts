/* eslint-disable */
/**
 * @isc/adapters - Platform Adapters
 *
 * Universal interfaces and implementations for storage, identity, and network.
 */

// Interfaces
export type { StorageAdapter } from './storage.js';
export type { IdentityAdapter, Keypair, IdentityData } from './identity.js';
export type { NetworkAdapter, Stream } from './interfaces/network.js';
export type { EmbeddingModelAdapter } from './interfaces/model.js';
export type { TierDetector, Tier, DeviceCapabilities } from './interfaces/tier.js';

// Storage implementations
export { BrowserStorage, NodeStorage, MemoryStorage, createStorage } from './storage.js';

// Identity implementations
export { BrowserIdentity, NodeIdentity, createIdentity } from './identity.js';

// Shared utilities
export { wordHash, hammingDistance } from './shared/wordHash.js';
export { LocalNetworkMedium, LocalNetworkAdapter } from './shared/localNetwork.js';
export {
  dbTransaction,
  dbGet,
  dbGetAll,
  dbPut,
  dbDelete,
  dbClear,
  dbKeys,
  dbAdd,
  dbCount,
  dbFilter,
  openDB,
  createStoreIfNotExists,
} from './shared/db.js';

// Browser exports
export { BrowserModel } from './browser/model.js';
export { BrowserTierDetector } from './browser/tier.js';
export { BrowserNetworkAdapter } from './browser/network.js';
export { DHTClient } from './browser/dht.js';
