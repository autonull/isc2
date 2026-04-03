/**
 * Sidebar Component
 *
 * IRC-style layout: nav strip at top, channel list fills space, status footer.
 */

import { getState, actions } from '../../state.js';
import { escapeHtml } from '../utils/dom.js';

const STATUS_MAP = {
  connected: { class: 'online', label: 'Online' },
  connecting: { class: 'connecting', label: 'Connecting...' },
  disconnected: { class: 'offline', label: 'Offline' },
  error: { class: 'offline', label: 'Error' },
};

/**
 * Create sidebar component
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Function} options.onNavigate
 * @param {Function} options.onNewChannel
 * @returns {Object} Sidebar API
 */
export function createSidebar(container, { onNavigate, onNewChannel }) {
  const el = document.createElement('aside');
  el.className = 'irc-sidebar';
  el.setAttribute('data-testid', 'sidebar');

  const state = getState();
  render(el, state);
  bind(el, { onNavigate, onNewChannel });
  container.appendChild(el);

  return {
    update(route, state = getState()) {
      updateSidebar(el, state, route);
    },
    setStatus({ status, peerCount }) {
      updateStatusFooter(el, status, peerCount);
    },
    destroy() { el.remove(); },
  };
}

function render(el, state) {
  const { channels, activeChannelId, status } = state;
  const statusInfo = STATUS_MAP[status] ?? { class: 'offline', label: 'Offline' };

  el.innerHTML = `
    <div class="sidebar-nav-strip" role="toolbar" aria-label="Main navigation" data-testid="sidebar-nav-strip">
      <button class="snav-btn" data-route="/now" title="Now — home dashboard" aria-label="Now" data-testid="nav-tab-now">⌂</button>
      <button class="snav-btn" data-route="/channel" title="Channel — message stream" aria-label="Channel" data-testid="nav-tab-channel">#</button>
      <button class="snav-btn" data-route="/chats" title="Chats" aria-label="Chats" data-testid="nav-tab-chats">◷</button>
      <button class="snav-btn" data-route="/settings" title="Settings (Ctrl+,)" aria-label="Settings" data-testid="nav-tab-settings">⚙</button>
    </div>

    <div class="irc-sidebar-scroll">
      <div class="irc-channels-section">
        <div class="irc-channels-header" data-testid="sidebar-channels-header" title="Your channels describe your current thinking. ISC finds peers on the same wavelength.">
          <span class="channels-label">My Channels</span>
          <button class="irc-add-btn" data-testid="new-channel-btn" title="New Channel (Ctrl+K)" aria-label="New Channel">+</button>
        </div>
        <ul class="irc-channel-list" data-testid="sidebar-channel-list" role="listbox" aria-label="Your channels">
          ${renderChannelItems(channels, activeChannelId)}
        </ul>
      </div>
    </div>

    <div class="sidebar-status-strip" data-testid="sidebar-status" role="status" aria-live="polite">
      <span class="sidebar-status-dot status-${statusInfo.class}" data-field="status-dot">●</span>
      <span class="sidebar-status-text" data-field="status-text">${statusInfo.label}</span>
      <span class="sidebar-status-peers" data-field="peer-count"></span>
      <button class="sidebar-debug-btn" data-testid="debug-toggle" title="Debug panel (Ctrl+D)" aria-label="Toggle debug panel">›</button>
    </div>
  `;
}

function renderChannelItems(channels, activeChannelId) {
  if (!channels?.length) {
    return '<li class="sidebar-empty" data-testid="sidebar-no-channels" data-empty>No channels yet — press + to start</li>';
  }

  return channels.map(ch => `
    <li class="irc-channel-item${ch.id === activeChannelId ? ' active' : ''}"
        data-testid="sidebar-channel-${ch.id}"
        data-channel-id="${ch.id}"
        data-active="${ch.id === activeChannelId}"
        tabindex="0"
        role="option"
        aria-selected="${ch.id === activeChannelId}"
        aria-label="Channel ${escapeHtml(ch.name)}">
      <span class="irc-channel-prefix">#</span>
      <span class="irc-channel-name">${escapeHtml(ch.name)}</span>
    </li>
  `).join('');
}

function updateSidebar(el, state, route) {
  const { channels, activeChannelId } = state;

  // Update nav strip active state
  el.querySelectorAll('.snav-btn').forEach(btn => {
    const active = btn.dataset.route === route;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : '');
    btn.setAttribute('data-active', String(active));
  });

  // Update channel list
  const channelList = el.querySelector('[data-testid="sidebar-channel-list"]');
  if (channelList) {
    channelList.innerHTML = renderChannelItems(channels, activeChannelId);
  }
}

function updateStatusFooter(el, status, peerCount) {
  const statusInfo = STATUS_MAP[status] ?? { class: 'offline', label: 'Offline' };
  const dot = el.querySelector('[data-field="status-dot"]');
  const text = el.querySelector('[data-field="status-text"]');
  const peers = el.querySelector('[data-field="peer-count"]');

  if (dot) dot.className = `sidebar-status-dot status-${statusInfo.class}`;
  if (text) text.textContent = statusInfo.label;
  if (peers) peers.textContent = peerCount > 0 ? `· ${peerCount} peer${peerCount !== 1 ? 's' : ''}` : '';
}

function bind(el, { onNavigate, onNewChannel }) {
  el.addEventListener('click', e => {
    const snavBtn = e.target.closest('.snav-btn');
    const channelItem = e.target.closest('.irc-channel-item');
    const addBtn = e.target.closest('[data-testid="new-channel-btn"]');
    const debugBtn = e.target.closest('[data-testid="debug-toggle"]');

    if (snavBtn) {
      const route = snavBtn.dataset.route;
      // If navigating to /channel but no channel is active, open ChannelEdit modal
      if (route === '/channel' && !getState().activeChannelId) {
        onNewChannel?.();
      } else {
        onNavigate(route);
      }
    }
    if (channelItem) {
      actions.setActiveChannel(channelItem.dataset.channelId);
      onNavigate('/channel');
    }
    if (addBtn) onNewChannel?.();
    if (debugBtn) el.dispatchEvent(new CustomEvent('isc:toggle-debug', { bubbles: true }));
  });

  el.addEventListener('keydown', e => {
    const item = e.target.closest('.irc-channel-item, .snav-btn');
    if (item && ['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      item.click();
    }

    // Arrow key navigation within nav strip
    const snavBtn = e.target.closest('.snav-btn');
    if (snavBtn && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      const btns = [...el.querySelectorAll('.snav-btn')];
      const idx = btns.indexOf(snavBtn);
      const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
      btns[next]?.focus();
    }
  });
}
