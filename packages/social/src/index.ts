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

// Moderation
export {
  createModerationService,
  type ModerationService,
} from './moderation.js';

// Version
export const SOCIAL_VERSION = '1.0.0';
