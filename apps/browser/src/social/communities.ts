/* eslint-disable */
/**
 * Communities Module - Backward compatibility wrapper
 *
 * Re-exports from @isc/social/communities with browser-specific wrappers.
 */

export { type CommunityService } from '@isc/social';
export type { Community } from '@isc/social';

import { createCommunityService, type CommunityService, type Community } from '@isc/social';
import { browserStorageAdapter } from './adapters/storage.ts';
import { browserIdentityAdapter } from './adapters/identity.ts';
import { browserNetworkAdapter } from './adapters/network.ts';

// Lazy-loaded community service singleton
let communityService: CommunityService | null = null;

async function getCommunitySvc(): Promise<CommunityService> {
  if (!communityService) {
    communityService = createCommunityService(browserStorageAdapter, browserIdentityAdapter, browserNetworkAdapter);
  }
  return communityService;
}

/**
 * Initialize community service (for compatibility)
 */
export async function initializeCommunities(): Promise<void> {
  await getCommunitySvc();
}

/**
 * Create a community channel
 */
export async function createCommunityChannel(
  name: string,
  description: string,
  initialMembers: string[],
  coEditors: string[]
): Promise<Community> {
  const svc = await getCommunitySvc();
  return svc.createCommunity(name, description, initialMembers, coEditors);
}

/**
 * Get community by ID
 */
export async function getCommunity(channelID: string): Promise<Community | null> {
  const svc = await getCommunitySvc();
  return svc.getCommunity(channelID);
}

/**
 * Join a community
 */
export async function joinCommunity(channelID: string): Promise<void> {
  const svc = await getCommunitySvc();
  return svc.joinCommunity(channelID);
}

/**
 * Leave a community
 */
export async function leaveCommunity(channelID: string): Promise<void> {
  const svc = await getCommunitySvc();
  return svc.leaveCommunity(channelID);
}

/**
 * Add co-editor to community
 */
export async function addCoEditor(channelID: string, newEditor: string): Promise<void> {
  const svc = await getCommunitySvc();
  return svc.addCoEditor(channelID, newEditor);
}

/**
 * Update community details
 */
export async function updateCommunityChannel(
  channelID: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  const svc = await getCommunitySvc();
  return svc.updateCommunity(channelID, updates);
}

/**
 * Get user's communities
 */
export async function getUserCommunities(): Promise<Community[]> {
  const svc = await getCommunitySvc();
  return svc.getUserCommunities();
}

/**
 * Query communities by embedding
 */
export async function queryCommunitiesByEmbedding(embedding: number[], limit?: number): Promise<Community[]> {
  const svc = await getCommunitySvc();
  return svc.queryByEmbedding(embedding, limit);
}

/**
 * Verify community signature
 */
export async function verifyCommunitySignature(community: Community): Promise<boolean> {
  const svc = await getCommunitySvc();
  return svc.verifyCommunity(community);
}

/**
 * Compute semantic neighborhood
 */
export async function computeSemanticNeighborhood(channelID: string, radius?: number): Promise<Community[]> {
  const svc = await getCommunitySvc();
  return svc.computeSemanticNeighborhood(channelID, radius);
}
