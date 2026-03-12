import { TierDetector, Tier, DeviceCapabilities } from '../interfaces/tier.js';

export class NodeTierDetector implements TierDetector {
  async detect(): Promise<Tier> {
    return 'high';
  }

  getCapabilities(): DeviceCapabilities {
    const os = require('os');
    const cpuCores = os.cpus().length;
    const memoryGB = os.totalmem() / 1024 / 1024 / 1024;

    return { cpuCores, memoryGB, networkType: '4g', saveData: false };
  }
}
