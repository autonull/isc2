export type Tier = 'high' | 'mid' | 'low' | 'minimal';

export interface DeviceCapabilities {
  cpuCores: number;
  memoryGB: number;
  networkType: '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';
  saveData: boolean;
}

export interface TierDetector {
  detect(): Promise<Tier>;
  getCapabilities(): DeviceCapabilities;
}
