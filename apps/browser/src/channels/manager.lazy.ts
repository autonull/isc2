/**
 * Channel Manager Lazy Loader
 *
 * Provides lazy-loading for channelManager to avoid embedding-service
 * issues at app startup.
 */

let _channelManager: any = null;
let _loadingPromise: Promise<any> | null = null;

export async function getChannelManager() {
  if (_channelManager) {
    return _channelManager;
  }

  if (_loadingPromise) {
    return _loadingPromise;
  }

  _loadingPromise = (async () => {
    const mod = await import('../channels/manager.js');
    _channelManager = mod.channelManager;
    _loadingPromise = null;
    return _channelManager;
  })();

  return _loadingPromise;
}
