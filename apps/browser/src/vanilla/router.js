/**
 * Router Module
 *
 * Hash-based routing with screen management.
 */

import { getState, actions } from '../state.js';
import { logger } from '../logger.js';
import { escapeHtml } from './utils/dom.js';
import { toasts } from '../utils/toast.js';

/**
 * @typedef {Object} Screen
 * @property {Function} render
 * @property {Function} [bind]
 * @property {Function} [update]
 * @property {Function} [destroy]
 */

/**
 * @typedef {Object} Router
 * @property {Function} navigate
 * @property {Function} getCurrentRoute
 * @property {Function} destroy
 */

/**
 * Create router
 * @param {Object} screens - Map of route paths to screen modules
 * @param {string} defaultRoute
 * @param {HTMLElement} mainContent
 * @param {Object} sidebar
 * @returns {Router}
 */
export function createRouter(screens, defaultRoute, mainContent, sidebar) {
  let currentRoute = null;
  let currentScreen = null;

  function init() {
    window.addEventListener('hashchange', handleHashChange);
    renderRoute(parseRoute());
  }

  function parseRoute() {
    const full = window.location.hash.replace('#', '').trim();
    const [path, query] = full.split('?');
    const params = query ? Object.fromEntries(new URLSearchParams(query)) : {};
    if (path && !screens[path] && import.meta.env?.DEV !== false) {
      console.warn(`[Router] Unknown route: ${path}, falling back to ${defaultRoute}`);
    }
    return { route: screens[path] ? path : defaultRoute, params };
  }

  function handleHashChange() {
    const { route } = parseRoute();
    if (route !== currentRoute) renderRoute(route);
  }

  function navigate(route) {
    if (!screens[route]) route = defaultRoute;
    if (window.location.hash !== `#${route}`) {
      window.location.hash = `#${route}`;
    } else {
      renderRoute(route);
    }
  }

  function getCurrentRoute() {
    return currentRoute;
  }

  function renderRoute(routePath) {
    const { route, params } = typeof routePath === 'object' ? routePath : { route: routePath, params: {} };
    if (!screens[route]) route = defaultRoute;
    currentRoute = route;

    const screen = screens[route];
    if (!mainContent) return;

    // Cleanup previous screen
    if (currentScreen?.destroy) {
      try {
        currentScreen.destroy();
      } catch (err) {
        /* ignore */
      }
    }

    try {
      mainContent.innerHTML = screen.render(params);
      screen.bind?.(mainContent, params);
      currentScreen = screen;
    } catch (err) {
      logger.error(`[Router] Screen render error (${route}):`, err.message);
      mainContent.innerHTML = renderErrorScreen(err, route);
      mainContent.querySelector('[data-action="reload"]')?.addEventListener('click', () => {
        location.reload();
      });
    }

    sidebar?.update?.(route);
    updateChatsBadge();

    // L2: Focus management on screen transition
    // Move focus to main content for screen readers
    mainContent.setAttribute('tabindex', '-1');
    mainContent.focus({ preventScroll: false });
    
    // Announce screen change
    import('./utils/dom.js').then(({ announce }) => {
      const screenTitle = route.slice(1).charAt(0).toUpperCase() + route.slice(2);
      announce(`Navigated to ${screenTitle} screen`);
    });
  }

  function renderErrorScreen(err, route) {
    return `
      <div class="empty-state" data-testid="screen-error">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Screen Error</div>
        <div class="empty-state-description">${escapeHtml(err.message)}</div>
        <button class="btn btn-primary mt-4" data-action="reload">Reload</button>
      </div>
    `;
  }

  function getTotalUnreadCount() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('isc:chat:unread:')) {
          total += parseInt(localStorage.getItem(key) || '0', 10);
        }
      }
    } catch {
      /* localStorage unavailable */
    }
    return total;
  }

  function updateChatsBadge() {
    if (currentRoute === '/chats') return;

    const count = getTotalUnreadCount();
    document.querySelectorAll('[data-testid="nav-tab-chats"]').forEach((el) => {
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

  function destroy() {
    window.removeEventListener('hashchange', handleHashChange);
    if (currentScreen?.destroy) currentScreen.destroy();
  }

  // Listen for chat unread updates
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('isc:chat:unread:')) updateChatsBadge();
  });

  init();

  return { navigate, getCurrentRoute, destroy };
}

