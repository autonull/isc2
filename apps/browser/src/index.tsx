import { h, render } from 'preact';
import { BrowserNavigator, setNavigator } from '@isc/navigation';
import { App } from './App.js';
import { DependencyProvider } from './di/container.js';
import { getChannelManager } from './channels/manager.lazy.js';
import { createChannelService } from './services/channelService.js';
import { createPostService } from './services/postService.js';
import { createFeedService } from './services/feedService.js';
import { getWebUINetworkService } from './services/networkService.js';
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

    // Create dependencies
    const dependencies = {
      channelManager,
      channelService,
      postService,
      feedService,
      networkService,
      navigator,
      identity: null, // TODO: Implement
      settings: null, // TODO: Implement
      video: null, // TODO: Implement
      chat: null, // TODO: Implement
      discovery: null, // TODO: Implement
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
