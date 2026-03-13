/**
 * Stake Ranking Service
 *
 * Calculates stake-based rankings and trust bonuses.
 */

import type { StakeRankingEntry } from '../types/stake.js';
import { STAKE_CONSTANTS, SLASHING_WEIGHTS } from '../config/stakeConfig.js';
import { StakeBondModel } from '../models/StakeBond.js';

export class StakeRankingService {
  getStakeTrustBonus(bond: StakeBondModel): number {
    if (bond.status !== 'active') {
      return 0;
    }

    const amountBonus = Math.min(
      STAKE_CONSTANTS.MAX_AMOUNT_BONUS,
      bond.amountSats / STAKE_CONSTANTS.AMOUNT_BONUS_DIVISOR
    );

    const stakeAgeDays = (Date.now() - bond.lockedAt) / STAKE_CONSTANTS.LOCK_PERIOD_MS;
    const ageBonus = Math.min(
      STAKE_CONSTANTS.MAX_AGE_BONUS,
      stakeAgeDays / STAKE_CONSTANTS.AGE_BONUS_DIVISOR
    );

    return Math.min(STAKE_CONSTANTS.MAX_COMBINED_BONUS, amountBonus + ageBonus);
  }

  getRanking(
    bonds: Map<string, StakeBondModel>,
    limit: number = 100,
    reputationScores?: Map<string, number>
  ): StakeRankingEntry[] {
    const activeBonds = Array.from(bonds.values()).filter(
      b => b.status === 'active'
    );

    const now = Date.now();
    const entries = activeBonds.map(bond => {
      const stakeAge = (now - bond.lockedAt) / STAKE_CONSTANTS.LOCK_PERIOD_MS;
      const reputationScore = reputationScores?.get(bond.peerID) ?? 0;

      const combinedScore =
        (bond.amountSats / STAKE_CONSTANTS.AMOUNT_BONUS_DIVISOR) *
          SLASHING_WEIGHTS.STAKE_AMOUNT +
        Math.min(1, stakeAge / STAKE_CONSTANTS.AGE_BONUS_DIVISOR) *
          SLASHING_WEIGHTS.STAKE_AGE +
        reputationScore * SLASHING_WEIGHTS.REPUTATION;

      return {
        peerID: bond.peerID,
        stakeSats: bond.amountSats,
        stakeAge,
        reputationScore,
        combinedScore,
        rank: 0,
      };
    });

    entries.sort((a, b) => b.combinedScore - a.combinedScore);

    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries.slice(0, limit);
  }
}
