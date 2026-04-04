/* eslint-disable */
/**
 * Extended Types for Browser App
 * 
 * Extends core types with additional fields needed for the UI.
 */

import type { Post as CorePost, Channel as CoreChannel } from '@isc/core';

/**
 * Post with engagement fields (stored separately from core)
 */
export interface Post extends CorePost {
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  repostedFrom?: string;
  replyTo?: string;
  _score?: number;
  similarityScore?: number;
  matchedChannelName?: string;
}

/**
 * Relation tag for semantic position
 */
export interface Relation {
  tag: string;
  object: string;
  weight?: number;
}

/**
 * Channel with UI-specific fields
 */
export interface Channel extends CoreChannel {
  postCount?: number;
  followerCount?: number;
  breadth?: string;
}

/**
 * User profile with extended fields
 */
export interface UserProfile {
  id: string;
  name: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  joinedAt: number;
}

/**
 * Conversation for DMs
 */
export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
}

/**
 * Message in a conversation
 */
export interface Message {
  id: string;
  conversationId: string;
  author: string;
  content: string;
  timestamp: number;
  read: boolean;
}

/**
 * Video call state
 */
export interface Call {
  id: string;
  participants: string[];
  active: boolean;
  startTime?: number;
  endTime?: number;
  type: 'audio' | 'video';
}
