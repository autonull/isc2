/**
 * Network Service Wrapper
 *
 * Handles network operations with error handling and state sync.
 * Integrates with BackgroundWorker for persistent background presence.
 */

import { BrowserNetworkService, type PeerMatch as NetworkPeerMatch } from '@isc/network';
import { loggers } from '../logger.js';
import { actions, getState } from '../state.js';
import { NetworkError, ChannelError, MessageError, IdentityError } from '../errors.js';
import { STATUS } from '../constants.js';
import { getBackgroundSyncManager, type BackgroundSyncManager } from './backgroundSync.js';
import { getMessageQueue, type MessageQueueService } from './messageQueue.js';

export interface PeerMatch {
  peerId: string;
  identity: {
    name: string;
    bio: string;
  };
  similarity: number;
  matchedTopics: string[];
  online: boolean;
}

export interface NetworkStatus {
  connected: boolean;
  status: string;
}

class NetworkServiceWrapper {
  private service: BrowserNetworkService | null = null;
  private sharedWorker: BackgroundSyncManager | null = null;
  private messageQueue: MessageQueueService | null = null;
  private log = loggers.network;
  private initialized = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private useBackgroundWorker = typeof SharedWorker !== 'undefined';

  async initialize(): Promise<boolean> {
    try {
      this.log.info('Initializing network service');

      // Initialize BackgroundWorker if available
      if (this.useBackgroundWorker) {
        try {
          this.sharedWorker = getBackgroundSyncManager();
          await this.sharedWorker.initialize();
          
          // Only setup message queue if worker actually connected
          if (this.sharedWorker.isConnected()) {
            this.messageQueue = getMessageQueue();
            this.messageQueue.onMessage((msg) => {
              this.log.info('Delivering queued message:', msg.id);
              this.syncState();
            });
            this.log.info('BackgroundWorker initialized');
          } else {
            this.log.warn('BackgroundWorker not connected, using direct network');
            this.useBackgroundWorker = false;
          }
        } catch (err) {
          this.log.warn('BackgroundWorker init failed, using fallback:', (err as Error).message);
          this.useBackgroundWorker = false;
        }
      }

      this.service = new BrowserNetworkService();
      await this.service.initialize();
      this.initialized = true;
      this.setupEventListeners();
      this.log.info('Network service initialized');
      return true;
    } catch (err) {
      this.log.error('Network initialization failed', { error: (err as Error).message });
      throw new NetworkError('Failed to initialize network', { originalError: (err as Error).message });
    }
  }

