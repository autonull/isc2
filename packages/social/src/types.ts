/**
 * Social Layer Types
 *
 * Shared type definitions for posts, messages, conversations, and peers.
 */

/**
 * Signed post with cryptographic signature
 */
export interface SignedPost {
  id: string;
  author: string;
  content: string;
  channelID: string;
  timestamp: number;
  signature: Uint8Array;
  likes?: string[];
  replies?: string[];
  replyTo?: string;
}

/**
 * Post with computed score for feed ranking
 */
export interface ScoredPost extends SignedPost {
  score: number;
}

/**
 * Direct message
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: number;
  read: boolean;
}

/**
 * Conversation with a peer
 */
export interface Conversation {
  id: string;
  peerId: string;
  peerName: string;
  lastMessage?: Message;
  unreadCount: number;
  similarity?: number;
  online: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Channel for topic-based communication
 */
export interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number;
  context: string[];
  createdAt: number;
  active: boolean;
}

/**
 * Peer profile for discovery
 */
export interface PeerProfile {
  id: string;
  name: string;
  bio: string;
  similarity?: number;
  online: boolean;
  lastSeen?: number;
}

/**
 * User identity
 */
export interface UserIdentity {
  peerId: string;
  name: string;
  bio?: string;
  publicKey?: CryptoKey;
}

/**
 * Feed configuration
 */
export interface FeedConfig {
  limit: number;
  includeOwnPosts: boolean;
  includeReplies: boolean;
}

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  query?: string;
  limit?: number;
  minSimilarity?: number;
}

/**
 * Moderation action
 */
export interface ModerationAction {
  type: 'block' | 'unblock' | 'report';
  peerId: string;
  reason?: string;
  timestamp: number;
}
