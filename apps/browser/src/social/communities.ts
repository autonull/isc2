/**
 * Communities Module - Backward compatibility wrapper
 *
 * Re-exports from @isc/social/communities with browser-specific wrappers.
 */

export { type CommunityService } from '@isc/social';
export type { Community } from '@isc/social';

import { createCommunityService } from '@isc/social';
import { browserStorageAdapter } from './adapters/storage.js';
import { browserIdentityAdapter } from './adapters/identity.js';
import { browserNetworkAdapter } from './adapters/network.js';

// Lazy-loaded community service singleton
let communityService: any = null;

async function getCommunityService() {
  if (!communityService) {
    communityService = createCommunityService(browserStorageAdapter, browserIdentityAdapter, browserNetworkAdapter);
  }
  return communityService;
}

/**
 * Initialize community service (for compatibility)
 */
export async function initializeCommunities(): Promise<void> {
  // Already initialized on first access
  await getCommunityService();
}

/**
 * Create a community channel
 */
export async function createCommunityChannel(
  name: string,
  description: string,
  initialMembers: string[],
  coEditors: string[]
): Promise<any> {
  const svc = await getCommunityService();
  return svc.createCommunity(name, description, initialMembers, coEditors);
}

/**
 * Get community by ID
 */
export async function getCommunity(channelID: string): Promise<any | null> {
  const svc = await getCommunityService();
  return svc.getCommunity(channelID);
}

/**
 * Join a community
 */
export async function joinCommunity(channelID: string): Promise<void> {
  const svc = await getCommunityService();
  return svc.joinCommunity(channelID);
}

/**
 * Leave a community
 */
export async function leaveCommunity(channelID: string): Promise<void> {
  const svc = await getCommunityService();
  return svc.leaveCommunity(channelID);
}

/**
 * Add co-editor to community
 */
export async function addCoEditor(channelID: string, newEditor: string): Promise<void> {
  const svc = await getCommunityService();
  return svc.addCoEditor(channelID, newEditor);
}

/**
 * Update community details
 */
export async function updateCommunityChannel(
  channelID: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  const svc = await getCommunityService();
  return svc.updateCommunity(channelID, updates);
}

/**
 * Get user's communities
 */
export async function getUserCommunities(): Promise<any[]> {
  const svc = await getCommunityService();
  return svc.getUserCommunities();
}

/**
 * Query communities by embedding
 */
export async function queryCommunitiesByEmbedding(embedding: number[], limit?: number): Promise<any[]> {
  const svc = await getCommunityService();
  return svc.queryByEmbedding(embedding, limit);
}

/**
 * Verify community signature
 */
export async function verifyCommunity(community: any): Promise<boolean> {
  const svc = await getCommunityService();
  return svc.verifyCommunity(community);
}

/**
 * Compute semantic neighborhood
 */
export async function computeSemanticNeighborhood(channelID: string, radius?: number): Promise<any[]> {
  const svc = await getCommunityService();
  return svc.computeSemanticNeighborhood(channelID, radius);
}