  setupEventListeners(): void {
    if (!this.service) return;

    this.service.on({
      onStatusChange: (status) => {
        this.log.info('Network status', { status });
        actions.setStatus(status);
        if (status === STATUS.CONNECTED) {
          this.reconnectAttempts = 0;
          this.syncState();
        } else if (status === STATUS.DISCONNECTED || status === STATUS.ERROR) {
          this.attemptReconnect();
        }
      },

      onPeerDiscovered: (_match) => {
        this.log.debug('Peer discovered');
        this.syncMatches();
      },

      onMatchesUpdated: (matches) => {
        this.log.debug('Matches updated', { count: matches.length });
        actions.setMatches(this.normalizeMatches(matches));
      },

      onChannelCreated: (channel) => {
        this.log.info('Channel created via network', { name: channel.name });
        actions.addChannel(channel);
      },

      onPostCreated: (_post) => {
        this.log.debug('Post received');
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
        }
      },

      onError: (error) => {
        this.log.error('Network error', { error: error?.message ?? error });
      },
    });
  }

  private normalizeMatches(matches: NetworkPeerMatch[]): PeerMatch[] {
    return (matches ?? []).map(m => ({
      peerId: m.peer?.id ?? '',
      identity: {
        name: m.peer?.name ?? 'Anonymous',
        bio: m.peer?.description ?? '',
      },
      similarity: m.similarity ?? 0,
      matchedTopics: m.matchedTopics ?? [],
      online: false,
    }));
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.log.info(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    setTimeout(async () => {
      try {
        this.service?.destroy();
        this.service = null;
        this.initialized = false;
        await this.initialize();
      } catch (err) {
        this.log.error('Reconnect failed', { error: (err as Error).message });
      }
    }, delay);
  }

  async syncState(): Promise<void> {
    try {
      const identity = this.service?.getIdentity();
      const channels = this.service?.getChannels() ?? [];
      const matches = this.service?.getMatches() ?? [];

      actions.setIdentity(identity);
      actions.setChannels(channels);
      actions.setMatches(this.normalizeMatches(matches));
      this.log.debug('State synced', { channels: channels.length, matches: matches.length });
    } catch (err) {
      this.log.error('State sync failed', { error: (err as Error).message });
    }
  }

  async syncMatches(): Promise<void> {
    try {
      const matches = this.service?.getMatches() ?? [];
      actions.setMatches(this.normalizeMatches(matches));
    } catch (err) {
      this.log.error('Match sync failed', { error: (err as Error).message });
    }
  }

  getStatus(): NetworkStatus {
    const raw = this.service?.getStatus() ?? STATUS.DISCONNECTED;
    const statusStr = typeof raw === 'string' ? raw : STATUS.DISCONNECTED;
    return { connected: statusStr === STATUS.CONNECTED, status: statusStr };
  }

  getIdentity() {
    return this.service?.getIdentity() ?? null;
  }

  async updateIdentity(updates: Record<string, any>) {
    try {
      await this.service?.updateIdentity(updates);
      this.log.info('Identity updated', { updates: Object.keys(updates) });
      return this.service?.getIdentity();
    } catch (err) {
      this.log.error('Identity update failed', { error: (err as Error).message });
      throw new IdentityError('Failed to update identity', { originalError: (err as Error).message });
    }
  }

  getChannels() {
    return this.service?.getChannels() ?? [];
  }

  async createChannel(name: string, description: string) {
    try {
      const channel = await this.service!.createChannel(name, description);
      this.log.info('Channel created', { id: channel.id, name: channel.name });
      return channel;
    } catch (err) {
      this.log.error('Channel creation failed', { error: (err as Error).message });
      throw new ChannelError('Failed to create channel', { originalError: (err as Error).message, name });
    }
  }

  async deleteChannel(channelId: string): Promise<void> {
    try {
      await this.service?.deleteChannel?.(channelId);
      this.log.info('Channel deleted', { channelId });
      actions.removeChannel(channelId);
    } catch (err) {
      this.log.error('Channel deletion failed', { error: (err as Error).message });
      throw new ChannelError('Failed to delete channel', { originalError: (err as Error).message, channelId });
    }
  }

  getPosts(channelId?: string) {
    return this.service?.getPosts(channelId) ?? [];
  }

  async createPost(channelId: string, content: string) {
    try {
      const post = await this.service!.createPost(channelId, content);
      this.log.debug('Post created', { id: post.id, channelId });
      return post;
    } catch (err) {
      this.log.error('Post creation failed', { error: (err as Error).message });
      throw new MessageError('Failed to send message', { originalError: (err as Error).message, channelId });
    }
  }

  getMatches(): PeerMatch[] {
    return this.normalizeMatches(this.service?.getMatches() ?? []);
  }

  async discoverPeers(): Promise<void> {
    try {
      await this.service?.discoverPeers();
      this.log.info('Peer discovery initiated');
    } catch (err) {
      this.log.error('Peer discovery failed', { error: (err as Error).message });
    }
  }

  async clearIdentity(): Promise<void> {
    try {
      await this.service?.clearIdentity?.();
      this.log.info('Identity cleared from storage');
    } catch (err) {
      this.log.error('Failed to clear identity', { error: (err as Error).message });
    }
  }

  async destroy(): Promise<void> {
    try {
      this.service?.destroy();
      this.initialized = false;
      this.log.info('Network service destroyed');
    } catch (err) {
      this.log.error('Destroy failed', { error: (err as Error).message });
    }
  }
}

export const networkService = new NetworkServiceWrapper();
