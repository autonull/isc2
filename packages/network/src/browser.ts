// @ts-nocheck
/**
 * ISC Network - Browser Network Service
 * 
 * Main network service for browser applications.
 * Integrates embedding, DHT, storage, and peer management.
 */

import {
  createEmbeddingService,
  createDHT,
  VirtualPeer,
  type PeerMatch,
  type PeerInfo,
  type EmbeddingService,
} from './index.js';
import { createStorage, type Storage } from './storage.js';
import { BrowserNetworkAdapter } from '@isc/adapters/browser';
import { Libp2pDHT } from './libp2p-dht.js';
import type { DHT } from './types.js';

/**
 * Network service configuration
 */
export interface NetworkServiceConfig {
  autoDiscover: boolean;
  discoverInterval: number;
  similarityThreshold: number;
  announceTTL: number;
  maxCachedMatches: number;
}

const DEFAULT_CONFIG: NetworkServiceConfig = {
  autoDiscover: true,
  discoverInterval: 30000, // 30 seconds
  similarityThreshold: 0.4,
  announceTTL: 300000, // 5 minutes
  maxCachedMatches: 50,
};

/**
 * Network service events
 */
export interface NetworkEvents {
  onPeerDiscovered?: (match: PeerMatch) => void;
  onMatchesUpdated?: (matches: PeerMatch[]) => void;
  onChannelCreated?: (channel: any) => void;
  onPostCreated?: (post: any) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: NetworkStatus) => void;
}

export type NetworkStatus = 'disconnected' | 'connecting' | 'loading' | 'connected' | 'error';

/**
 * Channel data structure
 */
export interface ChannelData {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  members: string[];
  embedding?: number[];
}

/**
 * Post data structure
 */
export interface PostData {
  id: string;
  channelId: string;
  channelName: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: number;
  embedding?: number[];
}

/**
 * User identity
 */
export interface Identity {
  peerId: string;
  name: string;
  bio: string;
  publicKey?: string;
  createdAt: number;
}

/**
 * Browser Network Service
 * 
 * Main entry point for network functionality in browser apps.
 */
export class BrowserNetworkService {
  private config: NetworkServiceConfig;
  private events: NetworkEvents = {};
  private storage: Storage;
  private embedding: EmbeddingService | null = null;
  // Use in-memory fallback unless network is started
  private dht: DHT = createDHT();
  private networkAdapter: BrowserNetworkAdapter | null = null;
  private localPeer: VirtualPeer | null = null;
  private identity: Identity | null = null;
  private matches: PeerMatch[] = [];
  private channels: ChannelData[] = [];
  private posts: PostData[] = [];
  private status: NetworkStatus = 'disconnected';
  private discoveryTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  constructor(config: Partial<NetworkServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storage = createStorage();
  }

