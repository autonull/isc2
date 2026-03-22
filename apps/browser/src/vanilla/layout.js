/**
 * Layout Builder
 *
 * Creates and manages the application layout structure.
 */

import { el, isMobile } from './utils/dom.js';
import { createSidebar } from './components/sidebar.js';
import { createChannelDrawer } from './components/channelDrawer.js';
import { modals } from './components/modal.js';
import { toasts } from '../utils/toast.js';

const TABS = [
  { id: 'now', icon: '⌂', label: 'Now', route: '/now' },
  { id: 'channel', icon: '#', label: 'Channel', route: '/channel' },
  { id: 'chats', icon: '◷', label: 'Chats', route: '/chats' },
  { id: 'settings', icon: '⚙', label: 'Settings', route: '/settings' },
];

/**
 * @typedef {Object} Layout
 * @property {HTMLElement} container
 * @property {HTMLElement} main
 * @property {Object} sidebar
 * @property {Function} updateTabBar
 * @property {Function} destroy
 */

/**
 * Build the application layout
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Function} options.onNavigate
 * @returns {Layout}
 */
export function buildLayout(container, { onNavigate }) {
  container.innerHTML = '';

  const layout = el('div', { className: 'irc-layout', 'data-testid': 'irc-layout' });
  const sidebarEl = el('div');
  const sidebar = createSidebar(sidebarEl, {
    onNavigate,
    onNewChannel: () => document.dispatchEvent(new CustomEvent('isc:new-channel')),
  });

  const main = el('main', { className: 'irc-main', 'data-testid': 'irc-main' });
  const mainContent = el('div', {
    className: 'app-content',
    id: 'main-content',
    'data-testid': 'main-content',
  });
  main.appendChild(mainContent);

  const tabBar = buildTabBar(onNavigate);
  layout.appendChild(sidebarEl);
  layout.appendChild(main);
  layout.appendChild(tabBar);
  container.appendChild(layout);

  const channelDrawer = createChannelDrawer(onNavigate);

  const toastContainer = el('div', { id: 'toast-container', className: 'toast-container' });
  container.appendChild(toastContainer);
  toasts.init();

  // L1: Global ARIA live region for status announcements
  const liveRegion = el('div', {
    id: 'aria-live-region',
    className: 'sr-only',
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  });
  container.appendChild(liveRegion);

  const debugPanel = buildDebugPanel(container);

  function applyMobileLayout() {
    const mobile = isMobile();
    layout.classList.toggle('irc-layout-mobile', mobile);
    sidebarEl.classList.toggle('hidden', mobile);
    tabBar.classList.toggle('tab-bar-mobile', mobile);
  }

  applyMobileLayout();

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(applyMobileLayout, 150);
  });

  function updateTabBar(route) {
    tabBar.querySelectorAll('.tab').forEach((tab) => {
      const active = `/${tab.dataset.tab}` === route;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-current', active ? 'page' : '');
      tab.setAttribute('data-active', String(active));
    });
  }

  function destroy() {
    sidebar?.destroy?.();
    channelDrawer?.destroy?.();
    container.innerHTML = '';
  }

  return {
    container: layout,
    main: mainContent,
    sidebar,
    updateTabBar,
    destroy,
    get debugPanel() {
      return debugPanel;
    },
  };
}

function buildTabBar(onNavigate) {
  const nav = el('div', {
    className: 'tab-bar',
    'data-testid': 'tab-bar',
    'aria-label': 'Mobile navigation',
  });

  TABS.forEach((tab) => {
    const btn = el('button', {
      className: 'tab',
      'data-testid': `nav-tab-${tab.id}`,
      'data-tab': tab.id,
      'aria-label': tab.label,
    });
    btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span>`;
    if (tab.route) {
      btn.addEventListener('click', () => onNavigate(tab.route));
    } else if (tab.action === 'open-channel-drawer') {
      btn.addEventListener('click', () =>
        document.dispatchEvent(new CustomEvent('isc:toggle-channel-drawer'))
      );
    }
    nav.appendChild(btn);
  });

  return nav;
}

function buildDebugPanel(container) {
  const panel = el('div', { className: 'debug-panel hidden', 'data-testid': 'debug-panel' });
  panel.innerHTML = `
    <div class="debug-panel-header">
      <span class="debug-panel-title">Debug Log</span>
      <button class="btn-ghost btn-sm debug-clear-btn" data-testid="debug-clear">Clear</button>
    </div>
    <div class="debug-log" id="debug-log" data-testid="debug-log"></div>
  `;

  panel.querySelector('[data-testid="debug-clear"]')?.addEventListener('click', () => {
    const log = panel.querySelector('#debug-log');
    if (log) log.innerHTML = '';
  });

  container.appendChild(panel);
  return panel;
}

/**
 * Logger interceptor for debug panel
 * @param {Object} logger
 * @param {Array} buffer
 * @param {HTMLElement} debugPanel
 * @param {Function} escapeHtml
 */
export function setupLoggerInterceptor(logger, buffer, debugPanel, escapeHtml) {
  const original = {
    info: logger.info?.bind(logger),
    warn: logger.warn?.bind(logger),
    error: logger.error?.bind(logger),
    debug: logger.debug?.bind(logger),
  };

  const capture = (level, args) => {
    buffer.push({
      level,
      msg: args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '),
      ts: Date.now(),
    });
    if (buffer.length > 100) buffer.shift();
    if (debugPanel && !debugPanel.classList.contains('hidden')) {
      appendDebugEntry(buffer.at(-1), debugPanel, escapeHtml);
    }
  };

  if (original.info)
    logger.info = (...a) => {
      original.info(...a);
      capture('info', a);
    };
  if (original.warn)
    logger.warn = (...a) => {
      original.warn(...a);
      capture('warn', a);
    };
  if (original.error)
    logger.error = (...a) => {
      original.error(...a);
      capture('error', a);
    };
  if (original.debug)
    logger.debug = (...a) => {
      original.debug(...a);
      capture('debug', a);
    };
}

function appendDebugEntry({ level, msg }, debugPanel, escapeHtml) {
  const log = debugPanel.querySelector('#debug-log');
  if (!log) return;

  const div = el('div', { className: `debug-entry ${level}` });
  div.innerHTML = `<span class="debug-level">${escapeHtml(level.toUpperCase())}</span><span class="debug-msg">${escapeHtml(msg)}</span>`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
