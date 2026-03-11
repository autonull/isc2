/**
 * Network Module
 *
 * NAT traversal, relay management, and connection quality.
 */

export {
  NATTraversalManager,
  createNATTraversalManager,
  calculateConnectionQuality,
} from './relay.js';

export type {
  RelayCandidate,
  TURNConfig,
  STUNConfig,
  ConnectionQuality,
  NATTraversalConfig,
} from './relay.js';
