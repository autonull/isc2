/**
 * Social Layer Type Definitions
 */

import type { Signature } from '@isc/core';
import type { Channel } from '@isc/core';

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
  lshHash?: string; // For semantic discovery
  embedding?: number[]; // For semantic matching
}

/**
 * Follow subscription
 */
export interface FollowSubscription {
  followee: string;
  since: number;
}

/**
 * Like event
 */
export interface LikeEvent {
  id: string;
  liker: string;
  postID: string;
  timestamp: number;
  signature: Signature;
}

/**
 * Repost event
 */
export interface RepostEvent {
  id: string;
  reposter: string;
  postID: string;
  timestamp: number;
  signature: Signature;
}

/**
 * Reply event
 */
export interface ReplyEvent {
  id: string;
  parentID: string;
  author: string;
  content: string;
  channelID: string;
  timestamp: number;
  signature: Signature;
}

/**
 * Quote event (repost with comment)
 */
export interface QuoteEvent {
  id: string;
  quoter: string;
  postID: string;
  content: string;
  channelID: string;
  timestamp: number;
  signature: Signature;
}

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
  threshold: number; // Minimum votes for action
  jurisdiction: string[]; // Channel IDs or '*'
  reputationThreshold: number; // Minimum reputation for council membership
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
 * Audio space state
 */
export interface AudioSpace {
  spaceID: string;
  channelID: string;
  creator: string;
  participants: string[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  createdAt: number;
}

/**
 * Audio message for signaling
 */
export interface AudioMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  spaceID: string;
  sender: string;
  data: unknown;
  timestamp: number;
}

/**
 * 2D point for visualization
 */
export interface Point2D {
  x: number;
  y: number;
  data: unknown;
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
  channels: any[]; // Array of Channel objects
  similarity: number;
}
