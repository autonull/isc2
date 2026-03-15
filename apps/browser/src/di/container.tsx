/**
 * Dependency Injection Container
 *
 * Provides a centralized way to manage and inject dependencies throughout the app.
 * Makes testing easier by allowing mock dependencies to be swapped in.
 */

import { h, createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { ChannelManager } from '../channels/manager.js';
import type { Navigator } from '@isc/navigation';
import type { ChannelService } from '../services/channelService.js';
import type { PostService } from '../services/postService.js';
import type { FeedService } from '../services/feedService.js';
import type { WebUINetworkService } from '../services/networkService.js';

// Service interfaces for DI
export interface IdentityService {
  getKeypair(): Promise<any | null>;
  getPublicKey(): Promise<string | null>;
  getFingerprint(): Promise<string | null>;
  isInitialized(): Promise<boolean>;
  initialize(passphrase?: string): Promise<void>;
  sign(data: any): Promise<string>;
}

export interface SettingsService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  getAll(): Promise<Record<string, any>>;
  update(updates: Record<string, any>): Promise<void>;
}

export interface VideoService {
  startCall(targetUserId: string): Promise<any>;
  endCall(callId: string): Promise<void>;
  getActiveCall(): Promise<any | null>;
  getCallHistory(): Promise<any[]>;
}

export interface ChatService {
  getConversations(): Promise<any[]>;
  getMessages(conversationId: string): Promise<any[]>;
  send(conversationId: string, content: string): Promise<void>;
  createConversation(userId: string): Promise<any>;
}

export interface DiscoveryService {
  searchPeers(query: string): Promise<any[]>;
  getRecommendedPeers(): Promise<any[]>;
  getPeerProfile(userId: string): Promise<any>;
}

/**
 * All app dependencies
 */
export interface AppDependencies {
  channelManager: ChannelManager | null;
  channelService: ChannelService | null;
  postService: PostService | null;
  feedService: FeedService | null;
  networkService: WebUINetworkService | null;
  navigator: Navigator | null;
  identity: IdentityService | null;
  settings: SettingsService | null;
  video: VideoService | null;
  chat: ChatService | null;
  discovery: DiscoveryService | null;
}

/**
 * Default (null) dependencies
 * Used when dependencies aren't provided
 */
export const nullDependencies: AppDependencies = {
  channelManager: null,
  channelService: null,
  postService: null,
  feedService: null,
  networkService: null,
  navigator: null,
  identity: null,
  settings: null,
  video: null,
  chat: null,
  discovery: null,
};

/**
 * Context for dependency injection
 */
const DependencyContext = createContext<AppDependencies>(nullDependencies);

/**
 * Provider component that makes dependencies available to children
 */
export function DependencyProvider({
  children,
  dependencies,
}: {
  children: any;
  dependencies: Partial<AppDependencies>;
}) {
  // Merge provided dependencies with defaults
  const mergedDependencies = {
    ...nullDependencies,
    ...dependencies,
  };

  return (
    <DependencyContext.Provider value={mergedDependencies}>
      {children}
    </DependencyContext.Provider>
  );
}

/**
 * Hook to get all dependencies
 */
export function useDependencies(): AppDependencies {
  return useContext(DependencyContext);
}

/**
 * Hook to get a specific dependency
 */
export function useDependency<K extends keyof AppDependencies>(
  key: K
): AppDependencies[K] {
  const dependencies = useContext(DependencyContext);
  return dependencies[key];
}

/**
 * Hook to get channel manager with error handling
 */
export function useChannelManager(): ChannelManager | null {
  const { channelManager } = useDependencies();
  return channelManager;
}

/**
 * Hook to get channel service
 */
export function useChannelService(): ChannelService | null {
  const { channelService } = useDependencies();
  return channelService;
}

/**
 * Hook to get navigator with error handling
 */
export function useAppNavigator(): Navigator | null {
  const { navigator } = useDependencies();
  return navigator;
}

/**
 * Hook to get identity service
 */
export function useIdentity(): IdentityService | null {
  const { identity } = useDependencies();
  return identity;
}

/**
 * Hook to get settings service
 */
export function useSettingsService(): SettingsService | null {
  const { settings } = useDependencies();
  return settings;
}

/**
 * Hook to get post service
 */
export function usePostService(): PostService | null {
  const { postService } = useDependencies();
  return postService;
}

/**
 * Hook to get feed service
 */
export function useFeedService(): FeedService | null {
  const { feedService } = useDependencies();
  return feedService;
}

/**
 * Hook to get video service
 */
export function useVideoService(): VideoService | null {
  const { video } = useDependencies();
  return video;
}

