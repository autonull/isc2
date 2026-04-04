/**
 * Social Layer Adapters
 *
 * Adapter interfaces for storage, identity, and network.
 * Business logic depends on these abstractions, not implementations.
 */

import type { SignedPost, Message, Channel, PeerProfile, Interaction, FollowSubscription, ProfileSummary, Community } from '../types';

/**
 * Storage adapter for social data
 */
export interface SocialStorage {
  // Posts
  getPosts(): Promise<SignedPost[]>;
  getPostsByChannel(channelId: string): Promise<SignedPost[]>;
  getPostsByAuthor(authorId: string): Promise<SignedPost[]>;
  savePost(post: SignedPost): Promise<void>;
  deletePost(postId: string): Promise<void>;

  // Messages
  getMessages(peerId: string): Promise<Message[]>;
  saveMessage(message: Message): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;

  // Channels
  getChannels(): Promise<Channel[]>;
  saveChannel(channel: Channel): Promise<void>;
  deleteChannel(channelId: string): Promise<void>;

  // Moderation
  getBlockedPeers(): Promise<Set<string>>;
  saveBlockedPeers(peers: Set<string>): Promise<void>;

  // Preferences
  getFollowing(): Promise<Set<string>>;
  saveFollowing(peerIds: Set<string>): Promise<void>;

  // Interactions
  getInteractions(peerID: string): Promise<Interaction[]>;
  getAllInteractions(): Promise<Interaction[]>;
  saveInteraction(interaction: Interaction): Promise<void>;
  deleteInteraction(interactionId: string): Promise<void>;

  // Profiles
  getProfile(peerID: string): Promise<ProfileSummary | null>;
  saveProfile(profile: ProfileSummary): Promise<void>;

  // Communities
  getCommunity(channelID: string): Promise<Community | null>;
  getCommunities(): Promise<Community[]>;
  saveCommunity(community: Community): Promise<void>;
  deleteCommunity(channelID: string): Promise<void>;

  // Settings
  getSettings<T>(): Promise<T>;
  saveSettings<T>(settings: T): Promise<void>;
}

/**
 * Identity adapter for user identity operations
 */
export interface SocialIdentity {
  getPeerId(): Promise<string>;
  getName(): Promise<string>;
  getBio(): Promise<string>;
  getPublicKey(): Promise<CryptoKey | null>;
  getPrivateKey(): Promise<CryptoKey | null>;
  sign(data: Uint8Array): Promise<Uint8Array>;
  verify(data: Uint8Array, signature: Uint8Array, publicKey: CryptoKey): Promise<boolean>;
}

/**
 * Network adapter for peer communication
 */
export interface SocialNetwork {
  // Peer discovery
  discoverPeers(): Promise<PeerProfile[]>;
  connect(peerId: string): Promise<void>;
  disconnect(peerId: string): Promise<void>;

  // Post distribution
  broadcastPost(post: SignedPost): Promise<void>;
  requestPosts(channelId: string): Promise<SignedPost[]>;
  deletePost(postId: string, channelId: string): Promise<void>;

  // Messaging
  sendMessage(peerId: string, message: Message): Promise<void>;

  // Channel operations
  createChannel(name: string, description: string): Promise<Channel>;
  joinChannel(channelId: string): Promise<void>;
  leaveChannel(channelId: string): Promise<void>;

  // Follow operations
  announceFollow(follower: string, followee: string, timestamp: number): Promise<void>;
  queryFollows(peerID: string): Promise<FollowSubscription[]>;
}

/**
 * Embedding adapter for semantic matching
 */
export interface EmbeddingAdapter {
  embed(text: string): Promise<number[]>;
  similarity(a: number[], b: number[]): Promise<number>;
}
