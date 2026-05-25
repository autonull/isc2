/* eslint-disable */
/**
 * Stake Manager
 *
 * Manages stake bonds, locking, unlocking, and slashing.
 * Integrates with Lightning Network for payments.
 *
 * Facade that coordinates stake services.
 */

export type {
  StakeBond,
  StakeConfig,
  StakeOperationResult,
  StakeInvoice,
  WithdrawalRequest,
  StakeStats,
  StakeRankingEntry,
  SlashingEvent,
  SlashingReason,
  StakeStatus,
} from './types/stake.js';

export { STAKE_CONFIG, STAKE_CONSTANTS, SLASHING_WEIGHTS } from './config/stakeConfig.js';

export { StakeBondModel } from './models/StakeBond.js';
export { WithdrawalQueue } from './models/WithdrawalQueue.js';
export { SlashingHistory } from './models/SlashingHistory.js';

export { StakeService } from './services/StakeService.js';
export { SlashingService } from './services/SlashingService.js';
export { StakeRankingService } from './services/StakeRankingService.js';
export { StakeStatsService } from './services/StakeStatsService.js';

import type {
  StakeConfig,
  StakeOperationResult,
  StakeInvoice,
  StakeStats,
  StakeRankingEntry,
  SlashingReason,
  WithdrawalRequest,
} from './types/stake.js';
import type { LightningAdapter } from './lightning.js';
import { StakeService } from './services/StakeService.js';
import { SlashingService } from './services/SlashingService.js';
import { StakeRankingService } from './services/StakeRankingService.js';
import { StakeStatsService } from './services/StakeStatsService.js';
import type { StakeBondModel } from './models/StakeBond.js';

export class StakeManager {
  private stakeService: StakeService;
  private slashingService: SlashingService;
  private rankingService: StakeRankingService;
  private statsService: StakeStatsService;

  constructor(
    config: Partial<StakeConfig> = {},
    lightning?: LightningAdapter
  ) {
    this.stakeService = new StakeService(config, lightning);
    this.slashingService = new SlashingService(config);
    this.rankingService = new StakeRankingService();
    this.statsService = new StakeStatsService();
  }

  setLightningAdapter(lightning: LightningAdapter): void {
    this.stakeService.setLightningAdapter(lightning);
  }

  async generateStakeInvoice(
    peerID: string,
    amountSats?: number
  ): Promise<StakeInvoice> {
    return this.stakeService.generateStakeInvoice(peerID, amountSats);
  }

  async lockStake(
    peerID: string,
    amountSats: number,
    paymentHash: string
  ): Promise<StakeOperationResult> {
    return this.stakeService.lockStake(peerID, amountSats, paymentHash);
  }

  async requestWithdrawal(
    peerID: string,
    destination: string
  ): Promise<StakeOperationResult> {
    return this.stakeService.requestWithdrawal(peerID, destination);
  }

  async processWithdrawal(
    requestKey: string,
    paymentPreimage: string
  ): Promise<StakeOperationResult> {
    return this.stakeService.processWithdrawal(requestKey, paymentPreimage);
  }

  slashStake(
    peerID: string,
    reason: SlashingReason,
    amountSats: number,
    evidence: string[],
    decidedBy: string[],
    signature: Uint8Array
  ): StakeOperationResult {
    const bond = this.stakeService.getBond(peerID);
    if (!bond) {
      return {
        success: false,
        error: 'No stake bond found',
      };
    }
    return this.slashingService.slashStake(
      bond,
      reason,
      amountSats,
      evidence,
      decidedBy,
      signature
    );
  }

  getBond(peerID: string) {
    const bond = this.stakeService.getBond(peerID);
    return bond?.toObject();
  }

  hasActiveStake(peerID: string): boolean {
    return this.stakeService.hasActiveStake(peerID);
  }

  getStakeTrustBonus(peerID: string): number {
    const bond = this.stakeService.getBond(peerID);
    if (!bond) {return 0;}
    return this.rankingService.getStakeTrustBonus(bond);
  }

  getStats(): StakeStats {
    return this.statsService.getStats(
      this.stakeService.getAllBonds(),
      this.stakeService.getWithdrawalQueue()
    );
  }

  getRanking(limit: number = 100): StakeRankingEntry[] {
    return this.rankingService.getRanking(
      this.stakeService.getAllBonds(),
      limit
    );
  }

  getSlashingHistory(peerID?: string) {
    return this.slashingService.getSlashingHistory(peerID);
  }

  export(): {
    bonds: Map<string, StakeBondModel>;
    withdrawals: Map<string, WithdrawalRequest>;
    slashingHistory: any[];
  } {
    const stakeExport = this.stakeService.export();
    return {
      bonds: stakeExport.bonds,
      withdrawals: stakeExport.withdrawals,
      slashingHistory: this.slashingService.getSlashingHistory(),
    };
  }

  import(state: {
    bonds: Map<string, StakeBondModel>;
    withdrawals: Map<string, WithdrawalRequest>;
    slashingHistory: any[];
  }): void {
    this.stakeService.import({
      bonds: state.bonds,
      withdrawals: state.withdrawals,
    });
    this.slashingService.getHistory().import(state.slashingHistory);
  }

  clear(): void {
    this.stakeService.clear();
    this.slashingService.clear();
  }
}
