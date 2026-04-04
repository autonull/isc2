/**
 * Network Service Wrapper
 *
 * Handles network operations with error handling and state sync.
 * Integrates with BackgroundWorker for persistent background presence.
 */

import { BrowserNetworkService, type PeerMatch as NetworkPeerMatch, type ChannelData } from '@isc/network';

type ChannelRelation = NonNullable<ChannelData['relations']>[number];
import { loggers } from '../utils/logger.js';
// @ts-expect-error state.js has no declaration file
import { actions } from '../state.js';
import { AppError as NetworkError, AppError as ChannelError, AppError as MessageError, AppError as IdentityError } from '@isc/core';
export const STATUS = { CONNECTED: 'connected', DISCONNECTED: 'disconnected', ERROR: 'error', CONNECTING: 'connecting' };
import { getBackgroundSyncManager, type BackgroundSyncManager } from './backgroundSync.js';
import { getMessageQueue, type MessageQueueService } from './messageQueue.js';
import { updatePeerProximity } from './peerProximity.js';
import { convergenceService } from './convergence.js';
import { saveChannelSnapshot } from './channelHistory.js';

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
              this.log.info('Delivering queued message', { msgId: msg.id });
              this.syncState();
            });
            this.log.info('BackgroundWorker initialized');
          } else {
            this.log.warn('BackgroundWorker not connected, using direct network');
            this.useBackgroundWorker = false;
          }
        } catch (err) {
          this.log.warn('BackgroundWorker init failed, using fallback', { error: (err as Error).message });
          this.useBackgroundWorker = false;
        }
      }

      this.service = new BrowserNetworkService();
      await this.service.initialize();
      this.setupEventListeners();
      this.log.info('Network service initialized');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn('Network initialization failed', { error: msg });
      throw new NetworkError(`Failed to initialize network: ${msg}`);
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

        for (const match of matches) {
          if (match.peer?.id && match.similarity != null) {
            updatePeerProximity(match.peer.id, match.similarity).catch(() => {});

            const lshBucket = this.getLSHBucketKey(match.peer.id, match.similarity);
            convergenceService.addPeer(match.peer.id, lshBucket);
          }
        }

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
        this.log.warn('Network error', { message: error?.message ?? String(error) });
      },
    });
  }

  private normalizeMatches(matches: NetworkPeerMatch[]): PeerMatch[] {
    return (matches ?? []).map((m) => ({
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

  private getLSHBucketKey(peerId: string, similarity: number): string {
    const hash = this.simpleHash(peerId);
    const bucket = Math.floor(hash % 100);
    const simBucket =
      similarity >= 0.85
        ? 'high'
        : similarity >= 0.7
          ? 'mid'
          : similarity >= 0.55
            ? 'low'
            : 'distant';
    return `${bucket}-${simBucket}`;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.log.warn('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.log.info(
      `Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(async () => {
      try {
        this.service?.destroy();
        this.service = null;
        await this.initialize();
        
        // K1: Trigger background sync on successful reconnect
        if (this.sharedWorker?.isConnected()) {
          this.sharedWorker.requestStateSync();
          this.log.info('Background sync triggered after reconnect');
        }
      } catch (err) {
        this.log.warn('Reconnect failed', { error: (err as Error).message });
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
      this.log.warn('State sync failed', { error: (err as Error).message });
    }
  }

  async syncMatches(): Promise<void> {
    try {
      const matches = this.service?.getMatches() ?? [];
      actions.setMatches(this.normalizeMatches(matches));
    } catch (err) {
      this.log.warn('Match sync failed', { error: (err as Error).message });
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

  async updateIdentity(updates: Record<string, unknown>) {
    try {
      await this.service?.updateIdentity(updates);
      this.log.info('Identity updated', { updates: Object.keys(updates) });
      return this.service?.getIdentity();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn('Identity update failed', { error: msg });
      throw new IdentityError(`Failed to update identity: ${msg}`);
    }
  }

  getChannels() {
    return this.service?.getChannels() ?? [];
  }

  async createChannel(name: string, description: string, options?: Record<string, unknown>) {
    try {
      const channel = await this.service!.createChannel(name, description, options);
      this.log.info('Channel created', { id: channel.id, name: channel.name });

      saveChannelSnapshot(channel.id, description).catch(() => {});

      return channel;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn('Channel creation failed', { error: msg });
      throw new ChannelError(`Failed to create channel: ${msg}`);
    }
  }

  async updateChannel(channelId: string, updates: { name?: string; description?: string; relations?: ChannelRelation[] }) {
    try {
      const channel = await this.service!.updateChannel(channelId, updates);
      this.log.info('Channel updated', { channelId, updates: Object.keys(updates) });
      this.syncState();
      return channel;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn('Channel update failed', { error: msg });
      throw new ChannelError(`Failed to update channel: ${msg}`);
    }
  }

  async deleteChannel(channelId: string): Promise<void> {
    try {
      await this.service?.deleteChannel?.(channelId);
      this.log.info('Channel deleted', { channelId });
      actions.removeChannel(channelId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn('Channel deletion failed', { error: msg });
      throw new ChannelError(`Failed to delete channel: ${msg}`);
    }
  }

  async setChannelLurkMode(channelId: string, isLurker: boolean): Promise<void> {
    try {
      await this.service?.setChannelLurkMode?.(channelId, isLurker);
      this.log.info('Channel lurk mode updated', { channelId, isLurker });
      this.syncState();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn('Failed to set channel lurk mode', { error: msg });
      throw new ChannelError(`Failed to set channel lurk mode: ${msg}`);
    }
  }

  getPosts(channelId?: string) {
    return this.service?.getPosts(channelId) ?? [];
  }

  async fetchMessagesForChannel(channel: ChannelData) {
    if (!this.service?.fetchMessagesForChannel) {
      return this.getPosts(channel.id);
    }
    return this.service.fetchMessagesForChannel(channel);
  }

  async createPost(channelId: string, content: string) {
    try {
      const post = await this.service!.createPost(channelId, content);
      this.log.debug('Post created', { id: post.id, channelId });
      return post;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log.warn('Post creation failed', { error: msg });
      throw new MessageError(`Failed to send message: ${msg}`);
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
      this.log.warn('Peer discovery failed', { error: (err as Error).message });
    }
  }

  async clearIdentity(): Promise<void> {
    try {
      await this.service?.clearIdentity?.();
      this.log.info('Identity cleared from storage');
    } catch (err) {
      this.log.warn('Failed to clear identity', { error: (err as Error).message });
    }
  }

  async destroy(): Promise<void> {
    try {
      this.service?.destroy();
      this.log.info('Network service destroyed');
    } catch (err) {
      this.log.warn('Destroy failed', { error: (err as Error).message });
    }
  }
}

export const networkService = new NetworkServiceWrapper();
