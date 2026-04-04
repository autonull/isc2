/* eslint-disable */
/**
 * Stake Statistics Service
 *
 * Calculates stake statistics and metrics.
 */

import type { StakeStats } from '../types/stake.js';
import type { StakeBondModel } from '../models/StakeBond.js';
import type { WithdrawalQueue } from '../models/WithdrawalQueue.js';

export class StakeStatsService {
  getStats(
    bonds: Map<string, StakeBondModel>,
    withdrawalQueue: WithdrawalQueue
  ): StakeStats {
    const activeBonds = Array.from(bonds.values()).filter(
      b => b.status === 'active'
    );

    const totalStaked = activeBonds.reduce((sum, b) => sum + b.amountSats, 0);
    const totalSlashed = activeBonds.reduce((sum, b) => sum + b.slashedAmount, 0);

    const stakes = activeBonds.map(b => b.amountSats);
    const avgStake = stakes.length > 0 ? totalStaked / stakes.length : 0;
    const medianStake =
      stakes.length > 0
        ? stakes.sort((a, b) => a - b)[Math.floor(stakes.length / 2)]
        : 0;

    return {
      totalStakedSats: totalStaked,
      totalSlashedSats: totalSlashed,
      activeBonds: activeBonds.length,
      pendingWithdrawals: withdrawalQueue.pendingCount,
      averageStakeSats: avgStake,
      medianStakeSats: medianStake,
    };
  }
}
