import { TierDetector, Tier, DeviceCapabilities } from '../interfaces/tier.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export class NodeTierDetector implements TierDetector {
  async detect(): Promise<Tier> {
    return 2;
  }

  getCapabilities(): DeviceCapabilities {
    const os = require('os');
    const cpuCores = os.cpus().length;
    const memoryGB = os.totalmem() / 1024 / 1024 / 1024;
    return { cpuCores, memoryGB, networkType: '4g' as const, saveData: false };
  }
}
