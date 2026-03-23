/**
 * ISC Vanilla App
 *
 * Creates layout, manages routing, initializes services.
 */

import { subscribe, getState, actions } from '../state.js';
import { getColdStartService } from '../services/coldStart.ts';
import { toasts } from '../utils/toast.js';
import { logger } from '../logger.js';
import { escapeHtml } from './utils/dom.js';

import { buildLayout, setupLoggerInterceptor } from './layout.js';
import { createRouter, setupEventHandlers, setupKeyboardShortcuts } from './router.js';
import { createSplash } from './components/splash.js';
import { modals } from './components/modal.js';
import { postService, networkService, feedService } from '../services/index.js';

import * as NowScreen from './screens/now.js';
import * as ChannelScreen from './screens/channel.js';
import * as ChatsScreen from './screens/chats.js';
import * as SettingsScreen from './screens/settings.js';

const SCREENS = {
  '/now': NowScreen,
  '/channel': ChannelScreen,
  '/chats': ChatsScreen,
  '/settings': SettingsScreen,
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
      getColdStartService().start();
      logger.info('[App] Cold start services initialized');

      splash.update('Connecting to network…', 40);

      await networkService.initialize().catch((err) => {
        logger.warn('[App] Network init failed, continuing offline:', err.message);
      });

      const embeddingService = networkService.service?.getEmbeddingService?.();
      if (embeddingService) {
        splash.update('Loading AI model… (first load may take ~30s)', 60);
        const pollInterval = setInterval(() => {
          if (embeddingService.isLoaded()) {
            splash.update('AI model ready', 75);
            clearInterval(pollInterval);
          } else if (embeddingService.getError()) {
            logger.warn('[App] Embedding failed, using fallback mode');
            splash.update('AI unavailable — using text matching', 75);
            clearInterval(pollInterval);
          }
        }, 500);
      }

      splash.update('Initializing UI…', 80);

      syncInitialState();

      const netStatus = networkService.getStatus();
      actions.setStatus(netStatus?.connected ? 'connected' : (netStatus?.status ?? 'disconnected'));

      splash.update('Ready', 100);
      await new Promise((r) => setTimeout(r, 300));
      splash.hide();

      initLayout();
      setupSubscriptions();
      setupKeyboardShortcuts({
        onNavigate: navigate,
        onToggleDebug: toggleDebugPanel,
        mainContent: layout.main,
        modals,
      });
      setupEventHandlers({ onNavigate: navigate, mainContent: layout.main, services: { postService, networkService, modals } });

      document.addEventListener('isc:toggle-chaos', () => {
        const coldStart = getColdStartService();
        const current = coldStart.getChaosStatus?.()?.level ?? 0;
        coldStart.setChaosLevel?.(current > 0 ? 0 : 50);
        toasts.info(
          current > 0
            ? 'Serendipity mode off'
            : 'Serendipity mode on — discovering unexpected peers'
        );
      });

      if (!localStorage.getItem('isc-onboarding-completed')) {
        showOnboarding();
      }

      if (localStorage.getItem('isc-ephemeral-session') === 'true') {
        window.addEventListener('beforeunload', (e) => {
          e.preventDefault();
          e.returnValue =
            'Closing this tab will permanently erase your anonymous identity and all messages. Continue?';
        });
      }

      setupPWAInstallPrompt();

      logger.info('[App] Ready');

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

    // Wrap sidebar to also update tab bar on route change
    const sidebarWithTabBar = layout.sidebar ? {
      ...layout.sidebar,
      update(route, state) {
        layout.sidebar.update(route, state);
        layout.updateTabBar(route);
      },
    } : null;

    router = createRouter(SCREENS, DEFAULT_ROUTE, layout.main, sidebarWithTabBar);
  }

  function navigate(route) {
    router?.navigate(route);
  }

  function setupSubscriptions() {
    subscribe((state, prev) => {
      if (state.status !== prev?.status) {
        if (state.status === 'connected') {
          toasts.success('Connected to network');
          dismissNetworkBanner();
        } else if (prev?.status === 'connected' && state.status === 'disconnected') {
          toasts.warning('Disconnected from network — messages will be queued');
          showNetworkBanner(
            'offline',
            '📡 Disconnected — messages will be delivered when reconnected'
          );
        }
      }

      const statusChanged = state.status !== prev?.status;
      const channelsChanged = state.channels?.length !== prev?.channels?.length;
      const matchesChanged = state.matches?.length !== prev?.matches?.length;
      const activeChannelChanged = state.activeChannelId !== prev?.activeChannelId;

      if (statusChanged || matchesChanged) {
        updateSidebarStatus(state);
      }

      if (channelsChanged || activeChannelChanged) {
        layout.sidebar?.update(router?.getCurrentRoute(), state);
      }

      if (matchesChanged) {
        if (router?.getCurrentRoute() === '/chats') ChatsScreen.update(layout.main);
      }

      if (router?.getCurrentRoute() === '/now' && (channelsChanged || activeChannelChanged)) {
        NowScreen.update(layout.main);
      }

      if (router?.getCurrentRoute() === '/channel' && (channelsChanged || activeChannelChanged)) {
        ChannelScreen.update(layout.main);
      }
    });
  }

  function updateSidebarStatus(state) {
    layout.sidebar?.setStatus({
      status: state.status,
      peerCount: state.matches?.length ?? 0,
    });
  }

  let networkBannerEl = null;

  function showNetworkBanner(type, message) {
    dismissNetworkBanner();
    if (!layout?.main) return;
    networkBannerEl = document.createElement('div');
    networkBannerEl.className = `info-banner ${type}`;
    networkBannerEl.setAttribute('data-testid', 'network-banner');
    networkBannerEl.textContent = message;
    layout.main.prepend(networkBannerEl);
  }

  function dismissNetworkBanner() {
    networkBannerEl?.remove();
    networkBannerEl = null;
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
  <p class="onboarding-text">ISC connects you with people thinking about the same things — not by social graph, but by the meaning of your words.</p>
  <p class="onboarding-text">Your first step is creating a <strong>channel</strong> — a short description of what's on your mind. A tiny AI runs in your browser to turn it into a semantic fingerprint. No text ever leaves your device.</p>
  <p class="onboarding-hint">
    Press <kbd class="kbd-hint">?</kbd> anytime for keyboard shortcuts.
  </p>
</div>
<div class="modal-actions">
  <button class="btn btn-primary" id="onboarding-done" data-testid="onboarding-complete">Create my first channel →</button>
</div>
`;
    const overlay = modals.open(html);
    overlay.querySelector('#onboarding-done')?.addEventListener('click', () => {
      localStorage.setItem('isc-onboarding-completed', 'true');
      modals.close();
      document.dispatchEvent(new CustomEvent('isc:new-channel'));
    });
  }

  let deferredInstallPrompt = null;

  function setupPWAInstallPrompt() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;

      const hasInstalled = localStorage.getItem('isc-pwa-installed');
      const installCount = parseInt(localStorage.getItem('isc-install-prompt-count') || '0', 10);

      if (hasInstalled || installCount >= 2) return;

      const showPrompt = () => {
        document.removeEventListener('isc:channel-created', showPrompt);
        document.removeEventListener('isc:peers-found', showPrompt);

        const installBanner = document.createElement('div');
        installBanner.className = 'pwa-install-banner';
        installBanner.id = 'pwa-install-banner';
        installBanner.innerHTML = `
        <span>Install ISC for the best experience</span>
        <button id="pwa-install-btn">Install</button>
        <button id="pwa-dismiss-btn">Later</button>
      `;
        document.body.appendChild(installBanner);

        installBanner.querySelector('#pwa-install-btn')?.addEventListener('click', async () => {
          if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
              localStorage.setItem('isc-pwa-installed', 'true');
            }
            deferredInstallPrompt = null;
          }
          installBanner.remove();
        });

        installBanner.querySelector('#pwa-dismiss-btn')?.addEventListener('click', () => {
          localStorage.setItem('isc-install-prompt-count', String(installCount + 1));
          installBanner.remove();
        });
      };

      document.addEventListener('isc:channel-created', showPrompt, { once: true });
      document.addEventListener('isc:peers-found', showPrompt, { once: true });
    });
  }

  // Expose debug API in dev
  if (import.meta.env?.DEV !== false) {
    window.ISC = {
      navigate,
      getState,
      actions,
      networkService,
      feedService,
      postService,
      toasts,
      modals,
      reload: () => location.reload(),
      help: () =>
        console.log(
          '[ISC Debug API]\n  ISC.navigate(route)\n  ISC.getState()\n  ISC.actions.setMatches(matches)\n  ISC.feedService.getByChannel(channelId, limit)\n  ISC.feedService.getForYou(limit)\n  ISC.toasts.info(msg)\n  ISC.modals.showHelp()'
        ),
    };
    console.log('[ISC] Debug API available: type ISC.help() for commands');
  }

  return { start };
}
