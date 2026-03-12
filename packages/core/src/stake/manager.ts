/**
 * Stake Manager
 * 
 * Manages stake bonds, locking, unlocking, and slashing.
 * Integrates with Lightning Network for payments.
 */

import type {
  StakeBond,
  StakeConfig,
  StakeOperationResult,
  StakeInvoice,
  WithdrawalRequest,
  StakeStats,
  StakeRankingEntry,
  SlashingEvent,
  SlashingReason,
} from './types.js';
import { LightningAdapter } from './lightning.js';
import { SlashingConditions } from './slashing.js';

/**
 * Default stake configuration
 */
const DEFAULT_CONFIG: StakeConfig = {
  minStakeSats: 10000,        // ~$10 USD
  lockPeriodDays: 30,
  slashingEnabled: true,
  maxSlashingPercent: 100,
  gracePeriodDays: 7,
};

/**
 * Stake Manager class
 */
export class StakeManager {
  private config: StakeConfig;
  private bonds: Map<string, StakeBond> = new Map();
  private withdrawalQueue: Map<string, WithdrawalRequest> = new Map();
  private slashingHistory: SlashingEvent[] = [];
  private lightning?: LightningAdapter;
  private slashingConditions: SlashingConditions;

  constructor(
    config: Partial<StakeConfig> = {},
    lightning?: LightningAdapter
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lightning = lightning;
    this.slashingConditions = new SlashingConditions(this.config);
  }

  /**
   * Set Lightning adapter
   */
  setLightningAdapter(lightning: LightningAdapter): void {
    this.lightning = lightning;
  }

  /**
   * Generate stake invoice for a peer
   */
  async generateStakeInvoice(
    peerID: string,
    amountSats?: number
  ): Promise<StakeInvoice> {
    if (!this.lightning) {
      throw new Error('Lightning adapter not configured');
    }

    const amount = amountSats || this.config.minStakeSats;

    if (amount < this.config.minStakeSats) {
      throw new Error(`Minimum stake is ${this.config.minStakeSats} sats`);
    }

    const invoice = await this.lightning.createInvoice({
      amountSats: amount,
      memo: `ISC Stake Bond - ${peerID.slice(0, 8)}`,
      expirySeconds: 3600, // 1 hour
    });

    return {
      invoice: invoice.bolt11,
      amountSats: amount,
      expiry: Date.now() + 3600 * 1000,
      paymentHash: invoice.paymentHash,
      peerID,
    };
  }

  /**
   * Lock stake for a peer
   */
  async lockStake(
    peerID: string,
    amountSats: number,
    paymentHash: string
  ): Promise<StakeOperationResult> {
    // Check minimum stake
    if (amountSats < this.config.minStakeSats) {
      return {
        success: false,
        error: `Minimum stake is ${this.config.minStakeSats} sats`,
      };
    }

    // Check if already has active bond
    const existingBond = this.bonds.get(peerID);
    if (existingBond && existingBond.status === 'active') {
      return {
        success: false,
        error: 'Peer already has active stake bond',
      };
    }

    // Verify payment with Lightning
    if (this.lightning) {
      const paymentValid = await this.lightning.verifyPayment(paymentHash);
      if (!paymentValid) {
        return {
          success: false,
          error: 'Payment verification failed',
        };
      }
    }

    // Create bond
    const now = Date.now();
    const lockPeriodMs = this.config.lockPeriodDays * 24 * 60 * 60 * 1000;

    const bond: StakeBond = {
      peerID,
      amountSats,
      lockedAt: now,
      unlockableAt: now + lockPeriodMs,
      slashedAmount: 0,
      status: 'active',
      txHash: paymentHash,
    };

    this.bonds.set(peerID, bond);

    return {
      success: true,
      bond,
      txHash: paymentHash,
    };
  }

