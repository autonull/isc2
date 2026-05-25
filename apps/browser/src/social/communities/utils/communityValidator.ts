/* eslint-disable */
/**
 * Community Validator Utilities
 */

import { COMMUNITY_CONFIG } from '../config/communityConfig.ts';
import type { Community } from '../types/community.ts';

/**
 * Validate community name
 */
export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Name is required' };
  }

  if (name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (name.length > 100) {
    return { valid: false, error: 'Name must be less than 100 characters' };
  }

  return { valid: true };
}

/**
 * Validate community description
 */
export function validateDescription(
  description: string
): { valid: boolean; error?: string } {
  if (!description || !description.trim()) {
    return { valid: false, error: 'Description is required' };
  }

  if (description.trim().length < COMMUNITY_CONFIG.descriptionMinLength) {
    return {
      valid: false,
      error: `Description must be at least ${COMMUNITY_CONFIG.descriptionMinLength} characters`,
    };
  }

  if (description.length > 1000) {
    return { valid: false, error: 'Description must be less than 1000 characters' };
  }

  return { valid: true };
}

/**
 * Validate member list
 */
export function validateMembers(members: string[]): { valid: boolean; error?: string } {
  if (!Array.isArray(members)) {
    return { valid: false, error: 'Members must be an array' };
  }

  if (members.length < COMMUNITY_CONFIG.minMembers) {
    return {
      valid: false,
      error: `Community must have at least ${COMMUNITY_CONFIG.minMembers} member`,
    };
  }

  const uniqueMembers = new Set(members);
  if (uniqueMembers.size !== members.length) {
    return { valid: false, error: 'Duplicate members not allowed' };
  }

  return { valid: true };
}

/**
 * Validate co-editor list
 */
export function validateCoEditors(coEditors: string[]): { valid: boolean; error?: string } {
  if (!Array.isArray(coEditors)) {
    return { valid: false, error: 'Co-editors must be an array' };
  }

  if (coEditors.length > COMMUNITY_CONFIG.maxCoEditors) {
    return {
      valid: false,
      error: `Maximum ${COMMUNITY_CONFIG.maxCoEditors} co-editors allowed`,
    };
  }

  const uniqueEditors = new Set(coEditors);
  if (uniqueEditors.size !== coEditors.length) {
    return { valid: false, error: 'Duplicate co-editors not allowed' };
  }

  return { valid: true };
}

/**
 * Validate complete community object
 */
export function validateCommunity(
  community: Partial<Community>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const nameResult = validateName(community.name ?? '');
  if (!nameResult.valid) {
    errors.push(nameResult.error!);
  }

  const descResult = validateDescription(community.description ?? '');
  if (!descResult.valid) {
    errors.push(descResult.error!);
  }

  const membersResult = validateMembers(community.members ?? []);
  if (!membersResult.valid) {
    errors.push(membersResult.error!);
  }

  const coEditorsResult = validateCoEditors(community.coEditors ?? []);
  if (!coEditorsResult.valid) {
    errors.push(coEditorsResult.error!);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if peer has required role
 */
export function hasPermission(
  community: Community,
  peerID: string,
  requiredRole: 'member' | 'coEditor' | 'creator'
): boolean {
  if (requiredRole === 'member') {
    return community.members.includes(peerID);
  }

  if (requiredRole === 'coEditor') {
    return community.coEditors.includes(peerID);
  }

  if (requiredRole === 'creator') {
    return community.members[0] === peerID;
  }

  return false;
}
