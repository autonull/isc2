import type { SecurityTier, TierConfig } from '@isc/core';

export type Tier = SecurityTier;
export type DeviceCapabilities = TierConfig;

export interface TierDetector {
  detect(): Promise<Tier>;
  getCapabilities(): DeviceCapabilities;
}
