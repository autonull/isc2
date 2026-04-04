/* eslint-disable */
/**
 * Interaction Service
 *
 * Manages interaction recording and weight calculations.
 */

import { recordInteraction } from '../../social/graph.ts';
import { INTERACTION_WEIGHTS } from '../config/reputationConfig.ts';

export class InteractionService {
  /**
   * Get interaction weight based on type
   */
  static getWeight(type: string): number {
    const weights = INTERACTION_WEIGHTS as unknown as Record<string, number>;
    return weights[type] ?? 1;
  }

  /**
   * Record a weighted interaction
   */
  static async record(
    peerID: string,
    type: string,
    customWeight?: number
  ): Promise<void> {
    const weight = customWeight ?? this.getWeight(type);
    await recordInteraction(peerID, type, weight);
  }

  /**
   * Get all interaction weights
   */
  static getAllWeights(): Record<string, number> {
    return { ...INTERACTION_WEIGHTS };
  }
}
