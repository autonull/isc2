import { TierDetector, Tier, DeviceCapabilities } from '../interfaces/tier.js';
export declare class BrowserTierDetector implements TierDetector {
    detect(): Promise<Tier>;
    getCapabilities(): DeviceCapabilities;
    private getNetworkType;
    private getSaveData;
}
//# sourceMappingURL=tier.d.ts.map