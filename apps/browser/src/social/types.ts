/**
 * Social Layer Types
 * 
 * Defines the core data structures for posts, interactions, and social graph.
 * References: SOCIAL.md
 */

import type { Signature, PublicKey } from '@isc/core/crypto';

/**
 * Core post structure with cryptographic signature
 */
export interface SignedPost {
  type: 'post';
  postID: string;
  author: string; // peerID
  content: string;
  channelID: string;
  embedding: number[];
  timestamp: number;
  ttl: number;
  signature: Signature;
}

/**
 * Payload for creating a post (before signing)
 */
export interface PostPayload {
  type: 'post';
  postID: string;
  author: string;
  content: string;
  channelID: string;
  embedding: number[];
  timestamp: number;
  ttl: number;
}

/**
 * Post with additional metadata from feed ranking
 */
export interface RankedPost extends SignedPost {
  similarityScore?: number;
  engagementScore?: number;
  matchedChannel?: string;
}

/**
 * Like event for post interactions
 */
export interface LikeEvent {
  type: 'like';
  reactor: string; // peerID
  targetPostID: string;
  timestamp: number;
  signature: Signature;
}

/**
 * Repost event - re-announce with reposter's semantic distribution
 */
export interface RepostEvent {
  type: 'repost';
  reactor: string;
  targetPostID: string;
  channelID: string;
  embedding: number[]; // Reposter's channel embedding
  timestamp: number;
  signature: Signature;
}

/**
 * Reply event for threaded conversations
 */
export interface ReplyEvent {
  type: 'reply';
  reactor: string;
  targetPostID: string;
  content: string;
  embedding: number[];
  timestamp: number;
  signature: Signature;
}

/**
 * Quote event - embed original + commentary as fused vector
 */
export interface QuoteEvent {
  type: 'quote';
  reactor: string;
  targetPostID: string;
  originalContent: string;
  commentary: string;
  fusedEmbedding: number[];
  timestamp: number;
  signature: Signature;
}

/**
 * Follow event for social graph
 */
export interface FollowEvent {
  type: 'follow' | 'unfollow';
  follower: string;
  followee: string;
  timestamp: number;
  signature: Signature;
}

/**
 * Local follow subscription (stored in IndexedDB)
 */
export interface FollowSubscription {
  followee: string; // peerID
  channelID?: string; // Optional: follow specific channel
  since: number;
}

/**
 * User profile aggregated from channels
 */
export interface Profile {
  peerID: string;
  bio?: string;
  bioEmbedding?: number[]; // Computed: mean(channelEmbeddings)
  channels: ChannelSummary[];
  followerCount: number;
  followingCount: number;
  joinedAt: number;
  signature?: Signature;
}

/**
 * Channel summary for profile display
 */
export interface ChannelSummary {
  channelID: string;
  name: string;
  description: string;
  embedding: number[];
  postCount: number;
  latestEmbedding: number[];
}

/**
 * Community report for content moderation
 */
export interface CommunityReport {
  reporter: string;
  targetPostID: string;
  reason: 'off-topic' | 'spam' | 'harassment';
  evidence: string;
  signature: Signature;
}

/**
 * Reputation score for peer trust
 */
export interface ReputationScore {
  peerID: string;
  score: number; // 0.0 - 1.0
  mutualFollows: number;
  interactionHistory: Interaction[];
  halfLifeDays: number; // 30-day decay
}

/**
 * Generic interaction for reputation tracking
 */
export interface Interaction {
  type: 'like' | 'repost' | 'reply' | 'quote' | 'follow';
  peerID: string;
  timestamp: number;
  weight: number;
}

/**
 * Feed type enumeration
 */
export type FeedType = 'forYou' | 'following' | 'explore' | 'channel';

/**
 * Feed query parameters
 */
export interface FeedQuery {
  type: FeedType;
  channelID?: string;
  limit?: number;
  since?: number;
  excludeAuthors?: string[];
}
