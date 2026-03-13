/**
 * Stake Types
 */

export type StakeStatus = 'active' | 'unlocking' | 'slashed' | 'withdrawn';

export type SlashingReason =
  | 'spam'
  | 'harassment'
  | 'sybil_attack'
  | 'fraud'
  | 'court_no_show'
  | 'double_spend'
  | 'protocol_violation'
  | 'invalid_signature'
  | 'malicious_behavior';

export interface StakeBond {
  peerID: string;
  amountSats: number;
  lockedAt: number;
  unlockableAt: number;
  slashedAmount: number;
  status: StakeStatus;
  txHash: string;
}

export interface StakeConfig {
  minStakeSats: number;
  lockPeriodDays: number;
  slashingEnabled: boolean;
  maxSlashingPercent: number;
  gracePeriodDays: number;
}

export interface StakeOperationResult {
  success: boolean;
  bond?: StakeBond;
  txHash?: string;
  error?: string;
}

export interface StakeInvoice {
  invoice: string;
  amountSats: number;
  expiry: number;
  paymentHash: string;
  peerID: string;
}

export interface WithdrawalRequest {
  peerID: string;
  amountSats: number;
  destination: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

export interface StakeStats {
  totalStakedSats: number;
  totalSlashedSats: number;
  activeBonds: number;
  pendingWithdrawals: number;
  averageStakeSats: number;
  medianStakeSats: number;
}

export interface StakeRankingEntry {
  peerID: string;
  stakeSats: number;
  stakeAge: number;
  reputationScore: number;
  combinedScore: number;
  rank: number;
}

export interface SlashingEvent {
  eventID: string;
  peerID: string;
  amountSats: number;
  reason: SlashingReason;
  evidence: string[];
  decidedBy: string[];
  timestamp: number;
  signature: Uint8Array;
}

export interface LightningPaymentResult {
  success: boolean;
  error?: string;
  preimage?: string;
}

export interface LightningInvoice {
  bolt11: string;
  paymentHash: string;
  amountSats: number;
}
