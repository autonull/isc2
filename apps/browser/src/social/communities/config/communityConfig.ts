/* eslint-disable */
/**
 * Community Configuration
 */

import type { CommunityConfig } from '../types/community.ts';

export const COMMUNITY_CONFIG: CommunityConfig = {
  defaultTTL: 86400 * 7,
  dbName: 'isc-communities',
  dbVersion: 1,
  minMembers: 1,
  maxCoEditors: 10,
  descriptionMinLength: 10,
} as const;

export const COMMUNITY_STORES = {
  COMMUNITIES: 'communities',
} as const;

export const COMMUNITY_DHT_PREFIXES = {
  COMMUNITY: '/isc/community',
  BUCKET: '/isc/community/bucket',
} as const;

export const ROLE_PERMISSIONS = {
  member: ['view', 'participate'],
  coEditor: ['view', 'participate', 'edit', 'invite'],
  creator: ['view', 'participate', 'edit', 'invite', 'delete', 'transfer'],
} as const;
