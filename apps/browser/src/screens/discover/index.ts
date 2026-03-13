/**
 * Discover Module
 *
 * Peer discovery and matching based on semantic similarity.
 */

export { DiscoverScreen } from './DiscoverScreen.js';

// Services
export { MatchService } from './services/MatchService.js';
export { PeerDiscoveryService } from './services/PeerDiscoveryService.js';

// Hooks
export { usePeerDiscovery } from './hooks/usePeerDiscovery.js';
export { usePeerFiltering } from './hooks/usePeerFiltering.js';
export { useMatchScoring } from './hooks/useMatchScoring.js';

// Components
export { PeerCard } from './components/PeerCard.js';
export { PeerList } from './components/PeerList.js';
export { FilterBar } from './components/FilterBar.js';
export { MatchIndicator } from './components/MatchIndicator.js';
export { EmptyState } from './components/EmptyState.js';

// Config
export {
  DISCOVER_CONFIG,
  SIMILARITY_THRESHOLDS,
  PROXIMITY_LABELS,
} from './config/discoverConfig.js';

// Types
export type {
  Match,
  QueryCacheEntry,
  PeerInfo,
  ProximityLevel,
  MatchGroup,
} from './types/discover.js';
