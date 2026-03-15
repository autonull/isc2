import { h, render } from 'preact';
import { BrowserNavigator, setNavigator } from '@isc/navigation';
import { App } from './App.js';
import { DependencyProvider } from './di/container.js';
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
import { exposeDebugAPI, createDebugOverlay } from './dev/debugTools.js';
import './styles/main.css';

console.log('[ISC] Module loaded');

async function init() {
  console.log('[ISC] init() called');

  const container = document.getElementById('app');
  if (!container) {
    console.error('[ISC] Container not found!');
    return;
  }

  try {
    // Initialize navigator
    const navigator = new BrowserNavigator();
    setNavigator(navigator);
    console.log('[ISC] Navigator initialized');

    // Initialize network service (lazy, non-blocking)
    const networkService = getWebUINetworkService();
    networkService.initialize().catch(err => {
      console.error('[ISC] Network init failed:', err);
    });
    console.log('[ISC] Network service starting...');

    // Initialize channel manager (lazy load)
    const channelManager = await getChannelManager();
    console.log('[ISC] Channel manager initialized');

    // Create services
    const channelService = createChannelService(channelManager);
    const postService = createPostService();
    const feedService = createFeedService(postService, channelManager);
    const identityService = createIdentityService();
    const settingsService = createSettingsService();
    const videoService = createVideoService();
    const chatService = createChatService();
    const discoveryService = createDiscoveryService();

    // Create dependencies (all wired up)
    const dependencies = {
      channelManager,
      channelService,
      postService,
      feedService,
      networkService,
      navigator,
      identity: identityService,
      settings: settingsService,
      video: videoService,
      chat: chatService,
      discovery: discoveryService,
    };

    // Expose debug tools in development
    if (process.env.NODE_ENV !== 'production') {
      exposeDebugAPI(dependencies);
      createDebugOverlay(dependencies);
      console.log('[ISC] Debug tools enabled');
    }

    // Render app with dependency provider
    render(
      <DependencyProvider dependencies={dependencies}>
        <App />
      </DependencyProvider>,
      container
    );

    console.log('[ISC] Render complete');
    console.log('[ISC] App ready - type ISC_DEBUG.help() for debug commands');
  } catch (err) {
    console.error('[ISC] Fatal error:', err);
    container.innerHTML = `<div style="color:red;padding:20px;"><h1>Error</h1><pre>${err instanceof Error ? err.message : String(err)}</pre></div>`;
  }
}

// Delay initialization to ensure DOM is ready
setTimeout(init, 100);
