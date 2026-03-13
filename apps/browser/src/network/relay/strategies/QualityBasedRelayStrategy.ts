/**
 * Quality-Based Relay Selection Strategy
 *
 * Selects relays based on quality score with load balancing.
 */

import type { RelaySelectionStrategy } from './RelaySelectionStrategy.js';
import type { RelayCandidate } from '../types/relay.js';
import { RELAY_CONSTANTS } from '../config/relayConfig.js';

export class QualityBasedRelayStrategy implements RelaySelectionStrategy {
  /**
   * Rank candidates by quality score
   */
  rank(candidates: RelayCandidate[]): RelayCandidate[] {
    return [...candidates].sort((a, b) => b.qualityScore - a.qualityScore);
  }

  /**
   * Select best relay considering recent usage
   */
  select(candidates: RelayCandidate[]): RelayCandidate | undefined {
    if (candidates.length === 0) return undefined;

    const ranked = this.rank(candidates);
    const topCandidates = ranked.slice(0, 3);

    const now = Date.now();
    const oneMinuteAgo = now - RELAY_CONSTANTS.ONE_MINUTE_MS;

    // Prefer candidates not used in the last minute for load balancing
    for (const candidate of topCandidates) {
      if (!candidate.lastUsed || candidate.lastUsed < oneMinuteAgo) {
        return candidate;
      }
    }

    // Fall back to highest quality
    return topCandidates[0];
  }
}
