/**
 * Stake Service
 *
 * Handles stake bond creation, locking, and withdrawal requests.
 */

import type { StakeConfig, StakeOperationResult, StakeInvoice, WithdrawalRequest } from '../types/stake.js';
import type { LightningAdapter } from '../lightning.js';
import { STAKE_CONFIG, STAKE_CONSTANTS } from '../config/stakeConfig.js';
import { StakeBondModel } from '../models/StakeBond.js';
import { WithdrawalQueue } from '../models/WithdrawalQueue.js';

export class StakeService {
  private config: StakeConfig;
  private bonds: Map<string, StakeBondModel> = new Map();
  private withdrawalQueue: WithdrawalQueue;
  private lightning?: LightningAdapter;

  constructor(
    config: Partial<StakeConfig> = {},
    lightning?: LightningAdapter
  ) {
    this.config = { ...STAKE_CONFIG, ...config };
    this.lightning = lightning;
    this.withdrawalQueue = new WithdrawalQueue();
  }

  setLightningAdapter(lightning: LightningAdapter): void {
    this.lightning = lightning;
  }

  async generateStakeInvoice(peerID: string, amountSats?: number): Promise<StakeInvoice> {
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
      expirySeconds: STAKE_CONSTANTS.INVOICE_EXPIRY_SECONDS,
    });

    return {
      invoice: invoice.bolt11,
      amountSats: amount,
      expiry: Date.now() + STAKE_CONSTANTS.INVOICE_EXPIRY_SECONDS * 1000,
      paymentHash: invoice.paymentHash,
      peerID,
    };
  }

  async lockStake(
    peerID: string,
    amountSats: number,
    paymentHash: string
  ): Promise<StakeOperationResult> {
    if (amountSats < this.config.minStakeSats) {
      return {
        success: false,
        error: `Minimum stake is ${this.config.minStakeSats} sats`,
      };
    }

    if (this.hasActiveStake(peerID)) {
      return {
        success: false,
        error: 'Peer already has active stake bond',
      };
    }

    if (this.lightning) {
      const paymentValid = await this.lightning.verifyPayment(paymentHash);
      if (!paymentValid) {
        return {
          success: false,
          error: 'Payment verification failed',
        };
      }
    }

    const lockPeriodMs = this.config.lockPeriodDays * STAKE_CONSTANTS.LOCK_PERIOD_MS;
    const bond = new StakeBondModel(peerID, amountSats, lockPeriodMs, paymentHash);

    this.bonds.set(peerID, bond);

    return {
      success: true,
      bond: bond.toObject(),
      txHash: paymentHash,
    };
  }

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

    if (bond.isLocked) {
      return {
        success: false,
        error: `Stake locked for ${bond.daysUntilUnlock} more days`,
      };
    }

    if (bond.remainingStake <= 0) {
      return {
        success: false,
        error: 'No stake available for withdrawal',
      };
    }

    const request = {
      peerID,
      amountSats: bond.remainingStake,
      destination,
      requestedAt: Date.now(),
      status: 'pending' as const,
    };

    this.withdrawalQueue.add(request);
    bond.markUnlocking();

    return { success: true };
  }

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

    this.withdrawalQueue.updateStatus(requestKey, 'completed');
    this.bonds.delete(request.peerID);

    return { success: true, txHash: paymentResult.preimage };
  }

  getBond(peerID: string): StakeBondModel | undefined {
    return this.bonds.get(peerID);
  }

  hasActiveStake(peerID: string): boolean {
    const bond = this.bonds.get(peerID);
    return bond?.status === 'active';
  }

  getAllBonds(): Map<string, StakeBondModel> {
    return this.bonds;
  }

  getWithdrawalQueue(): WithdrawalQueue {
    return this.withdrawalQueue;
  }

  clear(): void {
    this.bonds.clear();
    this.withdrawalQueue.clear();
  }

  export(): {
    bonds: Map<string, StakeBondModel>;
    withdrawals: Map<string, WithdrawalRequest>;
  } {
    return {
      bonds: this.bonds,
      withdrawals: this.withdrawalQueue.export(),
    };
  }

  import(state: {
    bonds: Map<string, StakeBondModel>;
    withdrawals: Map<string, WithdrawalRequest>;
  }): void {
    this.bonds = state.bonds;
    this.withdrawalQueue.import(state.withdrawals);
  }
}
