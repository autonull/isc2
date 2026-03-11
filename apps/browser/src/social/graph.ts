/**
 * Social Graph Service
 * 
 * Handles follows, suggested follows, and basic reputation.
 */

import { sign, encode } from '@isc/core';
import type { FollowSubscription } from './types.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbDelete } from '../db/helpers.js';

const FOLLOWS_STORE = 'follows';
const DEFAULT_TTL = 86400 * 30; // 30 days

/**
 * Follow a user
 */
export async function followUser(followee: string): Promise<void> {
  const follower = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const followEvent = {
    follower,
    followee,
    timestamp: Date.now(),
  };

  const payload = encode(followEvent);
  const signature = await sign(payload, keypair.privateKey);

  // Store locally
  const subscription: FollowSubscription = {
    followee,
    since: Date.now(),
  };
  await dbPut(FOLLOWS_STORE, subscription);

  // Announce to DHT
  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/follow/${follower}/${followee}`;
    await client.announce(key, encode({ ...followEvent, signature }), DEFAULT_TTL);
  }
}

/**
 * Unfollow a user
 */
export async function unfollowUser(followee: string): Promise<void> {
  await dbDelete(FOLLOWS_STORE, followee);

  // Would announce unfollow to DHT in real implementation
  const client = DelegationClient.getInstance();
  if (client) {
    const follower = await getPeerID();
    const key = `/isc/follow/${follower}/${followee}`;
    // Announce with TTL 0 to remove
    await client.announce(key, new Uint8Array(), 0);
  }
}

/**
 * Get list of users being followed
 */
export async function getFollowees(): Promise<string[]> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.map((s) => s.followee);
}

/**
 * Check if following a user
 */
export async function isFollowing(followee: string): Promise<boolean> {
  const subscription = await dbGet<FollowSubscription>(FOLLOWS_STORE, followee);
  return subscription !== null;
}

/**
 * Get follower count for a user
 */
export async function getFollowerCount(peerID: string): Promise<number> {
  // Would query DHT for followers in real implementation
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => s.followee === peerID).length;
}

/**
 * Get following count for a user
 */
export async function getFollowingCount(peerID: string): Promise<number> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => {
    // In real implementation, would check if peerID is the follower
    return true; // Placeholder
  }).length;
}

/**
 * Compute simple reputation score based on follows
 */
export async function computeReputation(peerID: string): Promise<number> {
  const followers = await getFollowerCount(peerID);
  // Simple log-based reputation
  return Math.log2(followers + 1);
}

/**
 * Get suggested follows based on mutual connections
 * Note: Simplified implementation
 */
export async function getSuggestedFollows(limit: number = 10): Promise<string[]> {
  const followees = await getFollowees();
  
  // In real implementation, would:
  // 1. Get followers of people you follow
  // 2. Count mutual connections
  // 3. Rank by mutual count
  // 4. Exclude people you already follow
  
  // Placeholder - return empty
  return [];
}
