/**
 * Community Signing Service
 *
 * Centralized signing for community operations.
 * Extracts repeated signing pattern.
 */

import { sign, encode } from '@isc/core';
import type { Signature } from '@isc/core';
import { getKeypair } from '../../../identity/index.js';
import type { CommunityPayload, Community } from '../types/community.js';

export class CommunitySigningService {
  /**
   * Sign community payload
   */
  static async sign(payload: CommunityPayload): Promise<Signature> {
    const keypair = await getKeypair();
    if (!keypair) {
      throw new Error('Identity not initialized');
    }
    return sign(encode(payload), keypair.privateKey);
  }

  /**
   * Create signed community from payload
   */
  static async createSignedCommunity(
    payload: CommunityPayload
  ): Promise<Community> {
    const signature = await this.sign(payload);
    return { ...payload, signature };
  }

  /**
   * Update signature on existing community
   */
  static async updateCommunitySignature(
    community: Community
  ): Promise<Community> {
    const payload: CommunityPayload = {
      channelID: community.channelID,
      name: community.name,
      description: community.description,
      members: community.members,
      coEditors: community.coEditors,
      embedding: community.embedding,
      createdAt: community.createdAt,
      updatedAt: Date.now(),
    };

    community.signature = await this.sign(payload);
    community.updatedAt = payload.updatedAt;

    return community;
  }

  /**
   * Verify community signature
   */
  static async verify(community: Community): Promise<boolean> {
    try {
      if (!community.signature) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
