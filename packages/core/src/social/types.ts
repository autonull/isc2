/* eslint-disable */
/**
 * Social Layer Type Definitions
 *
 * Environment-agnostic types for ISC social protocol.
 */

import type { Signature } from '../crypto/index.js';
import type { Channel } from '../types.js';

/**
 * Signed post with author signature
 */
export interface SignedPost {
  id: string;
  author: string;
  content: string;
  channelID: string;
  timestamp: number;
  signature: Signature;
  lshHash?: string;
  embedding?: number[];
}

/**
 * Follow subscription
 */
export interface FollowSubscription {
  followee: string;
  since: number;
}

// Note: LikeEvent, RepostEvent, ReplyEvent, QuoteEvent are imported from ../index.js

/**
 * Community channel with shared editing
 */
export interface CommunityChannel {
  channelID: string;
  name: string;
  description: string;
  members: string[];
  coEditors: string[];
  embedding: number[];
  createdAt: number;
  updatedAt: number;
  signature: Signature;
}

/**
 * Group DM
 */
export interface GroupDM {
  groupID: string;
  members: string[];
  creator: string;
  createdAt: number;
}

/**
 * DM message
 */
export interface DMMessage {
  id: string;
  groupID: string;
  sender: string;
  content: string;
  timestamp: number;
  encrypted: Uint8Array;
}

/**
 * Community report
 */
export interface CommunityReport {
  id: string;
  reporter: string;
  reported: string;
  reason: string;
  evidence: string[];
  timestamp: number;
  signature: Signature;
}

/**
 * Vote on a report
 */
export interface Vote {
  id: string;
  reportId: string;
  voter: string;
  decision: 'guilty' | 'not_guilty';
  timestamp: number;
  signature: Signature;
}

/**
 * Community council
 */
export interface CommunityCouncil {
  id: string;
  name: string;
  members: string[];
  threshold: number;
  jurisdiction: string[];
  reputationThreshold: number;
  signature?: Signature;
}

/**
 * Profile summary
 */
export interface ProfileSummary {
  peerID: string;
  bio?: string;
  channelCount: number;
  followerCount: number;
  followingCount: number;
  updatedAt: number;
}

/**
 * Feed item (unified type for feed rendering)
 */
export interface FeedItem {
  type: 'post' | 'repost' | 'reply' | 'quote';
  id: string;
  author: string;
  content: string;
  timestamp: number;
  likes: number;
  reposts: number;
  replies: number;
  channelID: string;
  parentID?: string;
  originalPostID?: string;
}

/**
 * Ranked post with trending score
 */
export interface RankedPost extends SignedPost {
  trendingScore: number;
  engagementCount: number;
  similarityScore?: number;
  matchedChannel?: string;
}

/**
 * Trending topic summary
 */
export interface TrendingTopic {
  preview: string;
  postCount: number;
  totalEngagement: number;
  postID: string;
  channelID: string;
}

/**
 * Engagement metrics for a post
 */
export interface EngagementMetrics {
  postId: string;
  views: number;
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  lastUpdated: number;
}

/**
 * Conversation starter
 */
export interface ConversationStarter {
  id: string;
  starter: string;
  post1: SignedPost;
  post2: SignedPost;
  similarity: number;
}

/**
 * Discussion topic
 */
export interface DiscussionTopic {
  id: string;
  title: string;
  description: string;
  channels: Channel[];
  similarity: number;
}

/**
 * Follow suggestion for discovery
 */
export interface FollowSuggestion {
  peerID: string;
  score: number;
  mutualFollows: number;
  reason: string;
}
