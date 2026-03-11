/**
 * Social Layer
 * 
 * Public API for social network functionality.
 */

// Types
export type {
  SignedPost,
  PostPayload,
  RankedPost,
  LikeEvent,
  RepostEvent,
  ReplyEvent,
  QuoteEvent,
  FollowEvent,
  FollowSubscription,
  Profile,
  ChannelSummary,
  CommunityReport,
  ReputationScore,
  Interaction,
  FeedType,
  FeedQuery,
} from './types';

// Posts
export {
  createPost,
  announcePost,
  queryPostsByEmbedding,
  getPostsByAuthor,
  verifyPost,
  isPostValid,
} from './posts';

// Feeds
export {
  getForYouFeed,
  getFollowingFeed,
  getExploreFeed,
  getChannelFeed,
  getFeed,
} from './feeds';

// Interactions
export {
  likePost,
  repostPost,
  replyToPost,
  quotePost,
  computeEngagementScore,
  getReplies,
  getLikeCount,
  getRepostCount,
} from './interactions';

// Social Graph
export {
  followPeer,
  unfollowPeer,
  getFollowingList,
  getFollowSubscriptions,
  isFollowing,
  getSuggestedFollows,
  getProfile,
  computeReputation,
  applyChaosMode,
} from './graph';

// Moderation
export {
  checkPostCoherence,
  filterIncoherentPosts,
  submitReport,
  getReports,
  shouldHidePost,
  getModerationScore,
  getMutedPeers,
  mutePeer,
  unmutePeer,
  filterMutedPosts,
} from './moderation';
