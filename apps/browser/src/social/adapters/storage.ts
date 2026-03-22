/**
 * Browser Storage Adapter for SocialStorage
 *
 * Implements SocialStorage interface using IndexedDB helpers.
 */

import type { SocialStorage } from '@isc/social';
import type { SignedPost, Message, Channel, Interaction, FollowSubscription, ProfileSummary } from '@isc/social';
import { dbGet, dbGetAll, dbPut, dbDelete, dbFilter } from '../../db/helpers.js';

const POSTS_STORE = 'posts';
const MESSAGES_STORE = 'messages';
const CHANNELS_STORE = 'channels';
const BLOCKED_PEERS_STORE = 'blocked_peers';
const FOLLOWING_STORE = 'following';
const INTERACTIONS_STORE = 'interactions';
const PROFILES_STORE = 'profiles';
const COMMUNITIES_STORE = 'communities';
const SETTINGS_STORE = 'settings';

export const browserStorageAdapter: SocialStorage = {
  // Posts
  async getPosts(): Promise<SignedPost[]> {
    return dbGetAll<SignedPost>(POSTS_STORE);
  },

  async getPostsByChannel(channelId: string): Promise<SignedPost[]> {
    return dbFilter<SignedPost>(POSTS_STORE, (post) => post.channelID === channelId);
  },

  async getPostsByAuthor(authorId: string): Promise<SignedPost[]> {
    return dbFilter<SignedPost>(POSTS_STORE, (post) => post.author === authorId);
  },

  async savePost(post: SignedPost): Promise<void> {
    await dbPut(POSTS_STORE, post);
  },

  async deletePost(postId: string): Promise<void> {
    await dbDelete(POSTS_STORE, postId);
  },

  // Messages
  async getMessages(peerId: string): Promise<Message[]> {
    return dbFilter<Message>(MESSAGES_STORE, (msg) => msg.conversationId === peerId);
  },

  async saveMessage(message: Message): Promise<void> {
    await dbPut(MESSAGES_STORE, message);
  },

  async deleteMessage(messageId: string): Promise<void> {
    await dbDelete(MESSAGES_STORE, messageId);
  },

  // Channels
  async getChannels(): Promise<Channel[]> {
    return dbGetAll<Channel>(CHANNELS_STORE);
  },

  async saveChannel(channel: Channel): Promise<void> {
    await dbPut(CHANNELS_STORE, channel);
  },

  async deleteChannel(channelId: string): Promise<void> {
    await dbDelete(CHANNELS_STORE, channelId);
  },

  // Moderation
  async getBlockedPeers(): Promise<Set<string>> {
    const blocked = await dbGet<string[]>(BLOCKED_PEERS_STORE, 'blocked');
    return new Set(blocked ?? []);
  },

  async saveBlockedPeers(peers: Set<string>): Promise<void> {
    await dbPut(BLOCKED_PEERS_STORE, Array.from(peers));
  },

  // Following
  async getFollowing(): Promise<Set<string>> {
    const following = await dbGet<string[]>(FOLLOWING_STORE, 'following');
    return new Set(following ?? []);
  },

  async saveFollowing(peerIds: Set<string>): Promise<void> {
    await dbPut(FOLLOWING_STORE, Array.from(peerIds));
  },

  // Interactions
  async getInteractions(peerID: string): Promise<Interaction[]> {
    return dbFilter<Interaction>(INTERACTIONS_STORE, (i) => i.peerID === peerID);
  },

  async getAllInteractions(): Promise<Interaction[]> {
    return dbGetAll<Interaction>(INTERACTIONS_STORE);
  },

  async saveInteraction(interaction: Interaction): Promise<void> {
    await dbPut(INTERACTIONS_STORE, interaction);
  },

  async deleteInteraction(interactionId: string): Promise<void> {
    await dbDelete(INTERACTIONS_STORE, interactionId);
  },

  // Profiles
  async getProfile(peerID: string): Promise<ProfileSummary | null> {
    return dbGet<ProfileSummary>(PROFILES_STORE, peerID);
  },

  async saveProfile(profile: ProfileSummary): Promise<void> {
    await dbPut(PROFILES_STORE, profile);
  },

  // Communities
  async getCommunity(channelID: string): Promise<any | null> {
    return dbGet<any>(COMMUNITIES_STORE, channelID);
  },

  async getCommunities(): Promise<any[]> {
    return dbGetAll<any>(COMMUNITIES_STORE);
  },

  async saveCommunity(community: any): Promise<void> {
    await dbPut(COMMUNITIES_STORE, community);
  },

  async deleteCommunity(channelID: string): Promise<void> {
    await dbDelete(COMMUNITIES_STORE, channelID);
  },

  // Settings
  async getSettings<T>(): Promise<T> {
    const settings = await dbGet<T>(SETTINGS_STORE, 'settings');
    return settings ?? ({} as T);
  },

  async saveSettings<T>(settings: T): Promise<void> {
    await dbPut(SETTINGS_STORE, settings);
  },
};
