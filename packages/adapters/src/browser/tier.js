const nav = navigator;
export class BrowserTierDetector {
    async detect() {
        const capabilities = this.getCapabilities();
        if (capabilities.cpuCores >= 8 &&
            capabilities.memoryGB >= 16 &&
            capabilities.networkType === '4g') {
            return 'high';
        }
        if (capabilities.cpuCores >= 4 &&
            capabilities.memoryGB >= 8 &&
            capabilities.networkType !== 'slow-2g') {
            return 'mid';
        }
        if (capabilities.cpuCores >= 2 && capabilities.memoryGB >= 4) {
            return 'low';
        }
        return 'minimal';
    }
    getCapabilities() {
        const cpuCores = nav.hardwareConcurrency || 1;
        const memoryGB = (nav.deviceMemory || 0.5);
        const networkType = this.getNetworkType();
        const saveData = this.getSaveData();
        return {
            cpuCores,
            memoryGB,
            networkType,
            saveData,
        };
    }
    getNetworkType() {
        const conn = nav.connection;
        if (!conn)
            return 'unknown';
        const effectiveType = conn.effectiveType;
        if (!effectiveType)
            return 'unknown';
        switch (effectiveType) {
            case '2g':
                return '2g';
            case '3g':
                return '3g';
            case '4g':
                return '4g';
            default:
                return 'unknown';
        }
    }
    getSaveData() {
        const conn = nav.connection;
        if (!conn)
            return false;
        return conn.saveData ?? false;
    }
}
//# sourceMappingURL=tier.js.map