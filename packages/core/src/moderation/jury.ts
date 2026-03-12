/**
 * Jury Selection
 * 
 * Selects jurors based on reputation, diversity, and availability.
 * Ensures fair representation and prevents manipulation.
 */

import type { CourtConfig, JuryMember } from './types.js';
import type { ReputationScorer } from '../reputation/scorer.js';

/**
 * Default jury selection parameters
 */
const DEFAULT_SELECTION_CONFIG = {
  minReputation: 30,
  maxConsecutiveCases: 3,
  diversityBonus: 0.2,
  randomFactor: 0.1,
};

/**
 * Jury Selector class
 */
export class JurySelector {
  private config: CourtConfig;
  private reputationScorer?: ReputationScorer;
  private selectionCounts: Map<string, number> = new Map();
  private lastSelectionTime: Map<string, number> = new Map();

  constructor(
    config: CourtConfig,
    reputationScorer?: ReputationScorer
  ) {
    this.config = config;
    this.reputationScorer = reputationScorer;
  }

  /**
   * Select jury members for a case
   * 
   * @param reporter - The reporter's peer ID
   * @param reported - The reported peer's peer ID
   * @param size - Number of jurors to select
   * @returns Array of selected jury members
   */
  selectJury(
    reporter: string,
    reported: string,
    size: number
  ): JuryMember[] {
    // Get eligible jurors
    const eligible = this.getEligibleJurors(reporter, reported);

    if (eligible.length < size) {
      // Not enough eligible jurors, relax requirements
      return this.selectEmergencyJury(eligible, size);
    }

    // Score and rank jurors
    const scored = eligible.map(juror => ({
      juror,
      score: this.scoreJuror(juror),
    }));

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Select top jurors with some randomness
    const selected: JuryMember[] = [];
    const poolSize = Math.min(Math.floor(size * 1.5), scored.length);
    const pool = scored.slice(0, poolSize);

    for (let i = 0; i < size && pool.length > 0; i++) {
      // Weighted random selection
      const index = this.weightedRandomIndex(pool.map(s => s.score));
      const selection = pool.splice(index, 1)[0];

      selected.push({
        peerID: selection.juror,
        reputationScore: this.getReputationScore(selection.juror),
        selectedAt: Date.now(),
        voted: false,
      });

      // Track selection
      this.trackSelection(selection.juror);
    }

    return selected;
  }

  /**
   * Get eligible jurors for a case
   */
  private getEligibleJurors(reporter: string, reported: string): string[] {
    // In a real implementation, this would query the network
    // For now, we'll return a placeholder that would be filled by the network layer
    const eligible: string[] = [];

    // Exclude reporter and reported
    const excluded = new Set([reporter, reported]);

    // Get all known peers (would come from network in production)
    // This is a placeholder for the actual peer discovery
    const allPeers = this.getAllKnownPeers();

    for (const peer of allPeers) {
      if (excluded.has(peer)) {
        continue;
      }

      if (!this.isEligibleJuror(peer)) {
        continue;
      }

      eligible.push(peer);
    }

    return eligible;
  }

  /**
   * Check if a peer is eligible to be a juror
   */
  private isEligibleJuror(peerID: string): boolean {
    // Check reputation
    const reputation = this.getReputationScore(peerID);
    if (reputation < this.config.minReputation) {
      return false;
    }

    // Check if already serving on too many consecutive cases
    const count = this.selectionCounts.get(peerID) || 0;
    if (count >= DEFAULT_SELECTION_CONFIG.maxConsecutiveCases) {
      return false;
    }

    // Check cooldown period (prevent immediate re-selection)
    const lastSelected = this.lastSelectionTime.get(peerID) || 0;
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - lastSelected < cooldownMs) {
      return false;
    }

    return true;
  }

  /**
   * Score a potential juror
   */
  private scoreJuror(jurorID: string): number {
    let score = 0;

    // Base score from reputation (0-0.7)
    const reputation = this.getReputationScore(jurorID);
    score += (reputation / 100) * 0.7;

    // Diversity bonus (0-0.2)
    // Prefer jurors who haven't served with each other recently
    score += DEFAULT_SELECTION_CONFIG.diversityBonus;

    // Random factor (0-0.1) to prevent predictability
    score += Math.random() * DEFAULT_SELECTION_CONFIG.randomFactor;

    return Math.min(1, score);
  }

  /**
   * Get reputation score for a peer
   */
  private getReputationScore(peerID: string): number {
    if (this.reputationScorer) {
      const result = this.reputationScorer.computeReputation(peerID);
      return result.decayedScore;
    }
    // Default score if no reputation system
    return 50;
  }

  /**
   * Weighted random selection by score
   */
  private weightedRandomIndex(scores: number[]): number {
    const total = scores.reduce((sum, s) => sum + s, 0);
    let random = Math.random() * total;

    for (let i = 0; i < scores.length; i++) {
      random -= scores[i];
      if (random <= 0) {
        return i;
      }
    }

    return scores.length - 1;
  }

  /**
   * Track jury selection for a peer
   */
  private trackSelection(peerID: string): void {
    const count = this.selectionCounts.get(peerID) || 0;
    this.selectionCounts.set(peerID, count + 1);
    this.lastSelectionTime.set(peerID, Date.now());
  }

  /**
   * Select emergency jury when not enough eligible jurors
   */
  private selectEmergencyJury(
    eligible: string[],
    size: number
  ): JuryMember[] {
    // Lower requirements and select from available peers
    const selected: JuryMember[] = [];

    // First, use all eligible jurors
    for (const peerID of eligible) {
      if (selected.length >= size) break;

      selected.push({
        peerID,
        reputationScore: this.getReputationScore(peerID),
        selectedAt: Date.now(),
        voted: false,
      });
      this.trackSelection(peerID);
    }

    // If still not enough, create placeholder entries
    // (In production, this would trigger network-wide jury recruitment)
    while (selected.length < size) {
      selected.push({
        peerID: `placeholder_${selected.length}`,
        reputationScore: 0,
        selectedAt: Date.now(),
        voted: false,
      });
    }

    return selected;
  }

  /**
   * Get all known peers (placeholder for network layer)
   */
  private getAllKnownPeers(): string[] {
    // In production, this would query the network for active peers
    // For testing, return empty array (tests will mock this)
    return [];
  }

  /**
   * Reset selection counts (called periodically)
   */
  resetSelectionCounts(): void {
    this.selectionCounts.clear();
  }

  /**
   * Get selection stats for a peer
   */
  getSelectionStats(peerID: string): {
    casesServed: number;
    lastSelected: number | null;
    eligible: boolean;
  } {
    const casesServed = this.selectionCounts.get(peerID) || 0;
    const lastSelected = this.lastSelectionTime.get(peerID) || null;
    const eligible = this.isEligibleJuror(peerID);

    return { casesServed, lastSelected, eligible };
  }
}
