/* eslint-disable */
/**
 * Network Module
 *
 * NAT traversal, relay management, and connection quality.
 */

export {
  NATTraversalManager,
  createNATTraversalManager,
  calculateConnectionQuality,
} from './relay.ts';

export type {
  RelayCandidate,
  TURNConfig,
  STUNConfig,
  ConnectionQuality,
  NATTraversalConfig,
} from './relay.ts';
