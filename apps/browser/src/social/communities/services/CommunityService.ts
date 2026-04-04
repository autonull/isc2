/* eslint-disable */
/**
 * Community Service
 *
 * Manages community lifecycle and operations.
 */

import { lshHash } from '@isc/core';
import { DelegationClient } from '@isc/delegation';
import { getPeerID } from '../../../identity/index.ts';
import { CommunityRepository } from './CommunityRepository.ts';
import { CommunitySigningService } from './CommunitySigningService.ts';
import { validateCommunity } from '../utils/communityValidator.ts';
import { COMMUNITY_CONFIG, COMMUNITY_DHT_PREFIXES } from '../config/communityConfig.ts';
import type { Community, CommunityPayload } from '../types/community.ts';

export class CommunityService {
  private repository: CommunityRepository;
  private static instance: CommunityService;

  private constructor() {
    this.repository = new CommunityRepository();
  }

  static getInstance(): CommunityService {
    if (!CommunityService.instance) {
      CommunityService.instance = new CommunityService();
    }
    return CommunityService.instance;
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    await this.repository.initialize();
  }

  /**
   * Create a new community
   */
  async createCommunity(
    name: string,
    description: string,
    initialMembers: string[],
    coEditors: string[]
  ): Promise<Community> {
    const peerID = await getPeerID();
    const members = [...new Set([...initialMembers, peerID])];
    const editors = [...new Set([...coEditors, peerID])];

    // Embedding is optional - use fallback if model not available
    const embedding = await this.computeEmbedding(name, description);

    const payload: CommunityPayload = {
      channelID: `community-${Date.now()}-${peerID.slice(0, 8)}`,
      name,
      description,
      members,
      coEditors: editors,
      embedding,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const validation = validateCommunity(payload);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const community = await CommunitySigningService.createSignedCommunity(payload);
    await this.repository.save(community);
    await this.announceCommunity(community);

    return community;
  }

  /**
   * Get community by ID
   */
  async getCommunity(channelID: string): Promise<Community | null> {
    return this.repository.get(channelID);
  }

  /**
   * Get all communities for current user
   */
  async getUserCommunities(): Promise<Community[]> {
    const peerID = await getPeerID();
    return this.repository.findByMember(peerID);
  }

  /**
   * Join a community
   */
  async joinCommunity(channelID: string): Promise<void> {
    const community = await this.repository.get(channelID);
    if (!community) {
      throw new Error(`Community ${channelID} not found`);
    }

    const peerID = await getPeerID();
    if (!community.members.includes(peerID)) {
      community.members.push(peerID);
      await this.updateAndSignCommunity(community);
    }
  }

  /**
   * Leave a community
   */
  async leaveCommunity(channelID: string): Promise<void> {
    const community = await this.repository.get(channelID);
    if (!community) return;

    const peerID = await getPeerID();
    community.members = community.members.filter((m) => m !== peerID);
    await this.updateAndSignCommunity(community);
  }

  /**
   * Add co-editor to community
   */
  async addCoEditor(channelID: string, newEditor: string): Promise<void> {
    const community = await this.repository.get(channelID);
    if (!community) {
      throw new Error(`Community ${channelID} not found`);
    }

    const peerID = await getPeerID();
    if (!community.coEditors.includes(peerID)) {
      throw new Error('Only co-editors can add new co-editors');
    }

    if (!community.coEditors.includes(newEditor)) {
      community.coEditors.push(newEditor);
      await this.updateAndSignCommunity(community);
    }
  }

  /**
   * Update community details
   */
  async updateCommunity(
    channelID: string,
    updates: { name?: string; description?: string }
  ): Promise<void> {
    const community = await this.repository.get(channelID);
    if (!community) {
      throw new Error(`Community ${channelID} not found`);
    }

    const peerID = await getPeerID();
    if (!community.coEditors.includes(peerID)) {
      throw new Error('Only co-editors can update community');
    }

    if (updates.name) community.name = updates.name;
    if (updates.description) community.description = updates.description;

    community.embedding = await this.computeEmbedding(
      community.name,
      community.description
    );

    await this.updateAndSignCommunity(community);
  }

  /**
   * Query communities by embedding similarity
   */
  async queryByEmbedding(
    embedding: number[],
    limit: number = 20
  ): Promise<Community[]> {
    const { cosineSimilarity } = await import('@isc/core');
    const all = await this.repository.getAll();

    return all
      .map((c) => ({
        community: c,
        score: cosineSimilarity(embedding, c.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.community);
  }

  /**
   * Compute semantic neighborhood
   */
  async computeSemanticNeighborhood(
    channelID: string,
    radius: number = 0.7
  ): Promise<Community[]> {
    const { cosineSimilarity } = await import('@isc/core');
    const community = await this.repository.get(channelID);
    if (!community) return [];

    const all = await this.repository.getAll();
    return all
      .filter((c) => c.channelID !== channelID)
      .filter(
        (c) => cosineSimilarity(community.embedding, c.embedding) >= radius
      );
  }

  /**
   * Verify community signature
   */
  async verifyCommunity(community: Community): Promise<boolean> {
    return CommunitySigningService.verify(community);
  }

  /**
   * Update and sign community
   */
  private async updateAndSignCommunity(community: Community): Promise<void> {
    await CommunitySigningService.updateCommunitySignature(community);
    await this.repository.save(community);
    await this.announceCommunity(community);
  }

  /**
   * Announce community to DHT
   */
  private async announceCommunity(community: Community): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    await client.announce(
      `${COMMUNITY_DHT_PREFIXES.COMMUNITY}/${community.channelID}`,
      new Uint8Array(),
      COMMUNITY_CONFIG.defaultTTL
    );

    const hashes = lshHash(community.embedding, 'community-384', 3);
    for (const hash of hashes) {
      await client.announce(
        `${COMMUNITY_DHT_PREFIXES.BUCKET}/${hash}`,
        new Uint8Array(),
        COMMUNITY_CONFIG.defaultTTL
      );
    }
  }

  /**
   * Compute embedding from text
   * Falls back to word-hash based embedding if model is not available
   */
  private async computeEmbedding(
    name: string,
    description: string
  ): Promise<number[]> {
    try {
      // Lazy import EmbeddingService to avoid module-level initialization
      const { EmbeddingService } = await import('../../../identity/embedding-service.ts');
      const model = await EmbeddingService.loadModel();
      return model.embed(`${name} ${description}`);
    } catch (err) {
      console.warn('Embedding model not available, using fallback', err);
      // Fallback: simple hash-based embedding
      return this.computeFallbackEmbedding(`${name} ${description}`);
    }
  }

  /**
   * Fallback embedding using simple word hashing
   */
  private computeFallbackEmbedding(text: string): number[] {
    const words = text.toLowerCase().match(/\w+/g) || [];
    const embedding = new Array(384).fill(0);
    
    for (let i = 0; i < words.length && i < 384; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = ((hash << 5) - hash) + word.charCodeAt(j);
        hash = hash & hash;
      }
      embedding[i % 384] += Math.abs(hash) / 1000000;
    }
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < 384; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }
}
