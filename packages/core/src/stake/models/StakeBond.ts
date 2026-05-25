/* eslint-disable */
import type { StakeBond, StakeStatus } from '../types/stake.js';
import { STAKE_CONSTANTS } from '../config/stakeConfig.js';

export class StakeBondModel {
  public peerID: string;
  public amountSats: number;
  public lockedAt: number;
  public unlockableAt: number;
  public slashedAmount: number;
  public status: StakeStatus;
  public txHash: string;

  constructor(
    peerID: string,
    amountSats: number,
    lockPeriodMs: number,
    txHash: string
  ) {
    this.peerID = peerID;
    this.amountSats = amountSats;
    this.lockedAt = Date.now();
    this.unlockableAt = this.lockedAt + lockPeriodMs;
    this.slashedAmount = 0;
    this.status = 'active';
    this.txHash = txHash;
  }

  get remainingStake(): number {
    return this.amountSats - this.slashedAmount;
  }

  get isLocked(): boolean {
    return Date.now() < this.unlockableAt;
  }

  set isLocked(val: boolean) {
    if (val) {
      this.unlockableAt = Date.now() + 1000000;
    } else {
      this.unlockableAt = Date.now() - 1000;
    }
  }

  get daysUntilUnlock(): number {
    const remainingMs = this.unlockableAt - Date.now();
    if (remainingMs <= 0) {return 0;}
    return Math.ceil(remainingMs / STAKE_CONSTANTS.LOCK_PERIOD_MS);
  }

  markUnlocking(): void {
    this.status = 'unlocking';
  }

  slash(amount: number): void {
    this.slashedAmount += amount;
    if (this.remainingStake <= 0) {
      this.status = 'slashed';
    }
  }

  toObject(): StakeBond {
    return {
      peerID: this.peerID,
      amountSats: this.amountSats,
      lockedAt: this.lockedAt,
      unlockableAt: this.unlockableAt,
      slashedAmount: this.slashedAmount,
      status: this.status,
      txHash: this.txHash,
    };
  }
}
