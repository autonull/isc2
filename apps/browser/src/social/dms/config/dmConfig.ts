/**
 * Direct Message Configuration
 */

import type { DMConfig } from '../types/dm.js';

export const DM_CONFIG: DMConfig = {
  defaultTTL: 86400 * 30,
  dbName: 'isc-dms',
  dbVersion: 1,
  maxGroupSize: 8,
} as const;

export const DM_STORES = {
  DMS: 'dms',
  GROUP_DMS: 'group_dms',
} as const;

export const DM_DHT_PREFIXES = {
  INBOX: '/isc/dm/inbox',
  GROUP_DM: '/isc/group_dm',
} as const;
