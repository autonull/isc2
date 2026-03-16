/**
 * ISC Social Layer
 *
 * Environment-agnostic social protocol implementation.
 * Provides posts, feeds, follows, and reputation system.
 */

// Types
export * from './types.js';

// Posts
export {
  createPost,
  verifyPost,
  verifyPosts,
  discoverPosts,
  deletePost,
  PostService,
  type PostStorage,
  type IdentityProvider,
  type PostNetwork,
} from './posts.js';

// Feeds
export {
  getForYouFeed,
  getFollowingFeed,
  getExploreFeed,
  getChannelFeed,
  getTrendingPosts,
  getSimilarPosts,
  FeedService,
  type FeedProvider,
} from './feeds.js';

// Graph (follows & reputation)
export {
  followUser,
  unfollowUser,
  getFollowees,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
  recordInteraction,
  getInteractionHistory,
  applyDecay,
  computeReputation,
  computeTrustScore,
  getSuggestedFollows,
  getInteractionBasedSuggestions,
  getAllFollowSuggestions,
  GraphService,
  type GraphStorage,
  type GraphIdentity,
  type GraphNetwork,
  type FollowSuggestion,
} from './graph.js';

// Community reports
export {
  createCommunityReport,
  validateReportReason,
  calculateReportStats,
  type CreateReportOptions,
  type ReportReason,
  type ReportStats,
} from './reports.js';

// Scoring utilities
export {
  computeEngagementScore,
  computeContentRelevance,
  type EngagementMetrics,
} from './scoring.js';

// Post coherence (from isc1)
export {
  checkPostCoherence,
  checkPostCoherenceMultiChannel,
  getMostCoherentChannel,
  filterCoherentPosts,
  rankByCoherence,
  DEFAULT_COHERENCE_THRESHOLD,
  type CoherenceResult,
} from './coherence.js';

// Re-export ChannelDistribution from channels
export type { ChannelDistribution } from '../channels/manager.js';

// Version
export const SOCIAL_VERSION = '1.0.0';
