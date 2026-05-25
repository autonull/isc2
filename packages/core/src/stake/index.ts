/* eslint-disable */
/**
 * ISC Phase 2.2: Stake Signaling
 * 
 * Economic bond mechanism to deter Sybil attacks.
 * Peers bond stake (via Lightning Network) to participate.
 * Malicious behavior results in slashing.
 */

// Re-export stake modules
export { StakeManager } from './manager.js';
export { LNDAdapter, createLightningAdapter } from './lightning.js';
export { SlashingConditions, AutomatedSlashingDetector } from './slashing.js';

// Types - use 'export type' for isolatedModules
export type {
  LightningAdapter,
  LightningInvoice,
  LightningPayment,
  CreateInvoiceParams,
  SendPaymentParams,
  LightningBalance,
} from './lightning.js';

export type {
  StakeBond,
  StakeConfig,
  SlashingEvent,
  SlashingReason,
  StakeOperationResult,
  StakeInvoice,
  WithdrawalRequest,
  StakeStats,
  StakeRankingEntry,
} from './types.js';

// Constants
export const STAKE_VERSION = '2.0.0';
export const DEFAULT_MIN_STAKE_SATS = 10000; // ~$10 USD
