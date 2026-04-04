/* eslint-disable */
/**
 * Browser Network Adapter for SocialNetwork
 *
 * Implements SocialNetwork interface using RealDHTClient for DHT operations.
 * Replaces the previous DelegationClient dependency which was never initialized.
 */

import type { SocialNetwork, SignedPost, Message, Channel } from '@isc/social';
import type { PeerProfile, FollowSubscription } from '@isc/social';
import { encode, decode, sign } from '@isc/core';
import { getDHTClient, initializeDHT } from '../../network/dht.ts';
import { getKeypair } from '../../identity/index.ts';

const DEFAULT_TTL = 86400 * 30; // 30 days
const POST_CHANNEL_PREFIX = '/isc/post/';
const FOLLOW_PREFIX = '/isc/follow/';
const DM_INBOX_PREFIX = '/isc/dm/inbox/';
const CHANNEL_PREFIX = '/isc/channel/';
const DM_TTL = 3600; // 1 hour

export const browserNetworkAdapter: SocialNetwork = {
  async discoverPeers(): Promise<PeerProfile[]> {
    const dht = getDHTClient();
    if (!dht.isConnected()) return [];

    // Query DHT for peer announcements across common channels
    // In practice, peers announce per-channel; we scan for active peers
    const results: PeerProfile[] = [];
    const seen = new Set<string>();

    // Query a general peer presence key pattern
    // This would ideally use LSH-based queries, but for now scan active channels
    try {
      const allValues = await dht.query('/isc/peers', 100);
      for (const raw of allValues) {
        try {
          const peer = JSON.parse(new TextDecoder().decode(raw));
          if (!seen.has(peer.peerID)) {
            seen.add(peer.peerID);
            results.push({
              id: peer.peerID,
              name: peer.name ?? 'Anonymous',
              bio: peer.bio ?? '',
              online: true,
              lastSeen: Date.now(),
            });
          }
        } catch {
          // Skip malformed entries
        }
      }
    } catch {
      // DHT query failed, return empty
    }

    return results;
  },

  async connect(_peerId: string): Promise<void> {
    // libp2p handles connection management automatically via DHT peer discovery
    // Explicit connect is a no-op in DHT-based architecture
    const dht = getDHTClient();
    if (!dht.isConnected()) {
      await initializeDHT();
    }
  },

  async disconnect(_peerId: string): Promise<void> {
    // DHT-based architecture doesn't maintain persistent connections
    // Disconnect is implicit via TTL expiration
  },

  async broadcastPost(post: SignedPost): Promise<void> {
    await ensureDHTInitialized();
    const dht = getDHTClient();

    // Store using channel-based key for reliable retrieval
    const channelKey = `${POST_CHANNEL_PREFIX}${post.channelID}/${post.id}`;
    const value = encode(post);
    await dht.announce(channelKey, value, DEFAULT_TTL);

    // Also store in a channel index for enumeration
    try {
      const indexKey = `${POST_CHANNEL_PREFIX}${post.channelID}/index`;
      const existing = await dht.query(indexKey, 1);
      let index: { postIds: string[] } = { postIds: [] };
      if (existing.length > 0) {
        index = JSON.parse(new TextDecoder().decode(existing[0]));
        if (!Array.isArray(index.postIds)) index.postIds = [];
      }
      if (!index.postIds.includes(post.id)) {
        index.postIds.push(post.id);
        // Keep index bounded
        if (index.postIds.length > 200) index.postIds = index.postIds.slice(-200);
        await dht.announce(indexKey, encode(index), DEFAULT_TTL);
      }
    } catch {
      // Index update failed, post still retrievable via direct key
    }
  },

  async deletePost(postId: string, channelId: string): Promise<void> {
    await ensureDHTInitialized();
    const dht = getDHTClient();
    const key = `${POST_CHANNEL_PREFIX}${channelId}/${postId}`;
    // Announce with TTL=0 to signal deletion
    await dht.announce(key, new Uint8Array(), 0);

    // Remove from channel index
    try {
      const indexKey = `${POST_CHANNEL_PREFIX}${channelId}/index`;
      const existing = await dht.query(indexKey, 1);
      if (existing.length > 0) {
        const index = JSON.parse(new TextDecoder().decode(existing[0])) as { postIds: string[] };
        index.postIds = index.postIds.filter(id => id !== postId);
        await dht.announce(indexKey, encode(index), DEFAULT_TTL);
      }
    } catch {
      // Index cleanup failed, deletion still announced
    }
  },

  async requestPosts(channelId: string): Promise<SignedPost[]> {
    await ensureDHTInitialized();
    const dht = getDHTClient();

    try {
      const posts: SignedPost[] = [];

      // Query using the same key pattern as BrowserNetworkService.createPost:
      // /isc/post/{channelId}/{postId}
      // First try to get the channel's post index
      const indexValues = await dht.query(`${POST_CHANNEL_PREFIX}${channelId}/index`, 1);
      if (indexValues.length > 0) {
        try {
          const index = JSON.parse(new TextDecoder().decode(indexValues[0])) as { postIds: string[] };
          for (const postId of index.postIds.slice(0, 50)) {
            const postValues = await dht.query(`${POST_CHANNEL_PREFIX}${channelId}/${postId}`, 1);
            if (postValues.length > 0) {
              try {
                posts.push(decode(postValues[0]) as SignedPost);
              } catch {
                // Skip malformed post
              }
            }
          }
        } catch {
          // Index malformed, fall through to broad query
        }
      }

      // Also do a broad prefix query to catch posts announced directly
      if (posts.length === 0) {
        const broadResults = await dht.query(`${POST_CHANNEL_PREFIX}${channelId}`, 50);
        for (const raw of broadResults) {
          try {
            const decoded = decode(raw);
            // Skip index entries, only parse actual posts
            if (decoded && typeof decoded === 'object' && 'id' in decoded && 'content' in decoded) {
              posts.push(decoded as SignedPost);
            }
          } catch {
            // Skip malformed
          }
        }
      }

      return posts;
    } catch {
      return [];
    }
  },

  async sendMessage(peerId: string, message: Message): Promise<void> {
    await ensureDHTInitialized();
    const dht = getDHTClient();
    const inboxKey = `${DM_INBOX_PREFIX}${peerId}`;

    // Fetch existing inbox, append, re-announce
    let inbox: Message[] = [];
    try {
      const existing = await dht.query(inboxKey, 1);
      if (existing.length > 0) {
        inbox = JSON.parse(new TextDecoder().decode(existing[0]));
        if (!Array.isArray(inbox)) inbox = [];
      }
    } catch {
      // No existing inbox, start fresh
    }

    inbox.push(message);
    if (inbox.length > 100) inbox = inbox.slice(-100);

    await dht.announce(inboxKey, encode(inbox), DM_TTL);
  },

  async createChannel(name: string, description: string): Promise<Channel> {
    await ensureDHTInitialized();

    const channel: Channel = {
      id: `ch_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32)}_${crypto.randomUUID().slice(0, 8)}`,
      name,
      description,
      spread: 0.15,
      context: [],
      createdAt: Date.now(),
      active: true,
    };

    const dht = getDHTClient();
    const key = `${CHANNEL_PREFIX}${channel.id}`;
    const value = encode(channel);
    await dht.announce(key, value, DEFAULT_TTL);

    return channel;
  },

  async joinChannel(channelId: string): Promise<void> {
    await ensureDHTInitialized();
    const dht = getDHTClient();
    const keypair = getKeypair();
    const peerId = keypair ? await getPeerIdFromKeypair(keypair.publicKey) : 'anonymous';

    // Announce presence in channel
    const presence = { peerID: peerId, channelID: channelId, joinedAt: Date.now() };
    const value = encode(presence);
    await dht.announce(`${CHANNEL_PREFIX}${channelId}/members/${peerId}`, value, 3600);
  },

  async leaveChannel(channelId: string): Promise<void> {
    await ensureDHTInitialized();
    const dht = getDHTClient();
    const keypair = getKeypair();
    const peerId = keypair ? await getPeerIdFromKeypair(keypair.publicKey) : 'anonymous';

    // Remove presence by announcing with TTL=0
    await dht.announce(`${CHANNEL_PREFIX}${channelId}/members/${peerId}`, new Uint8Array(), 0);
  },

  async announceFollow(follower: string, followee: string, timestamp: number): Promise<void> {
    await ensureDHTInitialized();
    const keypair = getKeypair();
    if (!keypair) throw new Error('Identity not initialized');

    const dht = getDHTClient();
    const event = { follower, followee, timestamp };
    const signature = await sign(encode(event), keypair.privateKey);
    const signedEvent = { ...event, signature: Array.from(signature.data) };

    const key = `${FOLLOW_PREFIX}${follower}/${followee}`;
    const payload = encode(signedEvent);

    if (timestamp === 0) {
      await dht.announce(key, new Uint8Array(), 0);
    } else {
      await dht.announce(key, payload, DEFAULT_TTL);
    }
  },

  async queryFollows(peerID: string): Promise<FollowSubscription[]> {
    await ensureDHTInitialized();
    const dht = getDHTClient();

    try {
      // Query DHT for follows: /isc/follow/peerID/*
      const values = await dht.query(`${FOLLOW_PREFIX}${peerID}`, 100);
      const follows: FollowSubscription[] = [];

      for (const raw of values) {
        try {
          const event = decode(raw) as { follower: string; followee: string; timestamp: number };
          if (event.followee && event.timestamp > 0) {
            follows.push({ followee: event.followee, since: event.timestamp });
          }
        } catch {
          // Skip malformed entries
        }
      }

      return follows;
    } catch {
      return [];
    }
  },
};

async function ensureDHTInitialized(): Promise<void> {
  const dht = getDHTClient();
  if (!dht.isConnected()) {
    await initializeDHT();
  }
}

async function getPeerIdFromKeypair(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', exported);
  const bytes = new Uint8Array(hash);
  return `peer_${Array.from(bytes.slice(0, 16)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
