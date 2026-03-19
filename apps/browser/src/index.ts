import { AppRoot } from './ui/AppRoot.js';
import { getChannelManager } from './channels/manager.lazy.js';
import { createChannelService } from './services/channelService.js';
import { createPostService } from './services/postService.js';
import { createFeedService } from './services/feedService.js';
import { getWebUINetworkService } from './services/networkService.js';
import { createIdentityService } from './services/identityService.js';
import { createSettingsService } from './services/settingsService.js';
import { createVideoService } from './services/videoService.js';
import { createChatService } from './services/chatService.js';
import { createDiscoveryService } from './services/discoveryService.js';
import { exposeDebugAPI } from './dev/debugTools.js';
import './styles/main.css';

console.log('[ISC Vanilla] Module loaded');

async function init() {
  console.log('[ISC Vanilla] init() called');

  const container = document.getElementById('app');
  if (!container) {
    console.error('[ISC Vanilla] Container not found!');
    return;
  }

  // Create Root Component and mount immediately to show loading state
  const appRoot = new AppRoot();
  container.innerHTML = '';
  appRoot.mount(container);

  try {
    // 1. Initialize Network Service (lazy, non-blocking but let's await for a base level)
    const networkService = getWebUINetworkService();
    networkService.initialize().catch(err => {
      console.warn('[ISC Vanilla] Network init failed, continuing offline:', err);
    });
    console.log('[ISC Vanilla] Network service starting...');

    // 2. Channel Manager
    const channelManager = await getChannelManager();
    console.log('[ISC Vanilla] Channel manager initialized');

    // 3. Create domain services
    const channelService = createChannelService(channelManager);
    const postService = createPostService();
    const feedService = createFeedService(postService, channelManager);
    const identityService = createIdentityService();
    const settingsService = createSettingsService();
    const videoService = createVideoService();
    const chatService = createChatService();
    const discoveryService = createDiscoveryService();

    // Group dependencies for easier access if needed
    const dependencies = {
      channelManager,
      channelService,
      postService,
      feedService,
      networkService,
      identity: identityService,
      settings: settingsService,
      video: videoService,
      chat: chatService,
      discovery: discoveryService,
    };

    // Expose debug tools in development
    if (process.env.NODE_ENV !== 'production') {
      exposeDebugAPI(dependencies as any);
      console.log('[ISC Vanilla] Debug tools enabled');
    }

    // Pass dependencies to Root Component
    appRoot.setProps({ dependencies });
    appRoot.setReady();

    console.log('[ISC Vanilla] Initialization complete');
  } catch (err) {
    console.error('[ISC Vanilla] Fatal error:', err);
    container.innerHTML = `<div style="color:red;padding:20px;"><h1>Error</h1><pre>${err instanceof Error ? err.message : String(err)}</pre></div>`;
  }
}

// Delay initialization to ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
