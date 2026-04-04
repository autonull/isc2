/* eslint-disable */
/**
 * Stake System Type Definitions
 */

/**
 * Stake bond state
 */
export interface StakeBond {
  peerID: string;
  amountSats: number;         // Amount in satoshis
  lockedAt: number;           // Unix timestamp
  unlockableAt: number;       // When can be withdrawn
  slashedAmount: number;      // Amount already slashed
  reason?: string;            // Reason for slashing (if any)
  status: 'active' | 'slashed' | 'unlocking' | 'withdrawn';
  txHash?: string;            // Lightning payment hash
}

/**
 * Stake configuration
 */
export interface StakeConfig {
  minStakeSats: number;       // Minimum stake in satoshis
  lockPeriodDays: number;     // Days before unstaking
  slashingEnabled: boolean;   // Whether slashing is active
  maxSlashingPercent: number; // Maximum % that can be slashed
  gracePeriodDays: number;    // Days before new stake is active
}

/**
 * Slashing event
 */
export interface SlashingEvent {
  eventID: string;
  peerID: string;
  amountSats: number;
  reason: SlashingReason;
  evidence: string[];
  decidedBy: string[];        // Jury or admin who decided
  timestamp: number;
  signature: Uint8Array;
}

/**
 * Reasons for slashing
 */
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

/**
 * Stake operation result
 */
export interface StakeOperationResult {
  success: boolean;
  bond?: StakeBond;
  error?: string;
  txHash?: string;
}

/**
 * Lightning invoice for stake
 */
export interface StakeInvoice {
  invoice: string;            // BOLT11 invoice
  amountSats: number;
  expiry: number;
  paymentHash: string;
  peerID: string;
}

/**
 * Stake withdrawal request
 */
export interface WithdrawalRequest {
  peerID: string;
  amountSats: number;
  destination: string;        // Lightning address or invoice
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}

/**
 * Stake statistics
 */
export interface StakeStats {
  totalStakedSats: number;
  totalSlashedSats: number;
  activeBonds: number;
  pendingWithdrawals: number;
  averageStakeSats: number;
  medianStakeSats: number;
}

/**
 * Stake-based ranking entry
 */
export interface StakeRankingEntry {
  peerID: string;
  stakeSats: number;
  stakeAge: number;           // Days staked
  reputationScore: number;    // Combined with reputation
  combinedScore: number;      // Weighted combination
  rank: number;
}
