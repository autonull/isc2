/**
 * Match Service
 *
 * Handles match scoring and ranking algorithms.
 */

import { cosineSimilarity } from '@isc/core';
import { DISCOVER_CONFIG, SIMILARITY_THRESHOLDS } from '../config/discoverConfig.js';
import type { Match, PeerInfo, MatchGroup, ProximityLevel } from '../types/discover.js';

export class MatchService {
  /**
   * Compute similarity score between vectors
   */
  computeSimilarity(vecA: number[], vecB: number[]): number {
    return cosineSimilarity(vecA, vecB);
  }

  /**
   * Filter and rank matches by similarity
   */
  rankMatches(
    peers: PeerInfo[],
    queryVec: number[],
    threshold: number = DISCOVER_CONFIG.similarityThreshold
  ): Match[] {
    return peers
      .map((peer) => ({
        peerId: peer.peerId,
        similarity: this.computeSimilarity(queryVec, peer.vec),
        channelID: peer.channelID,
        model: peer.model,
        vec: peer.vec,
        relTag: peer.relTag,
        updatedAt: peer.updatedAt,
        description: `Peer with ${peer.model}`,
      }))
      .filter((match) => match.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, DISCOVER_CONFIG.maxMatches);
  }

  /**
   * Group matches by proximity level
   */
  groupByProximity(matches: Match[]): Record<ProximityLevel, Match[]> {
    return {
      VERY_CLOSE: matches.filter(
        (m) => m.similarity >= SIMILARITY_THRESHOLDS.VERY_CLOSE
      ),
      NEARBY: matches.filter(
        (m) =>
          m.similarity >= SIMILARITY_THRESHOLDS.NEARBY &&
          m.similarity < SIMILARITY_THRESHOLDS.VERY_CLOSE
      ),
      ORBITING: matches.filter(
        (m) =>
          m.similarity >= SIMILARITY_THRESHOLDS.ORBITING &&
          m.similarity < SIMILARITY_THRESHOLDS.NEARBY
      ),
      DISTANT: matches.filter(
        (m) => m.similarity < SIMILARITY_THRESHOLDS.ORBITING
      ),
    };
  }

  /**
   * Get proximity level for similarity score
   */
  getProximityLevel(similarity: number): ProximityLevel {
    if (similarity >= SIMILARITY_THRESHOLDS.VERY_CLOSE) return 'VERY_CLOSE';
    if (similarity >= SIMILARITY_THRESHOLDS.NEARBY) return 'NEARBY';
    if (similarity >= SIMILARITY_THRESHOLDS.ORBITING) return 'ORBITING';
    return 'DISTANT';
  }

  /**
   * Get proximity label for display
   */
  getProximityLabel(similarity: number): string {
    const level = this.getProximityLevel(similarity);
    return level;
  }

  /**
   * Format similarity as signal bars
   */
  formatSignalBars(similarity: number): string {
    if (similarity >= 0.85) return '▐▌▐▌▐';
    if (similarity >= 0.70) return '▐▌▐▌░';
    if (similarity >= 0.55) return '▐▌░░░';
    return '░░░░░';
  }

  /**
   * Check if match should be filtered out
   */
  shouldFilterMatch(
    peer: PeerInfo,
    ownPeerId: string,
    modelFilter: string = 'all-MiniLM-L6'
  ): boolean {
    // Filter self
    if (peer.peerId === ownPeerId) return true;

    // Filter by model compatibility
    if (!peer.model.includes(modelFilter)) return true;

    return false;
  }

  /**
   * Deduplicate matches by peer ID
   */
  deduplicateMatches(matches: Match[]): Match[] {
    const seen = new Set<string>();
    return matches.filter((match) => {
      if (seen.has(match.peerId)) return false;
      seen.add(match.peerId);
      return true;
    });
  }
}
