export type { Tier, DeviceCapabilities } from '@isc/core';

export interface TierDetector {
  detect(): Promise<Tier>;
  getCapabilities(): DeviceCapabilities;
}