  /**
   * Initialize the network service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.setStatus('connecting');

    try {
      // Load or create identity
      await this.loadIdentity();

      // Load embedding service (lazy)
      this.embedding = createEmbeddingService();

      // Load cached data
      await this.loadCachedData();

      // Start Real Network Adapter
      this.networkAdapter = new BrowserNetworkAdapter();
      try {
        await this.networkAdapter.start();
        console.log('[Network] Real libp2p network adapter started.');

        if (typeof window !== 'undefined') {
           (window as any).__iscNetworkAdapter = this.networkAdapter;
        }

        // Swap out the local in-memory DHT for the real libp2p DHT
        this.dht = new Libp2pDHT(this.networkAdapter);
        console.log('[Network] Swapped InMemoryDHT with real Libp2pDHT connected to NetworkAdapter.');
      } catch (err) {
        console.warn('[Network] Failed to start real network adapter, falling back to in-memory DHT. Err: ', err);
        this.networkAdapter = null;
      }

      this.setupPubSub();

      // Announce to DHT
      await this.announceToDHT();

      // Start auto-discovery
      if (this.config.autoDiscover) {
        this.startAutoDiscovery();
      }

      this.initialized = true;
      this.setStatus('connected');
      console.log('[Network] Service initialized');
    } catch (err) {
      console.error('[Network] Initialization failed:', err);
      this.setStatus('error');
      this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Load or create user identity
   */
  private async loadIdentity(): Promise<void> {
    const saved = await this.storage.get<Identity>('isc-identity');
    
    if (saved) {
      this.identity = saved;
      console.log('[Network] Loaded identity:', saved.name);
    } else {
      // Create new identity
      this.identity = {
        peerId: `browser-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: 'Anonymous',
        bio: 'ISC User',
        createdAt: Date.now(),
      };
      await this.storage.set('isc-identity', this.identity);
      console.log('[Network] Created new identity:', this.identity.peerId);
    }
  }

  /**
   * Load cached channels, posts, and matches
   */
  private async loadCachedData(): Promise<void> {
    const [channels, posts, matches] = await Promise.all([
      this.storage.get<ChannelData[]>('isc-channels'),
      this.storage.get<PostData[]>('isc-posts'),
      this.storage.get<PeerMatch[]>('isc-matches'),
    ]);

    this.channels = channels || [];
    this.posts = posts || [];
    this.matches = matches || [];

    console.log(`[Network] Loaded cache: ${this.channels.length} channels, ${this.posts.length} posts, ${this.matches.length} matches`);
  }

  /**
   * Create local peer and announce to DHT
   */
  private async announceToDHT(): Promise<void> {
    if (!this.embedding || !this.identity) {
      throw new Error('Network not initialized');
    }

    // Load embedding model
    await this.embedding.load();

    // Create local peer
    this.localPeer = await VirtualPeer.create(
      this.identity.peerId,
      this.identity.bio,
      this.embedding
    );

    // Announce to DHT
    await this.localPeer.announce(this.dht, this.config.announceTTL);
    console.log('[Network] Announced to DHT');
  }

  /**
   * Start automatic peer discovery
   */
  private startAutoDiscovery(): void {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
    }

    this.discoveryTimer = setInterval(() => {
      this.discoverPeers();
    }, this.config.discoverInterval);

    console.log(`[Network] Auto-discovery started (${this.config.discoverInterval}ms interval)`);
  }

  /**
   * Stop automatic peer discovery
   */
  stopAutoDiscovery(): void {
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
  }

  /**
   * Discover matching peers
   */
  async discoverPeers(): Promise<PeerMatch[]> {
    if (!this.localPeer) {
      throw new Error('Local peer not created');
    }

    try {
      const newMatches = await this.localPeer.discover(this.dht, this.config.similarityThreshold);

      // Filter out self and duplicates
      const uniqueMatches = newMatches.filter(
        m => m.peer.id !== this.localPeer!.id &&
        !this.matches.some(existing => existing.peer.id === m.peer.id)
      );

      if (uniqueMatches.length > 0) {
        // Add new matches
        this.matches = [...uniqueMatches, ...this.matches].slice(0, this.config.maxCachedMatches);
        await this.storage.set('isc-matches', this.matches);

        // Notify
        for (const match of uniqueMatches) {
          this.events.onPeerDiscovered?.(match);
        }
        this.events.onMatchesUpdated?.(this.matches);

        console.log(`[Network] Found ${uniqueMatches.length} new matches`);
      }

      return uniqueMatches;
    } catch (err) {
      console.error('[Network] Discovery failed:', err);
      this.events.onError?.(err instanceof Error ? err : new Error(String(err)));
      return [];
    }
  }

  /**
   * Create a new channel
   */
  async createChannel(name: string, description: string): Promise<ChannelData> {
    if (!this.embedding) {
      throw new Error('Embedding service not loaded');
    }

    // Compute embedding for semantic matching
    const embedding = await this.embedding.compute(description);

    const channel: ChannelData = {
      id: `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      createdAt: Date.now(),
      members: [this.identity?.peerId || 'unknown'],
      embedding,
    };

    this.channels.push(channel);
    await this.storage.set('isc-channels', this.channels);

    // Announce channel to DHT
    await this.announceChannel(channel);

    this.events.onChannelCreated?.(channel);
    console.log(`[Network] Created channel: ${channel.name}`);

    return channel;
  }

  /**
   * Announce channel to DHT
   */
  private async announceChannel(channel: ChannelData): Promise<void> {
    if (!this.embedding) return;

    // Create a peer-like announcement for the channel
    const channelPeer = new VirtualPeer({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      topics: this.extractKeywords(channel.description),
    });

    // Set the pre-computed embedding
    (channelPeer as any).vector = channel.embedding;

    await channelPeer.announce(this.dht, this.config.announceTTL);
  }

  /**
   * Get the underlying network adapter for tests or advanced interactions
   */
  getNetworkAdapter(): BrowserNetworkAdapter | null {
     return this.networkAdapter;
  }

  /**
   * Subscribe to network events for new posts
   */
  private setupPubSub(): void {
    if (!this.networkAdapter || !this.networkAdapter.subscribe) return;

    const topic = 'isc:posts:global';

    this.networkAdapter.subscribe(topic, async (data: Uint8Array) => {
      try {
        const post: PostData = JSON.parse(new TextDecoder().decode(data));

        // Ensure we don't process our own posts twice
        if (this.posts.some(p => p.id === post.id)) return;

        this.posts.unshift(post);
        await this.storage.set('isc-posts', this.posts);

        this.events.onPostCreated?.(post);
        console.log(`[Network] Received post in ${post.channelName} via Gossipsub`);
      } catch (err) {
        console.warn('[Network] Failed to parse incoming post:', err);
      }
    });

    console.log(`[Network] Subscribed to topic: ${topic}`);
  }

  /**
   * Create a new post
   */
  async createPost(channelId: string, content: string): Promise<PostData> {
    const channel = this.channels.find(c => c.id === channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const post: PostData = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      channelId,
      channelName: channel.name,
      content,
      author: this.identity?.name || 'Anonymous',
      authorId: this.identity?.peerId || 'unknown',
      createdAt: Date.now(),
    };

    this.posts.unshift(post);
    await this.storage.set('isc-posts', this.posts);

    this.events.onPostCreated?.(post);
    console.log(`[Network] Created post in ${channel.name}`);

    // Compute embedding and broadcast asynchronously so the post appears immediately
    if (this.embedding || (this.networkAdapter && this.networkAdapter.publish)) {
      (async () => {
        try {
          if (this.embedding) {
            post.embedding = await this.embedding.compute(content);
          }
          // Broadcast via pubsub if network is available
          if (this.networkAdapter && this.networkAdapter.publish) {
            const data = new TextEncoder().encode(JSON.stringify(post));
            await this.networkAdapter.publish('isc:posts:global', data);
            console.log(`[Network] Broadcasted post via Gossipsub`);
          }
          // Persist with embedding
          if (post.embedding) {
            await this.storage.set('isc-posts', this.posts);
          }
        } catch (err) {
          console.warn('[Network] Post background processing failed:', err);
        }
      })();
    }

    return post;
  }

  /**
   * Delete a channel by ID
   */
  async deleteChannel(channelId: string): Promise<void> {
    this.channels = this.channels.filter(c => c.id !== channelId);
    this.posts = this.posts.filter(p => p.channelId !== channelId);
    await Promise.all([
      this.storage.set('isc-channels', this.channels),
      this.storage.set('isc-posts', this.posts),
    ]);
    console.log(`[Network] Deleted channel: ${channelId}`);
  }

  /**
   * Delete a post by ID
   */
  async deletePost(postId: string): Promise<void> {
    this.posts = this.posts.filter(p => p.id !== postId);
    await this.storage.set('isc-posts', this.posts);
    console.log(`[Network] Deleted post: ${postId}`);
  }

  /**
   * Like a post (client-side optimistic — persisted locally only)
   */
  async likePost(postId: string): Promise<void> {
    const post = this.posts.find(p => p.id === postId) as any;
    if (!post) return;
    if (!post.likes) post.likes = [];
    const myId = this.identity?.peerId || 'unknown';
    if (!post.likes.includes(myId)) {
      post.likes.push(myId);
      await this.storage.set('isc-posts', this.posts);
    }
  }

  /**
   * Clear identity from storage (for logout)
   */
  async clearIdentity(): Promise<void> {
    await this.storage.delete('isc-identity');
    this.identity = null;
    console.log('[Network] Identity cleared');
  }

  /**
   * Get all channels
   */
  getChannels(): ChannelData[] {
    return [...this.channels];
  }

  /**
   * Get posts for a channel
   */
  getPosts(channelId?: string): PostData[] {
    if (channelId) {
      return this.posts.filter(p => p.channelId === channelId);
    }
    return [...this.posts];
  }

  /**
   * Get discovered matches
   */
  getMatches(): PeerMatch[] {
    return [...this.matches];
  }

  /**
   * Get current identity
   */
  getIdentity(): Identity | null {
    return this.identity;
  }

  /**
   * Update identity
   */
  async updateIdentity(updates: Partial<Identity>): Promise<void> {
    if (!this.identity) {
      throw new Error('No identity');
    }

    this.identity = { ...this.identity, ...updates };
    await this.storage.set('isc-identity', this.identity);

    // Re-announce with updated bio
    if (updates.bio && this.embedding) {
      await this.announceToDHT();
    }

    console.log('[Network] Identity updated');
  }

  /**
   * Set event handlers
   */
  on(events: NetworkEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Get current status
   */
  getStatus(): NetworkStatus {
    return this.status;
  }

  /**
   * Set status and notify
   */
  private setStatus(status: NetworkStatus): void {
    this.status = status;
    this.events.onStatusChange?.(status);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const keywords = [
      'ai', 'artificial intelligence', 'machine learning', 'neural',
      'distributed', 'systems', 'consensus', 'blockchain',
      'climate', 'carbon', 'energy',
      'quantum', 'computing',
      'bio', 'gene', 'crispr',
      'robotics', 'automation',
    ];
    const lower = text.toLowerCase();
    return keywords.filter(k => lower.includes(k));
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    await Promise.all([
      this.storage.delete('isc-channels'),
      this.storage.delete('isc-posts'),
      this.storage.delete('isc-matches'),
    ]);
    this.channels = [];
    this.posts = [];
    this.matches = [];
    console.log('[Network] Cache cleared');
  }

  /**
   * Cleanup on unload
   */
  destroy(): void {
    this.stopAutoDiscovery();
    if (this.embedding) {
      this.embedding.unload();
    }
    if (this.networkAdapter) {
      this.networkAdapter.stop().catch(console.error);
    }
    this.initialized = false;
    console.log('[Network] Service destroyed');
  }
}

/**
 * Create a new browser network service instance
 */
export function createBrowserNetworkService(
  config?: Partial<NetworkServiceConfig>
): BrowserNetworkService {
  return new BrowserNetworkService(config);
}

/**
 * Singleton instance for convenience
 */
let _instance: BrowserNetworkService | null = null;

export function getBrowserNetworkService(): BrowserNetworkService {
  if (!_instance) {
    _instance = createBrowserNetworkService();
  }
  return _instance;
}