  /**
   * Request stake withdrawal
   */
  async requestWithdrawal(
    peerID: string,
    destination: string
  ): Promise<StakeOperationResult> {
    const bond = this.bonds.get(peerID);

    if (!bond) {
      return {
        success: false,
        error: 'No stake bond found',
      };
    }

    if (bond.status !== 'active') {
      return {
        success: false,
        error: `Cannot withdraw stake with status: ${bond.status}`,
      };
    }

    const now = Date.now();
    if (now < bond.unlockableAt) {
      const daysLeft = Math.ceil((bond.unlockableAt - now) / (24 * 60 * 60 * 1000));
      return {
        success: false,
        error: `Stake locked for ${daysLeft} more days`,
      };
    }

    const withdrawableAmount = bond.amountSats - bond.slashedAmount;
    if (withdrawableAmount <= 0) {
      return {
        success: false,
        error: 'No stake available for withdrawal',
      };
    }

    // Create withdrawal request
    const request: WithdrawalRequest = {
      peerID,
      amountSats: withdrawableAmount,
      destination,
      requestedAt: now,
      status: 'pending',
    };

    this.withdrawalQueue.set(`${peerID}:${now}`, request);
    bond.status = 'unlocking';

    return {
      success: true,
    };
  }

  /**
   * Process withdrawal (admin/lightning operation)
   */
  async processWithdrawal(
    requestKey: string,
    _paymentPreimage: string
  ): Promise<StakeOperationResult> {
    const request = this.withdrawalQueue.get(requestKey);

    if (!request) {
      return {
        success: false,
        error: 'Withdrawal request not found',
      };
    }

    if (!this.lightning) {
      return {
        success: false,
        error: 'Lightning adapter not configured',
      };
    }

    // Send payment
    const paymentResult = await this.lightning.sendPayment({
      invoice: request.destination,
      amountSats: request.amountSats,
    });

    if (!paymentResult.success) {
      return {
        success: false,
        error: paymentResult.error,
      };
    }

    // Update request status
    request.status = 'completed';

    // Remove bond
    this.bonds.delete(request.peerID);

    return {
      success: true,
    };
  }

  /**
   * Slash stake for malicious behavior
   */
  slashStake(
    peerID: string,
    reason: SlashingReason,
    amountSats: number,
    evidence: string[],
    decidedBy: string[],
    signature: Uint8Array
  ): StakeOperationResult {
    const bond = this.bonds.get(peerID);

    if (!bond) {
      return {
        success: false,
        error: 'No stake bond found',
      };
    }

    if (!this.config.slashingEnabled) {
      return {
        success: false,
        error: 'Slashing is disabled',
      };
    }

    // Check slashing conditions
    const validReason = this.slashingConditions.validateReason(reason);
    if (!validReason) {
      return {
        success: false,
        error: `Invalid slashing reason: ${reason}`,
      };
    }

    // Calculate slash amount
    const remainingStake = bond.amountSats - bond.slashedAmount;
    const maxSlashable = (this.config.maxSlashingPercent / 100) * bond.amountSats;
    const actualSlashAmount = Math.min(amountSats, remainingStake, maxSlashable);

    if (actualSlashAmount <= 0) {
      return {
        success: false,
        error: 'No stake available to slash',
      };
    }

    // Update bond
    bond.slashedAmount += actualSlashAmount;
    if (bond.slashedAmount >= bond.amountSats) {
      bond.status = 'slashed';
    }

    // Create slashing event
    const event: SlashingEvent = {
      eventID: `slash_${crypto.randomUUID()}`,
      peerID,
      amountSats: actualSlashAmount,
      reason,
      evidence,
      decidedBy,
      timestamp: Date.now(),
      signature,
    };

    this.slashingHistory.push(event);

    return {
      success: true,
      bond,
    };
  }

  /**
   * Get stake bond for a peer
   */
  getBond(peerID: string): StakeBond | undefined {
    return this.bonds.get(peerID);
  }

  /**
   * Check if peer has active stake
   */
  hasActiveStake(peerID: string): boolean {
    const bond = this.bonds.get(peerID);
    return bond?.status === 'active';
  }

