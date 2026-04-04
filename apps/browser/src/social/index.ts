/**
 * Social Layer Module
 *
 * Exports all social functionality.
 */

// Types
export type {
  SignedPost,
  FollowSubscription,
  LikeEvent,
  RepostEvent,
  ReplyEvent,
  QuoteEvent,
  FeedItem,
  CommunityChannel,
  GroupDM,
  DMMessage,
  CommunityReport,
  CommunityCouncil,
  ProfileSummary,
  RankedPost,
  TrendingTopic,
  EngagementMetrics,
  AudioSpace,
  AudioMessage,
  Point2D,
  ConversationStarter,
  DiscussionTopic,
} from './types.js';

// Posts
export {
  createPost,
  getPost,
  getAllPosts,
  getPostsByChannel,
  getPostsByAuthor,
  verifyPost,
  deletePost,
  discoverPosts,
} from './posts.js';

// Feeds
export {
  getForYouFeed,
  getFollowingFeed,
  getExploreFeed,
  getChannelFeed,
  refreshFeed,
} from './feeds.js';

// Graph
export {
  followUser,
  unfollowUser,
  getFollowees,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
  computeReputation,
  getSuggestedFollows,
} from './graph.js';

// Interactions
export {
  likePost,
  unlikePost,
  getLikeCount,
  hasLiked,
  repostPost,
  replyToPost,
  getReplies,
  quotePost,
  getInteractionCounts,
} from './interactions.js';

// Moderation
export {
  muteUser,
  unmuteUser,
  getMutedUsers,
  blockUser,
  unblockUser,
  getBlockedUsers,
  isMuted,
  isBlocked,
  filterModeratedPosts,
  reportUser,
  getPendingReports,
  voteOnReport,
  createCouncil,
  getCouncil,
  getCouncilsForChannel,
  getMyCouncils,
} from './moderation.js';

// Direct Messages
export {
  sendDM,
  sendGroupMessage,
  createGroupDM,
  addGroupMember,
  removeGroupMember,
  leaveGroupDM,
  getDMs,
  getConversations,
  getGroupDMs,
  getGroupDM,
  decryptDM,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteDM,
} from './directMessages.js';

// Trending
export {
  calculateTrendingScore,
  getTrendingPosts,
  getTrendingPostsForChannel,
  getHotPosts,
  getTrendingTopics,
  getFollowingFeed as getTrendingFollowingFeed,
} from './trending.js';

// Communities
export {
  createCommunityChannel,
  joinCommunity,
  leaveCommunity,
  addCoEditor,
  updateCommunityChannel,
  getCommunity,
  getUserCommunities,
  queryCommunitiesByEmbedding,
  verifyCommunitySignature,
  computeSemanticNeighborhood,
} from './communities.js';

// Analytics
export {
  trackView,
  getMetrics,
  getAggregateMetrics,
  getTopPostsByEngagement,
  getTopPostsByViews,
  trackImpression,
  getCTR,
  getUserEngagementSummary,
  clearOldAnalytics,
  registerPost,
} from './analytics.js';

// Audio Spaces
export {
  createAudioSpace,
  joinAudioSpace,
  leaveAudioSpace,
  toggleMute,
  getAudioSpace,
  getAllActiveSpaces,
  handleAudioMessage,
} from './audioSpaces.js';

// Semantic Map
export {
  projectTo2D,
  computeChannelPositions,
  findNeighbors,
  kmeansClusters,
  renderSemanticMap,
} from './semanticMap.js';

// Thought Bridge
export {
  findCrossoverWords,
  generateConversationStarter,
  getConversationStarters,
  findBridgingPosts,
  suggestDiscussionTopics,
} from './thoughtBridge.js';
