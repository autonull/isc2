/* eslint-disable */
/**
 * Communities Module
 *
 * Community management with signing, storage, and DHT announcement.
 */

export { CommunityService } from './services/CommunityService.ts';
export { CommunityRepository } from './services/CommunityRepository.ts';
export { CommunitySigningService } from './services/CommunitySigningService.ts';
export {
  validateName,
  validateDescription,
  validateMembers,
  validateCoEditors,
  validateCommunity,
  hasPermission,
} from './utils/communityValidator.ts';

export {
  COMMUNITY_CONFIG,
  COMMUNITY_STORES,
  COMMUNITY_DHT_PREFIXES,
  ROLE_PERMISSIONS,
} from './config/communityConfig.ts';

export type {
  Community,
  CommunityPayload,
  CommunityRole,
  Membership,
} from './types/community.ts';
