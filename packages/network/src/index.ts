/**
 * ISC Network Library
 *
 * Core network functionality for peer discovery and communication.
 * Uses real transformer embeddings for semantic matching.
 *
 * @packageDocumentation
 */

// Types
export type {
  PeerInfo,
  PeerMatch,
  DHT,
  EmbeddingService,
  NetworkConfig,
  NetworkEvents,
  NetworkStats,
} from './types.js';

// DHT
export { InMemoryDHT, createDHT } from './dht.js';

// Embedding Service
export {
  TransformerEmbeddingService,
  createEmbeddingService,
  getEmbeddingService,
} from './embedding.js';

// Peer
export { VirtualPeer, createPeer, type PeerConfig, type PeerStats } from './peer.js';

// Storage - from @isc/adapters
export { createStorage, BrowserStorage, MemoryStorage, type StorageAdapter } from '@isc/adapters';

// Identity - from @isc/adapters
export {
  createIdentity,
  type Keypair,
  type IdentityData,
  type IdentityAdapter,
} from '@isc/adapters';

// Browser Network Service
export {
  BrowserNetworkService,
  createBrowserNetworkService,
  getBrowserNetworkService,
  type NetworkServiceConfig,
  type NetworkEvents as BrowserNetworkEvents,
  type NetworkStatus,
  type ChannelData,
  type PostData,
  type Identity,
} from './browser.js';

// Default config
export { DEFAULT_CONFIG } from './types.js';

// Tier negotiation (Phase P0)
export { registerTierNegotiation, getPeerTier } from './tier.js';
