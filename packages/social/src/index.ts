/**
 * @isc/social - Social layer for ISC
 *
 * Provides posts, feeds, chat, discovery, channels, and moderation.
 * Business logic is environment-agnostic — adapters are injected.
 */

// Types
export * from './types.js';

// Adapters
export * from './adapters/index.js';

// Posts
export {
  createPostService,
  verifyPost,
  verifyPosts,
  type PostService,
  type CreatePostInput,
} from './posts.js';

// Feeds
export {
  createFeedService,
  type FeedService,
  type TrendingPost,
} from './feeds.js';

// Trending
export {
  calculateTrendingScore,
  scorePost,
  filterAndRankPosts,
  diversifyByChannel,
  applyChaosFactor,
  extractTrendingTopics,
  filterRecentPosts,
  type RankedPost,
  type TrendingTopic,
  type TrendingConfig,
  DEFAULT_TRENDING_CONFIG,
} from './trending.js';

// Graph
export {
  createGraphService,
  type GraphService,
  type ReputationResult,
  type TrustScore,
  type FollowSuggestion,
  type BridgeProfile,
} from './graph.js';

// Interactions
export {
  createInteractionService,
  type InteractionService,
  type LikeEvent,
  type RepostEvent,
  type ReplyEvent,
  type QuoteEvent,
  type InteractionCounts,
} from './interactions.js';

// Communities
export {
  createCommunityService,
  type CommunityService,
  COMMUNITY_CONFIG,
  COMMUNITY_DHT_PREFIXES,
} from './communities.js';

// Chat
export {
  createChatService,
  type ChatService,
} from './chat.js';

// Discovery
export {
  createDiscoveryService,
  type DiscoveryService,
  type DiscoveryOptions,
} from './discovery.js';

// Channels
export {
  createChannelService,
  type ChannelService,
  type CreateChannelInput,
} from './channels.js';

// Moderation (block list + courts)
export * from './moderation/index.js';

// Version
export const SOCIAL_VERSION = '1.0.0';
