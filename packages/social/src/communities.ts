/* eslint-disable */
/**
 * Community Service
 *
 * Manages community lifecycle and operations.
 */

import { cosineSimilarity } from '@isc/core';
import type { SocialStorage, SocialIdentity, SocialNetwork } from './adapters/interfaces';
import type { Community } from './types';

export interface CommunityService {
  createCommunity(
    name: string,
    description: string,
    initialMembers: string[],
    coEditors: string[]
  ): Promise<Community>;
  getCommunity(channelID: string): Promise<Community | null>;
  getAllCommunities(): Promise<Community[]>;
  getUserCommunities(): Promise<Community[]>;
  joinCommunity(channelID: string): Promise<void>;
  leaveCommunity(channelID: string): Promise<void>;
  addCoEditor(channelID: string, newEditor: string): Promise<void>;
  updateCommunity(channelID: string, updates: { name?: string; description?: string }): Promise<void>;
  queryByEmbedding(embedding: number[], limit?: number): Promise<Community[]>;
  computeSemanticNeighborhood(channelID: string, radius?: number): Promise<Community[]>;
  verifyCommunity(community: Community): Promise<boolean>;
}

export const COMMUNITY_CONFIG = {
  defaultTTL: 86400 * 7,
  minMembers: 1,
  maxCoEditors: 10,
  descriptionMinLength: 10,
} as const;

export const COMMUNITY_DHT_PREFIXES = {
  COMMUNITY: '/isc/community',
  BUCKET: '/isc/community/bucket',
} as const;

const EMBEDDING_DIMENSION = 384;

