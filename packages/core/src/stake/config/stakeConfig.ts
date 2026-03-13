/**
 * Stake Configuration
 */

import type { StakeConfig } from '../types/stake.js';

export const STAKE_CONFIG: StakeConfig = {
  minStakeSats: 10000,
  lockPeriodDays: 30,
  slashingEnabled: true,
  maxSlashingPercent: 100,
  gracePeriodDays: 7,
} as const;

export const STAKE_CONSTANTS = {
  INVOICE_EXPIRY_SECONDS: 3600,
  LOCK_PERIOD_MS: 24 * 60 * 60 * 1000,
  MAX_AMOUNT_BONUS: 0.1,
  MAX_AGE_BONUS: 0.1,
  AMOUNT_BONUS_DIVISOR: 1000000,
  AGE_BONUS_DIVISOR: 90,
  MAX_COMBINED_BONUS: 0.2,
} as const;

export const SLASHING_WEIGHTS = {
  STAKE_AMOUNT: 0.5,
  STAKE_AGE: 0.3,
  REPUTATION: 0.2,
} as const;
