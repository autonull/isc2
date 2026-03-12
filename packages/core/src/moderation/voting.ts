/**
 * Quadratic Voting for Court Verdicts
 * 
 * Implements quadratic voting to prevent vote manipulation
 * and ensure fair verdicts.
 */

import type { Vote, Verdict } from './types.js';

/**
 * Quadratic Voting class
 */
export class QuadraticVoting {
  /**
   * Tally votes using quadratic voting
   * 
   * In quadratic voting, the cost of votes is proportional to
   * the square of the number of votes. This prevents a single
   * actor from dominating the outcome.
   * 
   * @param votes - Map of juror ID to their vote
   * @param threshold - Threshold for guilty verdict (0-1)
   * @returns Tally result with verdict and confidence
   */
  tallyVotes(
    votes: Record<string, Vote>,
    threshold: number = 0.6
  ): {
    conclusive: boolean;
    verdict: Verdict;
    guiltyVotes: number;
    notGuiltyVotes: number;
    inconclusiveVotes: number;
    confidence: number;
  } {
    const voteList = Object.values(votes);

    if (voteList.length === 0) {
      return {
        conclusive: false,
        verdict: 'inconclusive',
        guiltyVotes: 0,
        notGuiltyVotes: 0,
        inconclusiveVotes: 0,
        confidence: 0,
      };
    }

    // Count votes with confidence weighting
    let guiltyWeight = 0;
    let notGuiltyWeight = 0;
    let inconclusiveWeight = 0;
    let totalWeight = 0;

    for (const vote of voteList) {
      // Weight by confidence (higher confidence = more weight)
      const weight = vote.confidence || 0.5;

      switch (vote.decision) {
        case 'guilty':
          guiltyWeight += weight;
          break;
        case 'not_guilty':
          notGuiltyWeight += weight;
          break;
        case 'inconclusive':
          inconclusiveWeight += weight;
          break;
      }

      totalWeight += weight;
    }

    // Normalize weights
    const guiltyRatio = guiltyWeight / totalWeight;
    const notGuiltyRatio = notGuiltyWeight / totalWeight;
    const inconclusiveRatio = inconclusiveWeight / totalWeight;

    // Determine verdict
    let verdict: Verdict = 'inconclusive';
    let conclusive = false;

    if (guiltyRatio >= threshold) {
      verdict = 'guilty';
      conclusive = true;
    } else if (notGuiltyRatio >= threshold) {
      verdict = 'not_guilty';
      conclusive = true;
    } else if (inconclusiveRatio >= threshold) {
      verdict = 'inconclusive';
      conclusive = true;
    }

    // Calculate overall confidence
    const maxRatio = Math.max(guiltyRatio, notGuiltyRatio, inconclusiveRatio);
    const confidence = maxRatio;

    return {
      conclusive,
      verdict,
      guiltyVotes: Math.round(guiltyWeight),
      notGuiltyVotes: Math.round(notGuiltyWeight),
      inconclusiveVotes: Math.round(inconclusiveWeight),
      confidence,
    };
  }

  /**
   * Calculate vote credits for a juror
   * 
   * In quadratic voting, jurors have credits to spend.
   * The cost of N votes is N^2 credits.
   * 
   * @param votesWanted - Number of votes to cast
   * @returns Cost in credits
   */
  calculateVoteCost(_baseCredits: number, votesWanted: number): number {
    // Quadratic cost: cost = votes^2
    return votesWanted * votesWanted;
  }

  /**
   * Get maximum votes affordable with given credits
   */
  getMaxAffordableVotes(credits: number): number {
    // Inverse of quadratic: votes = sqrt(credits)
    return Math.floor(Math.sqrt(credits));
  }

  /**
   * Compute vote power with quadratic weighting
   * 
   * @param votes - Number of votes
   * @returns Weighted vote power
   */
  computeVotePower(votes: number): number {
    return votes * votes;
  }

  /**
   * Check if vote distribution is suspicious
   * 
   * Detects potential vote manipulation by checking
   * if votes are unusually concentrated.
   * 
   * @param votes - Array of votes
   * @returns Whether distribution is suspicious
   */
  detectSuspiciousDistribution(votes: Vote[]): {
    suspicious: boolean;
    reason?: string;
    concentrationScore: number;
  } {
    if (votes.length < 3) {
      return { suspicious: false, concentrationScore: 0 };
    }

    // Check confidence distribution
    const confidences = votes.map(v => v.confidence || 0.5);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
    const stdDev = Math.sqrt(variance);

    // Very low variance with high confidence might indicate coordination
    if (stdDev < 0.1 && avgConfidence > 0.9) {
      return {
        suspicious: true,
        reason: 'Unusually uniform high confidence',
        concentrationScore: 1 - stdDev,
      };
    }

    // Check decision distribution
    const decisions = votes.map(v => v.decision);
    const decisionCounts: Record<string, number> = {};
    for (const d of decisions) {
      decisionCounts[d] = (decisionCounts[d] || 0) + 1;
    }

    const maxCount = Math.max(...Object.values(decisionCounts));
    const concentrationRatio = maxCount / decisions.length;

    // Very high concentration might indicate manipulation
    if (concentrationRatio > 0.9 && votes.length >= 5) {
      return {
        suspicious: true,
        reason: 'Highly concentrated decisions',
        concentrationScore: concentrationRatio,
      };
    }

    return {
      suspicious: false,
      concentrationScore: concentrationRatio,
    };
  }

  /**
   * Calculate reputation rewards for jurors
   * 
   * Jurors who vote with the majority get small reputation rewards.
   * Jurors who vote against the majority with high confidence
   * get larger rewards if they were correct (independent thinking).
   * 
   * @param votes - All votes cast
   * @param finalVerdict - The final verdict reached
   * @returns Map of juror ID to reputation change
   */
  calculateReputationRewards(
    votes: Record<string, Vote>,
    finalVerdict: Verdict
  ): Record<string, number> {
    const rewards: Record<string, number> = {};

    // Count majority decision
    const decisionCounts: Record<string, number> = { guilty: 0, not_guilty: 0, inconclusive: 0 };
    for (const vote of Object.values(votes)) {
      decisionCounts[vote.decision]++;
    }

    const majorityDecision = Object.entries(decisionCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as Verdict;

    for (const [jurorID, vote] of Object.entries(votes)) {
      let reward = 0;

      // Base participation reward
      reward += 0.5;

      // Majority alignment reward
      if (vote.decision === majorityDecision) {
        reward += 1.0;
      }

      // Independent thinking bonus
      // If juror voted against majority with high confidence AND was correct
      if (vote.decision !== majorityDecision && vote.confidence > 0.8) {
        if (vote.decision === finalVerdict) {
          reward += 3.0; // Big bonus for correct independent judgment
        }
      }

      // Confidence calibration
      // Reward appropriate confidence levels
      const expectedConfidence = vote.decision === finalVerdict ? 0.8 : 0.3;
      const confidenceDiff = Math.abs(vote.confidence - expectedConfidence);
      reward -= confidenceDiff * 0.5; // Penalty for miscalibrated confidence

      rewards[jurorID] = Math.max(0, reward);
    }

    return rewards;
  }
}
