/**
 * ISC Channel Management
 *
 * Environment-agnostic channel lifecycle and distribution management.
 */

export {
  ChannelManager,
  createChannelManager,
  createDefaultStorage,
  createDefaultEmbedding,
  MAX_ACTIVE_CHANNELS,
  MAX_RELATIONS,
  type ChannelStorage,
  type EmbeddingProvider,
  type ChannelNetwork,
  type ChannelManagerConfig,
  type ChannelDistribution,
} from './manager.js';