export function createCommunityService(
  storage: SocialStorage,
  identity: SocialIdentity,
  network?: SocialNetwork
): CommunityService {
  async function signCommunity(community: Omit<Community, 'signature'>): Promise<Uint8Array> {
    const payload = new TextEncoder().encode(JSON.stringify({
      channelID: community.channelID,
      name: community.name,
      description: community.description,
      members: community.members,
      coEditors: community.coEditors,
      embedding: community.embedding,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
    }));
    return identity.sign(payload);
  }

  function computeEmbedding(text: string): number[] {
    const words = text.toLowerCase().match(/\w+/g) || [];
    const embedding = new Array<number>(EMBEDDING_DIMENSION).fill(0);

    for (let i = 0; i < Math.min(words.length, EMBEDDING_DIMENSION); i++) {
      let hash = 0;
      for (const char of words[i]) {
        hash = ((hash << 5) - hash) + char.charCodeAt(0);
        hash |= 0;
      }
      embedding[i] += Math.abs(hash) / 1000000;
    }

    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? embedding.map((v) => v / norm) : embedding;
  }

  return {
    async createCommunity(
      name: string,
      description: string,
      initialMembers: string[],
      coEditors: string[]
    ): Promise<Community> {
      const peerID = await identity.getPeerId();
      const members = [...new Set([...initialMembers, peerID])];
      const editors = [...new Set([...coEditors, peerID])];

      const embedding = computeEmbedding(`${name} ${description}`);

      const community: Omit<Community, 'signature'> = {
        channelID: `community-${Date.now()}-${peerID.slice(0, 8)}`,
        name,
        description,
        members,
        coEditors: editors,
        embedding,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Validate
      if (members.length < COMMUNITY_CONFIG.minMembers) {
        throw new Error(`Community must have at least ${COMMUNITY_CONFIG.minMembers} member(s)`);
      }
      if (description.length < COMMUNITY_CONFIG.descriptionMinLength) {
        throw new Error(`Description must be at least ${COMMUNITY_CONFIG.descriptionMinLength} characters`);
      }

      const signature = await signCommunity(community);
      const signedCommunity: Community = { ...community, signature };

      await storage.saveCommunity(signedCommunity);

      // Announce to network
      if (network) {
        try {
          await network.announceFollow(peerID, signedCommunity.channelID, Date.now());
        } catch (error) {
          console.warn('Failed to announce community to network', error);
        }
      }

      return signedCommunity;
    },

    async getCommunity(channelID: string): Promise<Community | null> {
      return storage.getCommunity(channelID);
    },

    async getAllCommunities(): Promise<Community[]> {
      return storage.getCommunities();
    },

    async getUserCommunities(): Promise<Community[]> {
      const peerID = await identity.getPeerId();
      const all = await storage.getCommunities();
      return all.filter((c) => c.members.includes(peerID));
    },

    async joinCommunity(channelID: string): Promise<void> {
      const community = await storage.getCommunity(channelID);
      if (!community) {
        throw new Error(`Community ${channelID} not found`);
      }

      const peerID = await identity.getPeerId();
      if (!community.members.includes(peerID)) {
        community.members.push(peerID);
        community.updatedAt = Date.now();
        community.signature = await signCommunity(community);
        await storage.saveCommunity(community);
      }
    },

    async leaveCommunity(channelID: string): Promise<void> {
      const community = await storage.getCommunity(channelID);
      if (!community) {return;}

      const peerID = await identity.getPeerId();
      community.members = community.members.filter((m) => m !== peerID);
      community.updatedAt = Date.now();
      community.signature = await signCommunity(community);
      await storage.saveCommunity(community);
    },

    async addCoEditor(channelID: string, newEditor: string): Promise<void> {
      const community = await storage.getCommunity(channelID);
      if (!community) {
        throw new Error(`Community ${channelID} not found`);
      }

      const peerID = await identity.getPeerId();
      if (!community.coEditors.includes(peerID)) {
        throw new Error('Only co-editors can add new co-editors');
      }

      if (!community.coEditors.includes(newEditor)) {
        if (community.coEditors.length >= COMMUNITY_CONFIG.maxCoEditors) {
          throw new Error(`Cannot exceed ${COMMUNITY_CONFIG.maxCoEditors} co-editors`);
        }
        community.coEditors.push(newEditor);
        community.updatedAt = Date.now();
        community.signature = await signCommunity(community);
        await storage.saveCommunity(community);
      }
    },

    async updateCommunity(
      channelID: string,
      updates: { name?: string; description?: string }
    ): Promise<void> {
      const community = await storage.getCommunity(channelID);
      if (!community) {
        throw new Error(`Community ${channelID} not found`);
      }

      const peerID = await identity.getPeerId();
      if (!community.coEditors.includes(peerID)) {
        throw new Error('Only co-editors can update community');
      }

      if (updates.name) {community.name = updates.name;}
      if (updates.description) {
        if (updates.description.length < COMMUNITY_CONFIG.descriptionMinLength) {
          throw new Error(`Description must be at least ${COMMUNITY_CONFIG.descriptionMinLength} characters`);
        }
        community.description = updates.description;
      }

      community.embedding = computeEmbedding(`${community.name} ${community.description}`);
      community.updatedAt = Date.now();
      community.signature = await signCommunity(community);

      await storage.saveCommunity(community);
    },

    async queryByEmbedding(embedding: number[], limit: number = 20): Promise<Community[]> {
      const all = await storage.getCommunities();

      return all
        .map((c) => ({
          community: c,
          score: cosineSimilarity(embedding, c.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.community);
    },

    async computeSemanticNeighborhood(channelID: string, radius: number = 0.7): Promise<Community[]> {
      const community = await storage.getCommunity(channelID);
      if (!community) {return [];}

      const all = await storage.getCommunities();
      return all
        .filter((c) => c.channelID !== channelID)
        .filter((c) => cosineSimilarity(community.embedding, c.embedding) >= radius);
    },

    verifyCommunity(community: Community): Promise<boolean> {
      // Verify community signature would require public key of creator
      // For now, just check that signature exists
      return Promise.resolve(!!community.signature && community.signature.length > 0);
    },
  };
}