/**
 * Setup global event handlers
 * @param {Object} options
 * @param {Function} options.onNavigate
 * @param {HTMLElement} options.mainContent
 * @param {Object} options.services
 * @param {Object} options.services.postService
 * @param {Object} options.services.networkService
 * @param {Object} options.services.modals
 */
export function setupEventHandlers({ onNavigate, mainContent, services }) {
  const { postService, networkService, modals } = services || {};

  document.addEventListener('isc:toast', (e) =>
    toasts.show(e.detail?.message, e.detail?.type, e.detail?.duration)
  );
  document.addEventListener('isc:new-channel', () => onNavigate('/compose'));
  document.addEventListener('isc:need-channel', () => {
    toasts.warning('Please select or create a channel first');
    onNavigate('/compose');
  });

  document.addEventListener('isc:refresh-feed', (e) => {
    if (window.location.hash === '#/now') {
      import('./screens/now.js').then((m) =>
        m.update?.(mainContent, { scrollToTop: e.detail?.scrollToTop ?? false })
      );
    }
  });

  document.addEventListener('isc:like-post', async (e) => {
    const { postId } = e.detail || {};
    if (!postId || !postService) return;
    postService.like(postId).catch(() => {});
  });

  document.addEventListener('isc:delete-post', async (e) => {
    const { postId } = e.detail || {};
    if (!postId || !modals || !postService) return;

    const ok = await modals.confirm('Delete this post?', {
      title: '🗑️ Delete Post',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await postService.delete(postId);
      import('./screens/now.js').then((m) => m.update?.(mainContent));
      toasts.success('Post deleted');
    } catch (err) {
      toasts.error(err.message);
    }
  });

  document.addEventListener('isc:reply-post', (e) => {
    const { postId } = e.detail || {};
    if (!postId || !postService) return;

    const post = postService.getById?.(postId);
    if (!post) return;

    onNavigate('/now');
    const snippet = (post.content || '').slice(0, 80);
    const quoteText = `> ${snippet}${post.content?.length > 80 ? '…' : ''}\n\n`;

    // Use rAF chain to ensure DOM is ready after navigation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const input = mainContent?.querySelector('[data-testid="compose-input"]');
        if (!input) return;
        input.value = quoteText;
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
    });
  });

  document.addEventListener('isc:discover-peers', async () => {
    if (!networkService) return;
    try {
      toasts.info('Discovering peers…');
      await networkService.discoverPeers();
      actions.setMatches(networkService.getMatches());
      if (window.location.hash === '#/discover') {
        import('./screens/discover.js').then((m) => m.update?.(mainContent));
      }
    } catch (err) {
      toasts.error(err.message);
    }
  });
}

/**
 * Setup keyboard shortcuts
 * @param {Object} options
 * @param {Function} options.onNavigate
 * @param {Function} options.onToggleDebug
 * @param {HTMLElement} options.mainContent
 * @param {Object} options.modals
 */
export function setupKeyboardShortcuts({ onNavigate, onToggleDebug, mainContent, modals }) {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);

    if (e.key === '?' && !mod && !inInput) {
      e.preventDefault();
      modals?.showHelp?.();
    }
    if (e.key === 'k' && mod) {
      e.preventDefault();
      onNavigate('/compose');
    }
    if (e.key === ',' && mod) {
      e.preventDefault();
      onNavigate('/settings');
    }
    if (e.key === 'd' && mod) {
      e.preventDefault();
      onToggleDebug();
    }
    if (e.key === '/' && !mod && !inInput) {
      e.preventDefault();
      mainContent?.querySelector('input, textarea')?.focus();
    }
    if (e.key === 'Escape') modals?.close?.();

    if (e.key === 'Tab' && !mod && !inInput) {
      e.preventDefault();
      cycleSidebarFocus(e.shiftKey ? -1 : 1);
    }

    if (e.key === 'Enter' && !mod && !inInput) {
      const focused = document.activeElement;
      if (focused?.classList.contains('nav-item')) {
        const href = focused.getAttribute('href');
        if (href) window.location.hash = href;
      }
    }

    if (e.key === ' ' && mod && !inInput) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('isc:toggle-chaos'));
    }
  });
}

function cycleSidebarFocus(direction) {
  const items = [...document.querySelectorAll('.snav-btn, .irc-channel-item, .nav-item, [role="tab"]')];
  if (!items.length) return;

  const focused = document.activeElement;
  const idx = focused && items.includes(focused) ? items.indexOf(focused) : -1;
  const next = (idx + direction + items.length) % items.length;
  items[next]?.focus();
}
