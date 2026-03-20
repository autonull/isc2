/**
 * ISC Vanilla App
 *
 * Creates layout, manages routing, initializes services.
 */

import { subscribe, getState, actions } from '../state.js';
import { networkService } from '../services/network.ts';
import { toasts } from '../utils/toast.js';
import { logger } from '../logger.js';

import { buildLayout, setupLoggerInterceptor } from './layout.js';
import { createRouter, setupEventHandlers, setupKeyboardShortcuts } from './router.js';
import { createSplash } from './components/splash.js';
import { modals } from './components/modal.js';
import { postService } from '../services/index.js';

import * as NowScreen from './screens/now.js';
import * as DiscoverScreen from './screens/discover.js';
import * as ChatsScreen from './screens/chats.js';
import * as SettingsScreen from './screens/settings.js';
import * as ComposeScreen from './screens/compose.js';
import * as VideoScreen from './screens/video.js';

const SCREENS = {
  '/now': NowScreen,
  '/discover': DiscoverScreen,
  '/chats': ChatsScreen,
  '/settings': SettingsScreen,
  '/compose': ComposeScreen,
  '/video': VideoScreen,
};

const DEFAULT_ROUTE = '/now';

export function createApp(container) {
  let layout = null;
  let router = null;
  const logBuffer = [];

  async function start() {
    logger.info('[App] Starting vanilla UI');

    const splash = createSplash(container);
    splash.update('Loading identity…', 20);

    try {
      splash.update('Connecting to network…', 40);

      await networkService.initialize().catch(err => {
        logger.warn('[App] Network init failed, continuing offline:', err.message);
      });

      const embeddingService = networkService.service?.getEmbeddingService?.();
      if (embeddingService && !embeddingService.isLoaded()) {
        splash.update('Loading AI model… (first load may take ~30s)', 60);
      }

      splash.update('Initializing UI…', 80);

      syncInitialState();

      const netStatus = networkService.getStatus();
      actions.setStatus(netStatus?.connected ? 'connected' : (netStatus?.status ?? 'disconnected'));

      splash.update('Ready', 100);
      await delay(300);
      splash.hide();

      initLayout();
      setupSubscriptions();
      setupNetworkListeners();
      setupKeyboardShortcuts({
        onNavigate: navigate,
        onToggleDebug: toggleDebugPanel,
        mainContent: layout.main,
        modals,
      });
      setupEventHandlers({ onNavigate: navigate, mainContent: layout.main });

      if (!localStorage.getItem('isc-onboarding-completed')) {
        showOnboarding();
      }

      logger.info('[App] Ready');
      layout.statusBar?.setLog('App initialized');

      const initialChannels = networkService.getChannels();
      if (initialChannels.length > 0 && netStatus?.connected) {
        networkService.discoverPeers().catch(() => {});
      }
    } catch (err) {
      logger.error('[App] Fatal init error:', err.message);
      splash.showError(err.message, () => location.reload());
    }
  }

  function syncInitialState() {
    actions.setChannels(networkService.getChannels());
    actions.setMatches(networkService.getMatches());
    const identity = networkService.getIdentity();
    if (identity) actions.setIdentity(identity);
  }

  function initLayout() {
    layout = buildLayout(container, { onNavigate: navigate });
    setupLoggerInterceptor(logger, logBuffer, layout.debugPanel, escapeHtml);
    router = createRouter(SCREENS, DEFAULT_ROUTE, layout.main, layout.sidebar);
  }

  function navigate(route) {
    router?.navigate(route);
  }

  function setupSubscriptions() {
    subscribe((state, prev) => {
      if (state.status !== prev?.status) {
        if (state.status === 'connected') toasts.success('Connected to network');
        else if (prev?.status === 'connected' && state.status === 'disconnected') {
          toasts.warning('Disconnected from network');
        }
      }

      const statusChanged = state.status !== prev?.status;
      const channelsChanged = state.channels?.length !== prev?.channels?.length;
      const matchesChanged = state.matches?.length !== prev?.matches?.length;
      const activeChannelChanged = state.activeChannelId !== prev?.activeChannelId;

      if (statusChanged || channelsChanged || matchesChanged) {
        updateStatusBar(state);
      }

      if (channelsChanged || activeChannelChanged) {
        layout.sidebar?.update(router?.getCurrentRoute(), state);
      }

      if (matchesChanged) {
        if (router?.getCurrentRoute() === '/discover') DiscoverScreen.update(layout.main);
        if (router?.getCurrentRoute() === '/chats') ChatsScreen.update(layout.main);
        if (router?.getCurrentRoute() === '/video') VideoScreen.update(layout.main);
      }

      if (router?.getCurrentRoute() === '/now' && (channelsChanged || activeChannelChanged)) {
        NowScreen.update(layout.main);
      }
    });
  }

  function updateStatusBar(state) {
    layout.statusBar?.update({
      status: state.status,
      peerCount: state.matches?.length ?? 0,
      channelCount: state.channels?.length ?? 0,
    });
  }

  function setupNetworkListeners() {
    // Network events are handled in network.js via actions
  }

  function toggleDebugPanel() {
    layout?.debugPanel?.classList.toggle('hidden');
    if (!layout?.debugPanel?.classList.contains('hidden')) {
      const log = layout.debugPanel.querySelector('#debug-log');
      if (log) log.scrollTop = log.scrollHeight;
    }
  }

  function showOnboarding() {
    const html = `
      <div class="modal-header">
        <h2 class="modal-title">👋 Welcome to ISC</h2>
      </div>
      <div class="modal-body" data-testid="onboarding-content">
        <p style="margin-bottom:16px">ISC is a decentralized P2P chat platform that uses semantic matching to connect people with similar ideas.</p>
        <ol style="padding-left:20px;line-height:2.2;font-size:13px">
          <li>Go to <strong>Settings</strong> to set your name and bio</li>
          <li>Create a <strong>Channel</strong> describing your current thoughts</li>
          <li>Use <strong>Discover</strong> to find semantically similar peers</li>
          <li>Start <strong>Chats</strong> with your top matches</li>
        </ol>
        <p style="margin-top:16px;font-size:12px;color:var(--c-text-muted)">Press <kbd style="font-size:11px;padding:1px 6px;border:1px solid rgba(255,255,255,0.15);border-radius:3px">?</kbd> anytime for keyboard shortcuts.</p>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="onboarding-done" data-testid="onboarding-complete">Get Started</button>
      </div>
    `;
    const overlay = modals.open(html);
    overlay.querySelector('#onboarding-done')?.addEventListener('click', () => {
      localStorage.setItem('isc-onboarding-completed', 'true');
      modals.close();
    });
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return str.replace(/[&<>"']/g, m => map[m]);
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Expose debug API in dev
  if (import.meta.env?.DEV !== false) {
    window.ISC = {
      navigate,
      getState,
      actions,
      networkService,
      toasts,
      modals,
      reload: () => location.reload(),
      help: () => console.log('[ISC Debug API]\n  ISC.navigate(route)\n  ISC.getState()\n  ISC.actions.setMatches(matches)\n  ISC.toasts.info(msg)\n  ISC.modals.showHelp()'),
    };
    console.log('[ISC] Debug API available: type ISC.help() for commands');
  }

  return { start };
}
