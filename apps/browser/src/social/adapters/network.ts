/**
 * Browser Network Adapter for SocialNetwork
 *
 * Implements SocialNetwork interface using DelegationClient for DHT operations.
 */

import type { SocialNetwork, SignedPost, Message, Channel } from '@isc/social';
import type { PeerProfile, FollowSubscription } from '@isc/social';
import { encode, Config, sign } from '@isc/core';
import { DelegationClient } from '@isc/delegation';
import { getKeypair, getPeerID } from '../../identity/index.js';

const DEFAULT_TTL = 86400 * 30; // 30 days

export const browserNetworkAdapter: SocialNetwork = {
  async discoverPeers(): Promise<PeerProfile[]> {
    // Would query DHT for peer discovery
    // Stub for now
    return [];
  },

  async connect(_peerId: string): Promise<void> {
    // Connection management would be handled by DelegationClient
  },

  async disconnect(_peerId: string): Promise<void> {
    // Connection management would be handled by DelegationClient
  },

  async broadcastPost(post: SignedPost): Promise<void> {
    const client = DelegationClient.getInstance();
    if (client) {
      const key = `/isc/post/${post.channelID}/${post.id}`;
      await client.announce(key, encode(post), Config.social.posts.defaultTtlSeconds);
    }
  },

  async requestPosts(_channelId: string): Promise<SignedPost[]> {
    // Would query DHT for posts
    return [];
  },

  async sendMessage(_peerId: string, _message: Message): Promise<void> {
    // Would send DM via DHT or direct connection
  },

  async createChannel(_name: string, _description: string): Promise<Channel> {
    throw new Error('Channel creation not yet implemented in network adapter');
  },

  async joinChannel(_channelId: string): Promise<void> {
    // Would announce join to DHT
  },

  async leaveChannel(_channelId: string): Promise<void> {
    // Would announce leave to DHT
  },

  async announceFollow(follower: string, followee: string, timestamp: number): Promise<void> {
    const client = DelegationClient.getInstance();
    if (client) {
      const keypair = getKeypair();
      if (!keypair) throw new Error('Identity not initialized');

      const event = { follower, followee, timestamp };
      const signature = await sign(encode(event), keypair.privateKey);

      const key = `/isc/follow/${follower}/${followee}`;
      const payload = encode({ ...event, signature });

      if (timestamp === 0) {
        // Delete (unfollow)
        await client.announce(key, new Uint8Array(), 0);
      } else {
        // Add/update
        await client.announce(key, payload, DEFAULT_TTL);
      }
    }
  },

  async queryFollows(peerID: string): Promise<FollowSubscription[]> {
    const client = DelegationClient.getInstance();
    if (!client) {
      return [];
    }

    try {
      // Query DHT for follows: /isc/follow/peerID/*
      const key = `/isc/follow/${peerID}`;
      // This would need a queryRange or similar method on DelegationClient
      // For now, return empty
      return [];
    } catch {
      return [];
    }
  },
};
