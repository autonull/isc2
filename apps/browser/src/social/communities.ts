/**
 * Communities - Legacy Compatibility Layer
 *
 * @deprecated Use the modular communities module instead:
 * - CommunityService for community management
 * - CommunityRepository for storage
 * - CommunitySigningService for signing operations
 */

import { CommunityService } from './communities/services/CommunityService.js';
import type { Community } from './communities/types/community.js';

const service = CommunityService.getInstance();

export type { Community };

/**
 * Initialize community service
 */
export async function initializeCommunities(): Promise<void> {
  await service.initialize();
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
  return service.createCommunity(name, description, initialMembers, coEditors);
}

/**
 * Get community by ID
 */
export async function getCommunity(channelID: string): Promise<Community | null> {
  return service.getCommunity(channelID);
}

/**
 * Join a community
 */
export async function joinCommunity(channelID: string): Promise<void> {
  await service.joinCommunity(channelID);
}

/**
 * Leave a community
 */
export async function leaveCommunity(channelID: string): Promise<void> {
  await service.leaveCommunity(channelID);
}

/**
 * Add co-editor to community
 */
export async function addCoEditor(
  channelID: string,
  newEditor: string
): Promise<void> {
  await service.addCoEditor(channelID, newEditor);
}

/**
 * Update community details
 */
export async function updateCommunityChannel(
  channelID: string,
  updates: { name?: string; description?: string }
): Promise<void> {
  await service.updateCommunity(channelID, updates);
}

/**
 * Get user's communities
 */
export async function getUserCommunities(): Promise<Community[]> {
  return service.getUserCommunities();
}

/**
 * Query communities by embedding
 */
export async function queryCommunitiesByEmbedding(
  embedding: number[],
  limit?: number
): Promise<Community[]> {
  return service.queryByEmbedding(embedding, limit);
}

/**
 * Verify community signature
 */
export async function verifyCommunity(community: Community): Promise<boolean> {
  return service.verifyCommunity(community);
}

/**
 * Compute semantic neighborhood
 */
export async function computeSemanticNeighborhood(
  channelID: string,
  radius?: number
): Promise<Community[]> {
  return service.computeSemanticNeighborhood(channelID, radius);
}
