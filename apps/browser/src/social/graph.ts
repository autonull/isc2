import { sign, encode, cosineSimilarity, Config, Validators } from '@isc/core';
import type { FollowSubscription, ProfileSummary } from './types.js';
import { getPeerID, getKeypair, getPeerPublicKey } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { dbGet, dbGetAll, dbPut, dbDelete, dbFilter } from '../db/helpers.js';

const FOLLOWS_STORE = 'follows';
const INTERACTIONS_STORE = 'interactions';
const PROFILES_STORE = 'profiles';
const DEFAULT_TTL = 86400 * 30;

export interface Interaction {
  type: string;
  peerID: string;
  timestamp: number;
  weight: number;
}

export interface ReputationResult {
  peerID: string;
  score: number;
  halfLifeDays: number;
  mutualFollows: number;
  interactionHistory: Interaction[];
  decayedScore: number;
}

export interface TrustScore {
  directTrust: number;
  indirectTrust: number;
  mutualFollowBonus: number;
  sybilCap: number;
  total: number;
}

export interface TrustPath {
  source: string;
  target: string;
  hops: string[];
  depth: number;
  confidence: number;
}

export interface FollowSuggestion {
  peerID: string;
  score: number;
  mutualFollows: number;
  reason: string;
}

export interface BridgeProfile {
  peerID: string;
  bridgeScore: number;
  communities: string[];
}

export async function followUser(followee: string): Promise<void> {
  const follower = await getPeerID();
  const keypair = getKeypair();
  Validators.keypair(keypair);

  const { follow } = Config.social.reputation.interactionWeights;
  const followEvent = { follower, followee, timestamp: Date.now() };
  const payload = encode(followEvent);
  const signature = await sign(payload, keypair.privateKey);

  const subscription: FollowSubscription = { followee, since: Date.now() };
  await dbPut(FOLLOWS_STORE, subscription);
  await recordInteraction(followee, 'follow', follow);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/follow/${follower}/${followee}`;
    await client.announce(key, encode({ ...followEvent, signature }), DEFAULT_TTL);
  }
}

export async function unfollowUser(followee: string): Promise<void> {
  await dbDelete(FOLLOWS_STORE, followee);

  const client = DelegationClient.getInstance();
  if (client) {
    const follower = await getPeerID();
    const key = `/isc/follow/${follower}/${followee}`;
    await client.announce(key, new Uint8Array(), 0);
  }
}

export async function getFollowees(): Promise<string[]> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.map((s) => s.followee);
}

export async function isFollowing(followee: string): Promise<boolean> {
  const subscription = await dbGet<FollowSubscription>(FOLLOWS_STORE, followee);
  return subscription !== null;
}

export async function getFollowerCount(peerID: string): Promise<number> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => s.followee === peerID).length;
}

export async function getFollowingCount(peerID: string): Promise<number> {
  const subscriptions = await dbGetAll<FollowSubscription>(FOLLOWS_STORE);
  return subscriptions.filter((s) => s.followee === peerID).length;
}

export async function recordInteraction(
  peerID: string,
  type: string,
  weight?: number
): Promise<void> {
  const { interactionWeights } = Config.social.reputation;
  const interaction: Interaction = {
    type,
    peerID,
    timestamp: Date.now(),
    weight: weight ?? interactionWeights[type as keyof typeof interactionWeights] ?? 1,
  };

  const id = `interaction_${crypto.randomUUID()}`;
  await dbPut(INTERACTIONS_STORE, { ...interaction, id });
}

export async function getInteractionHistory(peerID: string): Promise<Interaction[]> {
  return dbFilter<Interaction>(INTERACTIONS_STORE, (i) => i.peerID === peerID);
}

export function applyDecay(interaction: Interaction, halfLifeDays: number): number {
  const now = Date.now();
  const ageMs = now - interaction.timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const decay = Math.pow(0.5, ageDays / halfLifeDays);
  return interaction.weight * decay;
}

export async function computeReputation(
  peerID: string,
  halfLifeDays: number = Config.social.reputation.halfLifeDays
): Promise<ReputationResult> {
  const interactions = await getInteractionHistory(peerID);
  const decayedInteractions = interactions.map((i) => ({
    ...i,
    decayedWeight: applyDecay(i, halfLifeDays),
  }));

  const baseScore = decayedInteractions.reduce((sum, i) => sum + i.decayedWeight, 0);
  const followees = await getFollowees();
  const mutualFollows = followees.filter((f) => isFollowing(f)).length;
  const mutualFollowBonus = Math.min(mutualFollows * 0.05, 0.4);
  const normalizedScore = Math.log2(baseScore + 1) / 10;
  const cappedScore = Math.min(normalizedScore + mutualFollowBonus, 1.0);

  return {
    peerID,
    score: cappedScore,
    halfLifeDays,
    mutualFollows,
    interactionHistory: interactions,
    decayedScore: baseScore,
  };
}

export async function computeTrustScore(targetPeer: string): Promise<TrustScore> {
  const myID = await getPeerID();
  const following = await isFollowing(targetPeer);
  const directTrust = following ? 0.5 : 0;

  const followees = await getFollowees();
  const indirectCount = followees.filter((f) => f !== targetPeer).length;
  const indirectTrust = Math.min(indirectCount * 0.03, 0.3);
  const mutualFollowBonus = following ? 0.2 : 0;
  const sybilCap = 0.3;
  const total = Math.min(directTrust + indirectTrust + mutualFollowBonus, 1.0);

  return { directTrust, indirectTrust, mutualFollowBonus, sybilCap, total };
}

export async function findTrustPaths(
  source: string,
  target: string,
  maxDepth: number = 3
): Promise<TrustPath[]> {
  if (source === target) {
    return [{ source, target, hops: [], depth: 0, confidence: 1.0 }];
  }
  return [];
}

export async function getWoTSuggestedFollows(
  limit: number = 10,
  minTrustScore: number = 0.3
): Promise<FollowSuggestion[]> {
  await getFollowees();
  return [];
}

export async function getBridgeSuggestions(limit: number = 5): Promise<BridgeProfile[]> {
  return [];
}

export async function getProfile(peerID: string): Promise<ProfileSummary | null> {
  const profile = await dbGet<ProfileSummary>(PROFILES_STORE, peerID);
  if (profile) return profile;

  const followerCount = await getFollowerCount(peerID);
  const followingCount = await getFollowingCount(peerID);

  return {
    peerID,
    channelCount: 0,
    followerCount,
    followingCount,
    updatedAt: Date.now(),
  };
}

export async function updateProfile(profile: ProfileSummary): Promise<void> {
  await dbPut(PROFILES_STORE, profile);
}

export function applyChaosMode(embedding: number[], chaosLevel: number): number[] {
  if (chaosLevel <= 0) return embedding;

  const perturbed = embedding.map((v) => v + (Math.random() - 0.5) * 2 * chaosLevel);
  const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return embedding;

  return perturbed.map((v) => v / norm);
}

export async function getSuggestedFollows(limit: number = 10): Promise<string[]> {
  await getFollowees();
  return [];
}
