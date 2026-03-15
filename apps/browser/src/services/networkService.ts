/**
 * Browser Network Service Wrapper
 * 
 * Integrates @isc/network BrowserNetworkService with the Web UI.
 * Provides a consistent API for the rest of the application.
 */

import {
  getBrowserNetworkService,
  type BrowserNetworkService,
  type NetworkStatus,
  type ChannelData,
  type PostData,
  type Identity,
  type PeerMatch,
} from '@isc/network';

/**
 * Network service for browser UI
 */
class WebUINetworkService {
  private service: BrowserNetworkService;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.service = getBrowserNetworkService();
  }

  /**
   * Initialize the network service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        await this.service.initialize();
        this.initialized = true;
        console.log('[WebUI Network] Initialized');
      } catch (err) {
        console.error('[WebUI Network] Initialization failed:', err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return this.service.getStatus();
  }

  /**
   * Get current user identity
   */
  getIdentity(): Identity | null {
    return this.service.getIdentity();
  }

  /**
   * Update user identity
   */
  async updateIdentity(updates: Partial<Identity>): Promise<void> {
    await this.service.updateIdentity(updates);
  }

  /**
   * Create a new channel
   */
  async createChannel(name: string, description: string): Promise<ChannelData> {
    await this.ensureInitialized();
    return this.service.createChannel(name, description);
  }

  /**
   * Get all channels
   */
  getChannels(): ChannelData[] {
    return this.service.getChannels();
  }

  /**
   * Create a new post
   */
  async createPost(channelId: string, content: string): Promise<PostData> {
    await this.ensureInitialized();
    return this.service.createPost(channelId, content);
  }

  /**
   * Get posts for a channel
   */
  getPosts(channelId?: string): PostData[] {
    return this.service.getPosts(channelId);
  }

  /**
   * Get all posts
   */
  getAllPosts(): PostData[] {
    return this.service.getPosts();
  }

  /**
   * Get discovered peer matches
   */
  getMatches(): PeerMatch[] {
    return this.service.getMatches();
  }

  /**
   * Discover peers manually
   */
  async discoverPeers(): Promise<PeerMatch[]> {
    await this.ensureInitialized();
    return this.service.discoverPeers();
  }

  /**
   * Subscribe to network events
   */
  on(events: {
    onStatusChange?: (status: NetworkStatus) => void;
    onChannelCreated?: (channel: ChannelData) => void;
    onPostCreated?: (post: PostData) => void;
    onPeerDiscovered?: (match: PeerMatch) => void;
    onMatchesUpdated?: (matches: PeerMatch[]) => void;
    onError?: (error: Error) => void;
  }): void {
    this.service.on(events);
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Cleanup on unload
   */
  destroy(): void {
    this.service.destroy();
    this.initialized = false;
    this.initPromise = null;
  }
}

/**
 * Singleton instance
 */
let _instance: WebUINetworkService | null = null;

export function getWebUINetworkService(): WebUINetworkService {
  if (!_instance) {
    _instance = new WebUINetworkService();
  }
  return _instance;
}

/**
 * Convenience exports
 */
export type { NetworkStatus, ChannelData, PostData, Identity, PeerMatch };
