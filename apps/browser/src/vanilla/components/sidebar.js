/**
 * Sidebar Component
 *
 * Navigation tabs + channel list + connection indicator.
 */

import { getState, actions } from '../../state.js';
import { escapeHtml } from '../../utils/dom.js';

const NAV_ITEMS = [
  { id: 'now', label: 'Now', icon: '🏠', route: '/now' },
  { id: 'discover', label: 'Discover', icon: '📡', route: '/discover' },
  { id: 'chats', label: 'Chats', icon: '💬', route: '/chats' },
  { id: 'video', label: 'Video', icon: '📹', route: '/video' },
  { id: 'settings', label: 'Settings', icon: '⚙️', route: '/settings' },
  { id: 'compose', label: 'New Channel', icon: '➕', route: '/compose', special: true },
];

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
    destroy() { el.remove(); },
  };
}

function render(el, state) {
  const { channels, activeChannelId, status } = state;
  const statusInfo = getStatusInfo(status);

  el.innerHTML = `
    <div class="irc-brand" data-testid="sidebar-brand">
      ISC
      <span class="connection-indicator status-${statusInfo.class}"
            data-testid="connection-status"
            title="Connection: ${statusInfo.label}">●</span>
    </div>
    <div class="irc-sidebar-scroll">
      ${renderNavList()}
      ${renderChannelList(channels, activeChannelId)}
    </div>
  `;
}

function renderNavList() {
  return `
    <ul class="irc-nav-list" data-testid="sidebar-nav-list" role="list" aria-label="Main navigation">
      ${NAV_ITEMS.map(tab => `
        <li class="irc-nav-item${tab.special ? ' compose' : ''}"
            data-testid="nav-tab-${tab.id}"
            data-tab="${tab.id}"
            data-route="${tab.route}"
            data-active="false"
            role="menuitem"
            tabindex="0"
            aria-label="${tab.label}">
          <span class="irc-nav-icon" aria-hidden="true">${tab.icon}</span>
          <span class="irc-nav-label">${tab.label}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderChannelList(channels, activeChannelId) {
  return `
    <div class="irc-channels-section">
      <div class="irc-channels-header" data-testid="sidebar-channels-header">
        <span>Channels</span>
        <button class="irc-add-btn" data-testid="new-channel-btn" title="New Channel (Ctrl+K)">+</button>
      </div>
      <ul class="irc-channel-list" data-testid="sidebar-channel-list">
        ${renderChannelItems(channels, activeChannelId)}
      </ul>
    </div>
  `;
}

function renderChannelItems(channels, activeChannelId) {
  if (!channels?.length) {
    return '<li class="empty text-muted" data-testid="sidebar-no-channels" data-empty style="padding:10px 14px;font-size:12px">No channels</li>';
  }

  return channels.map(ch => `
    <li class="irc-channel-item${ch.id === activeChannelId ? ' active' : ''}"
        data-testid="sidebar-channel-${ch.id}"
        data-channel-id="${ch.id}"
        data-active="${ch.id === activeChannelId}"
        tabindex="0"
        role="menuitem"
        aria-label="Channel ${escapeHtml(ch.name)}">
      <span class="irc-channel-prefix">#</span>
      <span class="irc-channel-name">${escapeHtml(ch.name)}</span>
    </li>
  `).join('');
}

function getStatusInfo(status) {
  return STATUS_MAP[status] ?? { class: 'offline', label: 'Offline' };
}

function updateSidebar(el, state, route) {
  const { channels, activeChannelId, status } = state;
  const statusInfo = getStatusInfo(status);

  // Update connection indicator
  const indicator = el.querySelector('[data-testid="connection-status"]');
  if (indicator) {
    indicator.className = `connection-indicator status-${statusInfo.class}`;
    indicator.title = `Connection: ${statusInfo.label}`;
  }

  // Update nav items
  el.querySelectorAll('.irc-nav-item').forEach(item => {
    const active = item.dataset.route === route;
    item.classList.toggle('active', active);
    item.setAttribute('data-active', String(active));
    item.setAttribute('aria-current', active ? 'page' : '');
  });

  // Update channel list
  const channelList = el.querySelector('[data-testid="sidebar-channel-list"]');
  if (channelList) {
    channelList.innerHTML = renderChannelItems(channels, activeChannelId);
  }
}

function bind(el, { onNavigate, onNewChannel }) {
  el.addEventListener('click', e => {
    const navItem = e.target.closest('.irc-nav-item');
    const channelItem = e.target.closest('.irc-channel-item');
    const addBtn = e.target.closest('[data-testid="new-channel-btn"]');

    if (navItem) onNavigate(navItem.dataset.route);
    if (channelItem) {
      actions.setActiveChannel(channelItem.dataset.channelId);
      onNavigate('/now');
    }
    if (addBtn) onNewChannel?.();
  });

  el.addEventListener('keydown', e => {
    if (['Enter', ' '].includes(e.key)) {
      const item = e.target.closest('.irc-nav-item, .irc-channel-item');
      if (item) {
        e.preventDefault();
        item.click();
      }
    }
  });
}
