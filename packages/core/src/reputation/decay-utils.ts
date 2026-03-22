/**
 * Decay Utilities for Reputation System
 *
 * Handles exponential decay calculations for reputation scores.
 */

export interface DecayInteraction {
  id: string;
  peerID: string;
  type: string;
  timestamp: number;
  baseWeight: number;
  decayedWeight: number;
  ageInDays: number;
}

export interface DecayCurvePoint {
  day: number;
  score: number;
  rawScore: number;
}

export class DecayCalculator {
  /**
   * Calculate exponential decay factor based on age and half-life
   *
   * Formula: decay = 0.5 ^ (age / halfLife)
   */
  static calculateDecayFactor(ageInDays: number, halfLifeDays: number): number {
    if (ageInDays <= 0) return 1.0;
    if (halfLifeDays <= 0) return 0.0;

    return Math.pow(0.5, ageInDays / halfLifeDays);
  }

  /**
   * Apply decay to an interaction based on its age
   */
  static applyDecay(
    timestamp: number,
    baseWeight: number,
    halfLifeDays: number
  ): { decayedWeight: number; ageInDays: number; decayFactor: number } {
    const now = Date.now();
    const ageInMs = now - timestamp;
    const ageInDays = ageInMs / (24 * 60 * 60 * 1000);

    const decayFactor = this.calculateDecayFactor(ageInDays, halfLifeDays);
    const decayedWeight = baseWeight * decayFactor;

    return { decayedWeight, ageInDays, decayFactor };
  }

  /**
   * Apply decay to multiple interactions
   */
  static applyDecayToCurve(
    interactions: Array<{ timestamp: number; weight: number; peerID: string; type: string }>,
    halfLifeDays: number
  ): DecayInteraction[] {
    return interactions.map((interaction) => {
      const { decayedWeight, ageInDays } = this.applyDecay(
        interaction.timestamp,
        interaction.weight,
        halfLifeDays
      );

      return {
        id: `decay_${crypto.randomUUID()}`,
        peerID: interaction.peerID,
        type: interaction.type,
        timestamp: interaction.timestamp,
        baseWeight: interaction.weight,
        decayedWeight,
        ageInDays,
      };
    });
  }

  /**
   * Project future reputation decay curve
   */
  static projectDecayCurve(
    currentScore: number,
    halfLifeDays: number,
    daysToProject: number
  ): DecayCurvePoint[] {
    const curve: DecayCurvePoint[] = [];

    for (let day = 0; day <= daysToProject; day++) {
      const projectedScore = currentScore * this.calculateDecayFactor(day, halfLifeDays);

      curve.push({
        day,
        score: Math.max(projectedScore, 0),
        rawScore: currentScore,
      });
    }

    return curve;
  }

  /**
   * Calculate time until reputation reaches a target score
   */
  static timeToReachScore(currentScore: number, targetScore: number, halfLifeDays: number): number {
    if (currentScore <= targetScore) {
      return 0;
    }

    const ratio = currentScore / targetScore;
    const days = halfLifeDays * Math.log2(ratio);

    return Math.max(0, days);
  }
}
