/**
 * Router Module
 *
 * Hash-based routing with screen management.
 * OOP class with proper lifecycle management.
 */

import { getState, actions } from '../state.js';
import { logger } from '../logger.js';
import { escapeHtml } from './utils/dom.js';
import { toasts } from '../utils/toast.js';

class Router {
  #screens;
  #defaultRoute;
  #mainContent;
  #sidebar;
  #currentRoute = null;
  #currentScreen = null;
  #boundHandlers = [];

  constructor(screens, defaultRoute, mainContent, sidebar) {
    this.#screens = screens;
    this.#defaultRoute = defaultRoute;
    this.#mainContent = mainContent;
    this.#sidebar = sidebar;
    this.#init();
  }

  #init() {
    const hashHandler = () => this.#handleHashChange();
    window.addEventListener('hashchange', hashHandler);
    this.#boundHandlers.push(() => window.removeEventListener('hashchange', hashHandler));

    const storageHandler = (e) => {
      if (e.key?.startsWith('isc:chat:unread:')) this.#updateChatsBadge();
    };
    window.addEventListener('storage', storageHandler);
    this.#boundHandlers.push(() => window.removeEventListener('storage', storageHandler));

    this.#renderRoute(this.#parseRoute());
  }

  #parseRoute() {
    const full = window.location.hash.replace('#', '').trim();
    const [path, query] = full.split('?');
    const params = query ? Object.fromEntries(new URLSearchParams(query)) : {};
    if (path && !this.#screens[path]) {
      console.warn(`[Router] Unknown route: ${path}, falling back to ${this.#defaultRoute}`);
    }
    return { route: this.#screens[path] ? path : this.#defaultRoute, params };
  }

  #handleHashChange() {
    const { route } = this.#parseRoute();
    if (route !== this.#currentRoute) this.#renderRoute(route);
  }

  navigate(route) {
    if (!this.#screens[route]) route = this.#defaultRoute;
    if (window.location.hash !== `#${route}`) {
      window.location.hash = `#${route}`;
    } else {
      this.#renderRoute(route);
    }
  }

  getCurrentRoute() {
    return this.#currentRoute;
  }

  #renderRoute(routePath) {
    const { route, params } =
      typeof routePath === 'object' ? routePath : { route: routePath, params: {} };
    if (!this.#screens[route]) route = this.#defaultRoute;
    this.#currentRoute = route;

    const screen = this.#screens[route];
    if (!this.#mainContent) return;

    if (this.#currentScreen?.destroy) {
      try {
        this.#currentScreen.destroy();
      } catch (err) {
        /* ignore */
      }
    }

    try {
      this.#mainContent.innerHTML = screen.render(params);
      screen.bind?.(this.#mainContent, params);
      this.#currentScreen = screen;
    } catch (err) {
      logger.error(`[Router] Screen render error (${route}):`, err.message);
      this.#mainContent.innerHTML = this.#renderErrorScreen(err, route);
      this.#mainContent.querySelector('[data-action="reload"]')?.addEventListener('click', () => {
        location.reload();
      });
    }

    this.#sidebar?.update?.(route);
    this.#updateChatsBadge();

    this.#mainContent.setAttribute('tabindex', '-1');
    this.#mainContent.focus({ preventScroll: false });

    import('./utils/dom.js').then(({ announce }) => {
      const screenTitle = route.slice(1).charAt(0).toUpperCase() + route.slice(2);
      announce(`Navigated to ${screenTitle} screen`);
    });
  }

  #renderErrorScreen(err, route) {
    return `
      <div class="empty-state" data-testid="screen-error">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Screen Error</div>
        <div class="empty-state-description">${escapeHtml(err.message)}</div>
        <button class="btn btn-primary mt-4" data-action="reload">Reload</button>
      </div>
    `;
  }

  #getTotalUnreadCount() {
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

  #updateChatsBadge() {
    if (this.#currentRoute === '/chats') return;

    const count = this.#getTotalUnreadCount();
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

  destroy() {
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
    if (this.#currentScreen?.destroy) this.#currentScreen.destroy();
  }
}

export { Router };

export function createRouter(screens, defaultRoute, mainContent, sidebar) {
  return new Router(screens, defaultRoute, mainContent, sidebar);
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
  document.addEventListener('isc:new-channel', () => {
    // Open ChannelEdit modal instead of navigating to /compose
    import('./components/channelEdit.js')
      .then((m) => m.openChannelEdit?.())
      .catch(() => {
        // Fallback: navigate to /now which prompts channel creation
        onNavigate('/now');
      });
  });
  document.addEventListener('isc:need-channel', () => {
    toasts.warning('Please select or create a channel first');
    import('./components/channelEdit.js')
      .then((m) => m.openChannelEdit?.())
      .catch(() => {
        onNavigate('/now');
      });
  });

  document.addEventListener('isc:refresh-feed', (e) => {
    if (window.location.hash === '#/channel') {
      import('./screens/channel.js').then((m) =>
        m.update?.(mainContent, { scrollToTop: e.detail?.scrollToTop ?? false })
      );
    }
    if (window.location.hash === '#/now') {
      import('./screens/now.js').then((m) => m.update?.(mainContent));
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
      import('./screens/channel.js').then((m) => m.update?.(mainContent));
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

    onNavigate('/channel');
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
      document.dispatchEvent(new CustomEvent('isc:new-channel'));
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
  const items = [
    ...document.querySelectorAll('.snav-btn, .irc-channel-item, .nav-item, [role="tab"]'),
  ];
  if (!items.length) return;

  const focused = document.activeElement;
  const idx = focused && items.includes(focused) ? items.indexOf(focused) : -1;
  const next = (idx + direction + items.length) % items.length;
  items[next]?.focus();
}
