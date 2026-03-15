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
export {
  VirtualPeer,
  createPeer,
  type PeerConfig,
  type PeerStats,
} from './peer.js';

// Default config
export { DEFAULT_CONFIG } from './types.js';
