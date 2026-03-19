/**
 * ISC Vanilla App
 * Creates layout, manages routing, initializes services.
 * Reuses services from src/services/ shared with the Preact implementation.
 */

import { subscribe, getState, actions } from '../state.js';
export { actions };
import { networkService } from '../services/network.ts';
import { toasts } from '../utils/toast.js';
import { logger } from '../logger.js';
import { escapeHtml } from '../utils/dom.js';

import { createSplash }    from './components/splash.js';
import { createSidebar }   from './components/sidebar.js';
import { createStatusBar } from './components/status-bar.js';
import { modals }          from './components/modal.js';

import { postService } from '../services/index.js';

import * as NowScreen      from './screens/now.js';
import * as DiscoverScreen from './screens/discover.js';
import * as ChatsScreen    from './screens/chats.js';
import * as SettingsScreen from './screens/settings.js';
import * as ComposeScreen  from './screens/compose.js';
import * as VideoScreen    from './screens/video.js';

const SCREENS = {
  '/now':      NowScreen,
  '/discover': DiscoverScreen,
  '/chats':    ChatsScreen,
  '/settings': SettingsScreen,
  '/compose':  ComposeScreen,
  '/video':    VideoScreen,
};

const DEFAULT_ROUTE = '/now';

export function createApp(container) {
  let sidebar    = null;
  let statusBar  = null;
  let mainContent = null;
  let currentRoute = null;
  let debugPanel  = null;
  let debugVisible = false;
  const logBuffer = [];

  // ── Public API ──────────────────────────────────────────────────

  async function start() {
    logger.info('[App] Starting vanilla UI');

    const splash = createSplash(container);
    splash.update('Loading identity…', 20);

    try {
      splash.update('Connecting to network…', 40);

      // Initialize network (non-blocking)
      await networkService.initialize().catch(err => {
        logger.warn('[App] Network init failed, continuing offline:', err.message);
      });

      // Check if embedding model is loading/loaded
      const netAdapter = networkService.service?.getNetworkAdapter?.();
      const embeddingService = networkService.service?.getEmbeddingService?.();
      if (embeddingService && !embeddingService.isLoaded()) {
        splash.update('Loading AI model… (first load may take ~30s)', 60);
        // Model loads in background; we continue without blocking
      }

      splash.update('Initializing UI…', 80);

      // Sync initial state from network
      actions.setChannels(networkService.getChannels());
      actions.setMatches(networkService.getMatches());
      const identity = networkService.getIdentity();
      if (identity) actions.setIdentity(identity);

      const netStatus = networkService.getStatus();
      actions.setStatus(netStatus?.connected ? 'connected' : (netStatus?.status ?? 'disconnected'));

      splash.update('Ready', 100);
      await delay(300);

      splash.hide();
      buildLayout();
      setupEventHandlers();
      setupNetworkListeners();
      setupStateSubscription();
      setupKeyboardShortcuts();
      initRouter();

      // Onboarding check
      if (!localStorage.getItem('isc-onboarding-completed')) {
        showOnboarding();
      }

      logger.info('[App] Ready');
      statusBar?.setLog('App initialized');

      // Trigger an initial peer discovery run if we already have channels and are connected
      const initialChannels = networkService.getChannels();
      if (initialChannels.length > 0 && netStatus?.connected) {
        networkService.discoverPeers().catch(() => {});
      }
    } catch (err) {
      logger.error('[App] Fatal init error:', err.message);
      splash.showError(err.message, () => location.reload());
    }
  }

  // ── Layout Construction ─────────────────────────────────────────

  function buildLayout() {
    container.innerHTML = '';

    // IRC layout wrapper
    const layout = el('div', { className: 'irc-layout', 'data-testid': 'irc-layout' });

    // Sidebar
    const sidebarEl = el('div');
    sidebar = createSidebar(sidebarEl, {
      onNavigate: navigateTo,
      onNewChannel: () => navigateTo('/compose'),
    });
    layout.appendChild(sidebarEl);

    // Main content
    const main = el('main', { className: 'irc-main', 'data-testid': 'irc-main' });
    mainContent = el('div', {
      className: 'app-content',
      id: 'main-content',
      'data-testid': 'main-content',
    });
    main.appendChild(mainContent);
    layout.appendChild(main);

    // Mobile tab bar
    layout.appendChild(buildTabBar());

    container.appendChild(layout);

    // Status bar
    const statusBarContainer = el('div');
    statusBar = createStatusBar(statusBarContainer, {
      onToggleDebug: toggleDebugPanel,
    });
    container.appendChild(statusBarContainer);

    // Toast container (existing toast system needs this)
    const toastContainer = el('div', { id: 'toast-container', className: 'toast-container' });
    container.appendChild(toastContainer);
    toasts.init();

    // Debug panel
    debugPanel = buildDebugPanel(container);

    // Intercept logger to capture entries
    interceptLogger();
  }

  function buildTabBar() {
    const tabs = [
      { id: 'now',      icon: '🏠', label: 'Now',      route: '/now' },
      { id: 'discover', icon: '📡', label: 'Discover', route: '/discover' },
      { id: 'chats',    icon: '💬', label: 'Chats',    route: '/chats' },
      { id: 'compose',  icon: '➕', label: 'New',      route: '/compose' },
      { id: 'settings', icon: '⚙️', label: 'Settings', route: '/settings' },
    ];

    const nav = el('div', { className: 'tab-bar', 'data-testid': 'tab-bar', 'aria-label': 'Mobile navigation' });
    tabs.forEach(tab => {
      const btn = el('button', {
        className: `tab${tab.id === 'compose' ? ' compose' : ''}`,
        'data-testid': `nav-tab-${tab.id}`,
        'data-tab': tab.id,
        'aria-label': tab.label,
      });
      btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span style="font-size:10px">${tab.label}</span>`;
      btn.addEventListener('click', () => navigateTo(tab.route));
      nav.appendChild(btn);
    });

    return nav;
  }

  function buildDebugPanel(parent) {
    const panel = el('div', { className: 'debug-panel hidden', 'data-testid': 'debug-panel' });
    panel.innerHTML = `
      <div class="debug-panel-header">
        <span class="debug-panel-title">Debug Log</span>
        <button class="btn-ghost btn-sm" data-testid="debug-clear" style="font-size:10px">Clear</button>
      </div>
      <div class="debug-log" id="debug-log" data-testid="debug-log"></div>
    `;
    panel.querySelector('[data-testid="debug-clear"]')?.addEventListener('click', () => {
      logBuffer.length = 0;
      const log = panel.querySelector('#debug-log');
      if (log) log.innerHTML = '';
    });
    parent.appendChild(panel);
    return panel;
  }

  // ── Routing ─────────────────────────────────────────────────────

  function initRouter() {
    window.addEventListener('hashchange', () => {
      const route = parseRoute();
      if (route !== currentRoute) renderRoute(route);
    });
    renderRoute(parseRoute());
  }

  function parseRoute() {
    const hash = window.location.hash.replace('#', '').trim();
    return SCREENS[hash] ? hash : DEFAULT_ROUTE;
  }

  function navigateTo(route) {
    if (!SCREENS[route]) route = DEFAULT_ROUTE;
    if (window.location.hash !== `#${route}`) {
      window.location.hash = `#${route}`;
    } else {
      renderRoute(route);
    }
  }

  function renderRoute(route) {
    if (!SCREENS[route]) route = DEFAULT_ROUTE;
    currentRoute = route;

    const screen = SCREENS[route];
    if (!mainContent) return;

    try {
      mainContent.innerHTML = screen.render();
      screen.bind?.(mainContent);
    } catch (err) {
      logger.error(`[App] Screen render error (${route}):`, err.message);
      mainContent.innerHTML = `
        <div class="empty-state" data-testid="screen-error">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Screen Error</div>
          <div class="empty-state-description">${escapeHtml(err.message)}</div>
          <button class="btn btn-primary mt-4" onclick="location.reload()">Reload</button>
        </div>
      `;
    }

    sidebar?.update(route);
    updateTabBar(route);
    statusBar?.setLog(`Navigated to ${route}`);
    // Clear unread badge when entering chats; re-evaluate elsewhere
    if (route === '/chats') {
      document.querySelectorAll('[data-testid="nav-tab-chats"] .nav-unread-badge').forEach(b => b.remove());
    } else {
      updateChatsBadge();
    }
  }

  function updateTabBar(route) {
    document.querySelectorAll('.tab-bar .tab').forEach(tab => {
      const tabRoute = `/${tab.dataset.tab}`;
      const active = tabRoute === route;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-current', active ? 'page' : '');
      tab.setAttribute('data-active', String(active));
    });
  }

  // ── Event Handlers ───────────────────────────────────────────────

  // ── Unread badge ──────────────────────────────────────────────────

  function getTotalUnreadCount() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('isc:chat:unread:')) {
          total += parseInt(localStorage.getItem(key) || '0', 10);
        }
      }
    } catch { /* localStorage unavailable */ }
    return total;
  }

  function updateChatsBadge() {
    if (currentRoute === '/chats') return; // don't show badge when on chats screen
    const count = getTotalUnreadCount();
    document.querySelectorAll('[data-testid="nav-tab-chats"]').forEach(el => {
      let badge = el.querySelector('.nav-unread-badge');
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'nav-unread-badge';
          badge.setAttribute('aria-label', `${count} unread message${count !== 1 ? 's' : ''}`);
          el.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : String(count);
      } else if (badge) {
        badge.remove();
      }
    });
  }

  function setupEventHandlers() {
    document.addEventListener('isc:toast',       e => toasts.show(e.detail?.message, e.detail?.type, e.detail?.duration));
    document.addEventListener('isc:new-channel', () => navigateTo('/compose'));

    // Update unread badge on incoming messages (cross-tab storage events)
    window.addEventListener('storage', e => {
      if (e.key?.startsWith('isc:chat:unread:')) updateChatsBadge();
    });
    document.addEventListener('isc:refresh-feed', e => {
      if (currentRoute === '/now') {
        NowScreen.update(mainContent, { scrollToTop: e.detail?.scrollToTop ?? false });
      }
    });
    document.addEventListener('isc:need-channel', () => {
      toasts.warning('Please select or create a channel first');
      navigateTo('/compose');
    });
    document.addEventListener('isc:like-post', async e => {
      const { postId } = e.detail || {};
      if (!postId) return;
      // Non-fatal — optimistic UI in now.js already updated the button
      postService.like(postId).catch(() => {});
    });
    document.addEventListener('isc:delete-post', async e => {
      const { postId } = e.detail || {};
      if (!postId) return;
      const ok = await modals.confirm('Delete this post?', { title: '🗑️ Delete Post', confirmText: 'Delete', danger: true });
      if (!ok) return;
      try {
        await postService.delete(postId);
        NowScreen.update(mainContent);
        toasts.success('Post deleted');
      } catch (err) { toasts.error(err.message); }
    });

    document.addEventListener('isc:reply-post', e => {
      const { postId } = e.detail || {};
      if (!postId) return;
      const post = postService.getById(postId);
      if (!post) return;
      // Navigate to Now and pre-fill compose with a quote of the original post
      navigateTo('/now');
      setTimeout(() => {
        const input = mainContent?.querySelector('[data-testid="compose-input"]');
        if (!input) return;
        const snippet = (post.content || '').slice(0, 80);
        const ellipsis = post.content?.length > 80 ? '…' : '';
        input.value = `> ${snippet}${ellipsis}\n\n`;
        input.dispatchEvent(new Event('input'));
        input.focus();
      }, 100);
    });
    document.addEventListener('isc:discover-peers', async () => {
      try {
        toasts.info('Discovering peers…');
        await networkService.discoverPeers();
        actions.setMatches(networkService.getMatches());
        if (currentRoute === '/discover') DiscoverScreen.update(mainContent);
      } catch (err) { toasts.error(err.message); }
    });
  }

  function setupNetworkListeners() {
    // BrowserNetworkService events are wired in network.js (setupEventListeners).
    // Those handlers update app state via actions, which the state subscription picks up.
    // Nothing extra needed here — any additional UI reactions belong in setupStateSubscription
    // or as DOM event listeners registered in setupEventHandlers.
  }

  function setupStateSubscription() {
    subscribe((state, prev) => {
      // Toast on network status transitions
      if (state.status !== prev?.status) {
        if (state.status === 'connected') {
          toasts.success('Connected to network');
        } else if (prev?.status === 'connected' && state.status === 'disconnected') {
          toasts.warning('Disconnected from network');
        }
      }

      const statusChanged        = state.status !== prev?.status;
      const channelsChanged      = state.channels?.length !== prev?.channels?.length;
      const matchesChanged       = state.matches?.length !== prev?.matches?.length;
      const activeChannelChanged = state.activeChannelId !== prev?.activeChannelId;

      if (statusChanged || channelsChanged || matchesChanged) {
        updateStatusBarFromState();
      }

      if (channelsChanged || activeChannelChanged) {
        sidebar?.update(currentRoute, state);
      }

      // Auto-refresh active screens when relevant state changes
      if (matchesChanged) {
        if (currentRoute === '/discover') DiscoverScreen.update(mainContent);
        if (currentRoute === '/chats')    ChatsScreen.update(mainContent);
        if (currentRoute === '/video')    VideoScreen.update(mainContent);
      }

      // Refresh Now feed when channels change or user switches active channel
      if (currentRoute === '/now' && (channelsChanged || activeChannelChanged)) {
        NowScreen.update(mainContent);
      }
    });
  }

  function updateStatusBarFromState() {
    const { status, channels, matches } = getState();
    statusBar?.update({ status, peerCount: matches?.length ?? 0, channelCount: channels?.length ?? 0 });
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      const mod     = e.ctrlKey || e.metaKey;
      const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

      if (e.key === '?' && !mod && !inInput)    { e.preventDefault(); modals.showHelp(); }
      if (e.key === 'k' && mod)                 { e.preventDefault(); navigateTo('/compose'); }
      if (e.key === ',' && mod)                 { e.preventDefault(); navigateTo('/settings'); }
      if (e.key === 'd' && mod)                 { e.preventDefault(); toggleDebugPanel(); }
      if (e.key === '/' && !mod && !inInput)    { e.preventDefault(); mainContent?.querySelector('input, textarea')?.focus(); }
      if (e.key === 'Escape')                   modals.close();
    });
  }

  // ── Debug Panel ──────────────────────────────────────────────────

  function toggleDebugPanel() {
    debugVisible = !debugVisible;
    debugPanel?.classList.toggle('hidden', !debugVisible);
    if (debugVisible) scrollDebugLog();
  }

  function interceptLogger() {
    const originalInfo  = logger.info?.bind(logger);
    const originalWarn  = logger.warn?.bind(logger);
    const originalError = logger.error?.bind(logger);
    const originalDebug = logger.debug?.bind(logger);

    const capture = (level, args) => {
      logBuffer.push({ level, msg: args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '), ts: Date.now() });
      if (logBuffer.length > 100) logBuffer.shift();
      if (debugVisible) appendDebugEntry(logBuffer.at(-1));
    };

    if (originalInfo)  logger.info  = (...a) => { originalInfo(...a);  capture('info',  a); };
    if (originalWarn)  logger.warn  = (...a) => { originalWarn(...a);  capture('warn',  a); };
    if (originalError) logger.error = (...a) => { originalError(...a); capture('error', a); };
    if (originalDebug) logger.debug = (...a) => { originalDebug(...a); capture('debug', a); };
  }

  function appendDebugEntry({ level, msg }) {
    const log = document.getElementById('debug-log');
    if (!log) return;
    const div = document.createElement('div');
    div.className = `debug-entry ${level}`;
    div.innerHTML = `<span class="debug-level">${escapeHtml(level.toUpperCase())}</span><span class="debug-msg">${escapeHtml(msg)}</span>`;
    log.appendChild(div);
    scrollDebugLog();
  }

  function scrollDebugLog() {
    const log = document.getElementById('debug-log');
    if (log) log.scrollTop = log.scrollHeight;
  }

  // ── Onboarding ───────────────────────────────────────────────────

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

  // ── Utilities ────────────────────────────────────────────────────

  function el(tag, attrs = {}) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') node.className = v;
      else node.setAttribute(k, v);
    });
    return node;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Expose debug API in dev ───────────────────────────────────────

  if (import.meta.env?.DEV !== false) {
    window.ISC = {
      navigate:     navigateTo,
      getState,
      actions,
      networkService,
      toasts,
      modals,
      reload:       () => location.reload(),
      help:         () => console.log('[ISC Debug API]\n  ISC.navigate(route)\n  ISC.getState()\n  ISC.actions.setMatches(matches)\n  ISC.toasts.info(msg)\n  ISC.modals.showHelp()'),
    };
    console.log('[ISC] Debug API available: type ISC.help() for commands');
  }

  return { start };
}
