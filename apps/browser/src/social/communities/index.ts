/**
 * Communities Module
 *
 * Community management with signing, storage, and DHT announcement.
 */

export { CommunityService } from './services/CommunityService.js';
export { CommunityRepository } from './services/CommunityRepository.js';
export { CommunitySigningService } from './services/CommunitySigningService.js';
export {
  validateName,
  validateDescription,
  validateMembers,
  validateCoEditors,
  validateCommunity,
  hasPermission,
} from './utils/communityValidator.js';

export {
  COMMUNITY_CONFIG,
  COMMUNITY_STORES,
  COMMUNITY_DHT_PREFIXES,
  ROLE_PERMISSIONS,
} from './config/communityConfig.js';

export type {
  Community,
  CommunityPayload,
  CommunityRole,
  Membership,
} from './types/community.js';
