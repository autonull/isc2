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
