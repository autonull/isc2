/* eslint-disable */
/**
 * Community Type Definitions
 */

import type { Signature } from '@isc/core';

export interface Community {
  channelID: string;
  name: string;
  description: string;
  members: string[];
  coEditors: string[];
  embedding: number[];
  createdAt: number;
  updatedAt: number;
  signature: Signature;
}

export interface CommunityPayload {
  channelID: string;
  name: string;
  description: string;
  members: string[];
  coEditors: string[];
  embedding: number[];
  createdAt: number;
  updatedAt: number;
}

export type CommunityRole = 'member' | 'coEditor' | 'creator';

export interface Membership {
  peerID: string;
  communityID: string;
  role: CommunityRole;
  joinedAt: number;
}

export interface CommunityConfig {
  defaultTTL: number;
  dbName: string;
  dbVersion: number;
  minMembers: number;
  maxCoEditors: number;
  descriptionMinLength: number;
}
