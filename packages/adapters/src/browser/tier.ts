import { TierDetector, Tier, DeviceCapabilities } from '../interfaces/tier.js';

const nav = navigator as Navigator & { deviceMemory?: number; connection?: Record<string, unknown> };

export class BrowserTierDetector implements TierDetector {
  async detect(): Promise<Tier> {
    const caps = this.getCapabilities();
    const cpuCores = (caps as any).cpuCores;
    const memoryGB = (caps as any).memoryGB;
    const networkType = (caps as any).networkType;

    if (cpuCores >= 8 && memoryGB >= 16 && networkType === '4g') return 'high' as unknown as Tier;
    if (cpuCores >= 4 && memoryGB >= 8 && networkType !== 'slow-2g') return 'mid' as unknown as Tier;
    if (cpuCores >= 2 && memoryGB >= 4) return 'low' as unknown as Tier;
    return 'minimal' as unknown as Tier;
  }

  getCapabilities(): DeviceCapabilities {
    const cpuCores = nav.hardwareConcurrency || 1;
    const memoryGB = (nav.deviceMemory || 0.5) as number;
    return { cpuCores, memoryGB, networkType: this.getNetworkType(), saveData: this.getSaveData() } as unknown as DeviceCapabilities;
  }

  private getNetworkType(): '4g' | '3g' | '2g' | 'slow-2g' | 'unknown' {
    const conn = nav.connection;
    if (!conn) return 'unknown';
    const effectiveType = (conn as { effectiveType?: string }).effectiveType;
    return effectiveType === '2g' || effectiveType === '3g' || effectiveType === '4g' ? effectiveType : 'unknown';
  }

  private getSaveData(): boolean {
    const conn = nav.connection;
    return conn ? ((conn as { saveData?: boolean }).saveData ?? false) : false;
  }
}