/**
 * Hook to get chat service
 */
export function useChatService(): ChatService | null {
  const { chat } = useDependencies();
  return chat;
}

/**
 * Hook to get discovery service
 */
export function useDiscoveryService(): DiscoveryService | null {
  const { discovery } = useDependencies();
  return discovery;
}

/**
 * Create mock dependencies for testing
 */
export function createMockDependencies(overrides?: Partial<AppDependencies>): AppDependencies {
  const mockChannelManager = {
    async createChannel() { return { id: 'mock-channel', name: 'Mock', description: '', spread: 50, relations: [], createdAt: Date.now(), updatedAt: Date.now(), active: true }; },
    async getChannel() { return null; },
    async getAllChannels() { return []; },
    async updateChannel() { return null; },
    async deleteChannel() {},
    async activateChannel() {},
    async deactivateChannel() {},
    async forkChannel() { return null; },
    async archiveChannel() {},
    async computeChannelDistributions() { return []; },
    async activateChannelWithEmbedding() {},
    getActiveChannelCount() { return 0; },
    isActive() { return false; },
  };

  const mockChannelService = {
    async createChannel() { return { id: 'mock-channel', name: 'Mock', description: '', spread: 50, relations: [], createdAt: Date.now(), updatedAt: Date.now(), active: true }; },
    async getChannel() { return null; },
    async getAllChannels() { return []; },
    async getActiveChannels() { return []; },
    async updateChannel() { return null; },
    async deleteChannel() {},
    async activateChannel() {},
    async deactivateChannel() {},
    getChannelCount() { return 0; },
  };

  const mockNavigator = {
    async navigate() {},
    async goBack() {},
    async goForward() {},
    async replace() {},
    async push() {},
    async pop() {},
    currentRoute: null,
    canGoBack: false,
    canGoForward: false,
    subscribe() { return () => {}; },
  };

  const mockPostService = {
    async createPost() { return { id: 'mock-post', content: '', channelID: '', author: '', timestamp: Date.now(), signature: '' }; },
    async getPost() { return null; },
    async getAllPosts() { return []; },
    async getPostsByChannel() { return []; },
    async getPostsByAuthor() { return []; },
    async deletePost() {},
    async likePost() {},
    async repostPost() {},
    async replyToPost() { return { id: 'mock-reply', content: '', postId: '', author: '', timestamp: Date.now() }; },
  };

  const mockFeedService = {
    async getForYouFeed() { return []; },
    async getFollowingFeed() { return []; },
    async getChannelFeed() { return []; },
    async getExploreFeed() { return []; },
    async refresh() {},
  };

  const mockIdentity = {
    async getKeypair() { return null; },
    async getPublicKey() { return null; },
    async getFingerprint() { return null; },
    async isInitialized() { return false; },
    async initialize() {},
    async sign() { return 'mock-signature'; },
  };

  const mockSettings = {
    async get() { return null; },
    async set() {},
    async getAll() { return {}; },
    async update() {},
  };

  const mockVideo = {
    async startCall() { return { id: 'mock-call', active: true }; },
    async endCall() {},
    async getActiveCall() { return null; },
    async getCallHistory() { return []; },
  };

  const mockChat = {
    async getConversations() { return []; },
    async getMessages() { return []; },
    async send() {},
    async createConversation() { return { id: 'mock-conversation' }; },
  };

  const mockDiscovery = {
    async searchPeers() { return []; },
    async getRecommendedPeers() { return []; },
    async getPeerProfile() { return null; },
  };

  const mockNetworkService = {
    async initialize() {},
    getStatus() { return 'disconnected'; },
    getIdentity() { return null; },
    async updateIdentity() {},
    async createChannel() { return { id: 'mock-channel', name: 'Mock', description: '', createdAt: Date.now(), members: [] }; },
    getChannels() { return []; },
    async createPost() { return { id: 'mock-post', channelId: '', channelName: '', content: '', author: '', authorId: '', createdAt: Date.now() }; },
    getPosts() { return []; },
    getMatches() { return []; },
    async discoverPeers() { return []; },
    on() {},
    destroy() {},
  };

  return {
    channelManager: mockChannelManager as unknown as ChannelManager,
    channelService: mockChannelService as unknown as ChannelService,
    postService: mockPostService as unknown as PostService,
    feedService: mockFeedService as unknown as FeedService,
    networkService: mockNetworkService as unknown as WebUINetworkService,
    navigator: mockNavigator as unknown as Navigator,
    identity: mockIdentity,
    settings: mockSettings,
    video: mockVideo,
    chat: mockChat,
    discovery: mockDiscovery,
    ...overrides,
  };
}
