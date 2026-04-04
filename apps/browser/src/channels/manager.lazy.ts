import type { ChannelManager } from './manager.js';

let _channelManager: ChannelManager | null = null;
let _loadingPromise: Promise<ChannelManager> | null = null;

export async function getChannelManager(): Promise<ChannelManager> {
  if (_channelManager) {
    return _channelManager;
  }

  if (_loadingPromise) {
    return _loadingPromise;
  }

  _loadingPromise = (async () => {
    const mod = await import('./manager.js');
    _channelManager = mod.channelManager;
    _loadingPromise = null;
    return _channelManager;
  })();

  return _loadingPromise;
}
