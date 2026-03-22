/**
 * Graph Module - Backward compatibility wrapper
 *
 * Re-exports from @isc/social/graph with browser-specific wrappers.
 */

export {
  type GraphService,
  type ReputationResult,
  type TrustScore,
  type FollowSuggestion,
  type BridgeProfile,
} from '@isc/social';

export type { Interaction, FollowSubscription, ProfileSummary } from '@isc/social';

import { createGraphService } from '@isc/social';
import { browserStorageAdapter } from './adapters/storage.js';
import { browserIdentityAdapter } from './adapters/identity.js';
import { browserNetworkAdapter } from './adapters/network.js';

// Lazy-loaded graph service singleton
let graphService: any = null;

async function getGraphService() {
  if (!graphService) {
    graphService = createGraphService(browserStorageAdapter, browserIdentityAdapter, browserNetworkAdapter);
  }
  return graphService;
}

// Backward-compatible function exports
export async function followUser(followee: string): Promise<void> {
  const svc = await getGraphService();
  return svc.followUser(followee);
}

export async function unfollowUser(followee: string): Promise<void> {
  const svc = await getGraphService();
  return svc.unfollowUser(followee);
}

export async function getFollowees(): Promise<string[]> {
  const svc = await getGraphService();
  return svc.getFollowees();
}

export async function isFollowing(followee: string): Promise<boolean> {
  const svc = await getGraphService();
  return svc.isFollowing(followee);
}

export async function getFollowerCount(peerID: string): Promise<number> {
  const svc = await getGraphService();
  return svc.getFollowerCount(peerID);
}

export async function getFollowingCount(peerID: string): Promise<number> {
  const svc = await getGraphService();
  return svc.getFollowingCount(peerID);
}

export async function recordInteraction(peerID: string, type: string, weight?: number): Promise<void> {
  const svc = await getGraphService();
  return svc.recordInteraction(peerID, type, weight);
}

export async function getInteractionHistory(peerID: string): Promise<any[]> {
  const svc = await getGraphService();
  return svc.getInteractionHistory(peerID);
}

export async function computeReputation(peerID: string, halfLifeDays?: number): Promise<any> {
  const svc = await getGraphService();
  return svc.computeReputation(peerID, halfLifeDays);
}

export async function computeTrustScore(targetPeer: string): Promise<any> {
  const svc = await getGraphService();
  return svc.computeTrustScore(targetPeer);
}

export async function findTrustPaths(source: string, target: string, maxDepth?: number): Promise<any[]> {
  const svc = await getGraphService();
  return svc.findTrustPaths(source, target, maxDepth);
}

export async function getWoTSuggestedFollows(limit?: number, minTrustScore?: number): Promise<any[]> {
  const svc = await getGraphService();
  return svc.getWoTSuggestedFollows(limit, minTrustScore);
}

export async function getSuggestedFollows(limit?: number): Promise<any[]> {
  const svc = await getGraphService();
  return svc.getSuggestedFollows(limit);
}

export async function getFolloweesOf(peerID: string): Promise<string[]> {
  const svc = await getGraphService();
  return svc.getFolloweesOf(peerID);
}

export async function getInteractionBasedSuggestions(limit?: number): Promise<any[]> {
  const svc = await getGraphService();
  return svc.getInteractionBasedSuggestions(limit);
}

export async function getAllFollowSuggestions(limit?: number): Promise<any[]> {
  const svc = await getGraphService();
  return svc.getAllFollowSuggestions(limit);
}

export async function getBridgeSuggestions(limit?: number): Promise<any[]> {
  const svc = await getGraphService();
  return svc.getBridgeSuggestions(limit);
}

export async function getProfile(peerID: string): Promise<any | null> {
  const svc = await getGraphService();
  return svc.getProfile(peerID);
}

export async function updateProfile(profile: any): Promise<void> {
  const svc = await getGraphService();
  return svc.updateProfile(profile);
}

export function applyChaosMode(embedding: number[], chaosLevel: number): number[] {
  if (chaosLevel <= 0) return embedding;

  const perturbed = embedding.map((v) => v + (Math.random() - 0.5) * 2 * chaosLevel);
  const norm = Math.sqrt(perturbed.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? embedding : perturbed.map((v) => v / norm);
}
