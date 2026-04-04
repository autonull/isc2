/* eslint-disable */
/**
 * Slashing Service
 *
 * Handles stake slashing for malicious behavior.
 */

import type {
  StakeConfig,
  StakeOperationResult,
  SlashingReason,
  SlashingEvent,
} from '../types/stake.js';
import { STAKE_CONFIG } from '../config/stakeConfig.js';
import type { StakeBondModel } from '../models/StakeBond.js';
import { SlashingHistory } from '../models/SlashingHistory.js';
import { SlashingConditions } from '../slashing.js';

export class SlashingService {
  private config: StakeConfig;
  private slashingHistory: SlashingHistory;
  private slashingConditions: SlashingConditions;

  constructor(config: Partial<StakeConfig> = {}) {
    this.config = { ...STAKE_CONFIG, ...config };
    this.slashingHistory = new SlashingHistory();
    this.slashingConditions = new SlashingConditions(this.config);
  }

  slashStake(
    bond: StakeBondModel,
    reason: SlashingReason,
    amountSats: number,
    evidence: string[],
    decidedBy: string[],
    signature: Uint8Array
  ): StakeOperationResult {
    if (!this.config.slashingEnabled) {
      return {
        success: false,
        error: 'Slashing is disabled',
      };
    }

    const validReason = this.slashingConditions.validateReason(reason);
    if (!validReason) {
      return {
        success: false,
        error: `Invalid slashing reason: ${reason}`,
      };
    }

    const maxSlashable = (this.config.maxSlashingPercent / 100) * bond.amountSats;
    const actualSlashAmount = Math.min(
      amountSats,
      bond.remainingStake,
      maxSlashable
    );

    if (actualSlashAmount <= 0) {
      return {
        success: false,
        error: 'No stake available to slash',
      };
    }

    bond.slash(actualSlashAmount);

    const event: SlashingEvent = {
      eventID: `slash_${crypto.randomUUID()}`,
      peerID: bond.peerID,
      amountSats: actualSlashAmount,
      reason,
      evidence,
      decidedBy,
      timestamp: Date.now(),
      signature,
    };

    this.slashingHistory.add(event);

    return {
      success: true,
      bond: bond.toObject(),
    };
  }

  getSlashingHistory(peerID?: string): SlashingEvent[] {
    return peerID
      ? this.slashingHistory.getByPeer(peerID)
      : this.slashingHistory.getAll();
  }

  getTotalSlashed(peerID?: string): number {
    return this.slashingHistory.getTotalSlashed(peerID);
  }

  getHistory(): SlashingHistory {
    return this.slashingHistory;
  }

  clear(): void {
    this.slashingHistory.clear();
  }
}
