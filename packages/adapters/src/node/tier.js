export class NodeTierDetector {
    async detect() {
        return 'high';
    }
    getCapabilities() {
        const os = require('os');
        const cpuCores = os.cpus().length;
        const memoryGB = os.totalmem() / 1024 / 1024 / 1024;
        return {
            cpuCores,
            memoryGB,
            networkType: '4g',
            saveData: false,
        };
    }
}
//# sourceMappingURL=tier.js.map