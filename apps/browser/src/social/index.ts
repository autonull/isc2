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

// Phase 5: Advanced Features
// Communities
export type { CommunityChannel, CommunityChannelPayload } from './communities';
export {
  createCommunityChannel,
  joinCommunity,
  leaveCommunity,
  addCoEditor,
  updateCommunityChannel,
  getCommunity,
  getUserCommunities,
  queryCommunitiesByEmbedding,
  verifyCommunity,
  computeSemanticNeighborhood,
} from './communities';

// Audio Spaces
export type { AudioSpace, AudioMessage } from './audioSpaces';
export {
  createAudioSpace,
  joinAudioSpace,
  leaveAudioSpace,
  toggleMute,
  getAudioSpace,
  getAllActiveSpaces,
  handleAudioMessage,
} from './audioSpaces';

// Direct Messages
export type { DirectMessage, DMPayload, GroupDM } from './directMessages';
export {
  sendDM,
  sendGroupDM,
  createGroupDM,
  addGroupMember,
  removeGroupMember,
  decryptDM,
  getConversation,
  getConversations,
  markAsRead,
  getMyGroupDMs,
} from './directMessages';

// Trending
export type { TrendingTopic } from './trending';
export {
  computeTrendingScore,
  getTrendingPosts,
  getTrendingTopics,
  getExploreFeed,
  getGlobalExplore,
} from './trending';

// Semantic Map
export type { Point2D } from './semanticMap';
export {
  projectTo2D,
  computeChannelPositions,
  findNeighbors,
  kmeansClusters,
  renderSemanticMap,
} from './semanticMap';

// Thought Bridge
export type { ConversationStarter, DiscussionTopic } from './thoughtBridge';
export {
  findCrossoverWords,
  generateConversationStarter,
  getConversationStarters,
  findBridgingPosts,
  suggestDiscussionTopics,
} from './thoughtBridge';
