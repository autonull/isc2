/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TierDetector, Tier, DeviceCapabilities } from '../interfaces/tier.js';

const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; saveData?: boolean } };

export class BrowserTierDetector implements TierDetector {
  detect(): Promise<Tier> {
    const caps = this.getCapabilities();
    return Promise.resolve(this.capabilityToTier(caps));
  }

  getCapabilities(): DeviceCapabilities {
    const cpuCores = nav.hardwareConcurrency || 1;
    const memoryGB = nav.deviceMemory ?? 0.5;
    return {
      cpuCores,
      memoryGB,
      networkType: this.getNetworkType(),
      saveData: this.getSaveData(),
    };
  }

  private capabilityToTier(caps: DeviceCapabilities): Tier {
    const { cpuCores, memoryGB, networkType } = caps;
    if (cpuCores >= 8 && memoryGB >= 16 && networkType === '4g') {return 2;}
    if (cpuCores >= 4 && memoryGB >= 8 && networkType !== 'slow-2g') {return 1;}
    if (cpuCores >= 2 && memoryGB >= 4) {return 1;}
    return 0;
  }

  private getNetworkType(): '4g' | '3g' | '2g' | 'slow-2g' | 'unknown' {
    const conn = nav.connection;
    if (!conn) {return 'unknown';}
    const effectiveType = conn.effectiveType;
    return effectiveType === '2g' || effectiveType === '3g' || effectiveType === '4g'
      ? effectiveType
      : 'unknown';
  }

  private getSaveData(): boolean {
    const conn = nav.connection;
    return conn?.saveData ?? false;
  }
}
