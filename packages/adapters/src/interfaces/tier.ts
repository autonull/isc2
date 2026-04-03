export type { SecurityTier as Tier, TierConfig as DeviceCapabilities } from '@isc/core';

export interface TierDetector {
  detect(): Promise<Tier>;
  getCapabilities(): DeviceCapabilities;
}