  /**
   * Get stake-based trust bonus
   * 
   * Returns 0-0.2 bonus based on stake amount and age
   */
  getStakeTrustBonus(peerID: string): number {
    const bond = this.bonds.get(peerID);

    if (!bond || bond.status !== 'active') {
      return 0;
    }

    // Amount bonus (0-0.1)
    const amountBonus = Math.min(0.1, bond.amountSats / 1000000); // Max at 1M sats

    // Age bonus (0-0.1)
    const now = Date.now();
    const stakeAgeDays = (now - bond.lockedAt) / (24 * 60 * 60 * 1000);
    const ageBonus = Math.min(0.1, stakeAgeDays / 90); // Max at 90 days

    return amountBonus + ageBonus;
  }

  /**
   * Get stake statistics
   */
  getStats(): StakeStats {
    const activeBonds = Array.from(this.bonds.values())
      .filter(b => b.status === 'active');

    const totalStaked = activeBonds.reduce((sum, b) => sum + b.amountSats, 0);
    const totalSlashed = activeBonds.reduce((sum, b) => sum + b.slashedAmount, 0);

    const stakes = activeBonds.map(b => b.amountSats);
    const avgStake = stakes.length > 0 ? totalStaked / stakes.length : 0;
    const medianStake = stakes.length > 0
      ? stakes.sort((a, b) => a - b)[Math.floor(stakes.length / 2)]
      : 0;

    const pendingWithdrawals = Array.from(this.withdrawalQueue.values())
      .filter(w => w.status === 'pending').length;

    return {
      totalStakedSats: totalStaked,
      totalSlashedSats: totalSlashed,
      activeBonds: activeBonds.length,
      pendingWithdrawals,
      averageStakeSats: avgStake,
      medianStakeSats: medianStake,
    };
  }

  /**
   * Get stake-based ranking
   */
  getRanking(limit: number = 100): StakeRankingEntry[] {
    const activeBonds = Array.from(this.bonds.values())
      .filter(b => b.status === 'active');

    const now = Date.now();
    const entries = activeBonds.map(bond => {
      const stakeAge = (now - bond.lockedAt) / (24 * 60 * 60 * 1000);
      
      // Combined score: stake amount (50%) + stake age (30%) + reputation (20%)
      // Note: reputation would be injected from ReputationScorer
      const combinedScore = (
        (bond.amountSats / 1000000) * 0.5 +
        Math.min(1, stakeAge / 90) * 0.3 +
        0.2 // Placeholder for reputation
      );

      return {
        peerID: bond.peerID,
        stakeSats: bond.amountSats,
        stakeAge,
        reputationScore: 0, // Would be filled from ReputationScorer
        combinedScore,
        rank: 0,
      };
    });

    // Sort by combined score
    entries.sort((a, b) => b.combinedScore - a.combinedScore);

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries.slice(0, limit);
  }

  /**
   * Get slashing history
   */
  getSlashingHistory(peerID?: string): SlashingEvent[] {
    if (peerID) {
      return this.slashingHistory.filter(e => e.peerID === peerID);
    }
    return this.slashingHistory;
  }

  /**
   * Export state for persistence
   */
  export(): {
    bonds: Map<string, StakeBond>;
    withdrawals: Map<string, WithdrawalRequest>;
    slashingHistory: SlashingEvent[];
  } {
    return {
      bonds: this.bonds,
      withdrawals: this.withdrawalQueue,
      slashingHistory: [...this.slashingHistory],
    };
  }

  /**
   * Import state from persistence
   */
  import(state: {
    bonds: Map<string, StakeBond>;
    withdrawals: Map<string, WithdrawalRequest>;
    slashingHistory: SlashingEvent[];
  }): void {
    this.bonds = state.bonds;
    this.withdrawalQueue = state.withdrawals;
    this.slashingHistory = [...state.slashingHistory];
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.bonds.clear();
    this.withdrawalQueue.clear();
    this.slashingHistory = [];
  }
}
