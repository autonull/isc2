/**
 * IRC-style Sidebar Component
 * Navigation tabs + channel list + connection indicator
 */

import { getState, actions } from '../../state.js';
import { escapeHtml } from '../../utils/dom.js';

const NAV_ITEMS = [
  { id: 'now',      label: 'Now',         icon: '🏠', route: '/now' },
  { id: 'discover', label: 'Discover',    icon: '📡', route: '/discover' },
  { id: 'chats',    label: 'Chats',       icon: '💬', route: '/chats' },
  { id: 'video',    label: 'Video',       icon: '📹', route: '/video' },
  { id: 'settings', label: 'Settings',    icon: '⚙️', route: '/settings' },
  { id: 'compose',  label: 'New Channel', icon: '➕', route: '/compose', special: true },
];

export function createSidebar(container, { onNavigate, onNewChannel }) {
  const el = document.createElement('aside');
  el.className = 'irc-sidebar';
  el.setAttribute('data-testid', 'sidebar');
  el.setAttribute('data-component', 'irc-sidebar');

  renderInto(el, getState(), null);
  container.appendChild(el);
  bindHandlers(el, { onNavigate, onNewChannel });

  return {
    update(route, state = getState()) {
      const { channels, activeChannelId, status } = state;

      // Update connection indicator
      const indicator = el.querySelector('[data-testid="connection-status"]');
      if (indicator) {
        const cls = statusClass(status);
        indicator.className = `connection-indicator status-${cls}`;
        indicator.title = `Connection: ${cls}`;
      }

      // Update active nav items
      el.querySelectorAll('.irc-nav-item').forEach(item => {
        const active = item.dataset.route === route;
        item.classList.toggle('active', active);
        item.setAttribute('data-active', String(active));
        item.setAttribute('aria-current', active ? 'page' : '');
      });

      // Update channel list
      const channelList = el.querySelector('[data-testid="sidebar-channel-list"]');
      if (channelList) channelList.innerHTML = channelListHTML(channels, activeChannelId);
    },

    destroy() { el.remove(); },
  };
}

function renderInto(el, state, route) {
  const { channels, activeChannelId, status } = state;
  const cls = statusClass(status);

  el.innerHTML = `
    <div class="irc-brand" data-testid="sidebar-brand" data-component="irc-brand">
      ISC
      <span class="connection-indicator status-${cls}"
            data-testid="connection-status"
            title="Connection: ${cls}">●</span>
    </div>
    <div class="irc-sidebar-scroll">
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
            <span class="irc-nav-icon" data-testid="nav-tab-${tab.id}-icon" aria-hidden="true">${tab.icon}</span>
            <span class="irc-nav-label" data-testid="nav-tab-${tab.id}-label">${tab.label}</span>
          </li>
        `).join('')}
      </ul>

      <div class="irc-channels-section">
        <div class="irc-channels-header" data-testid="sidebar-channels-header" data-component="irc-channels-header">
          <span>Channels</span>
          <button class="irc-add-btn" data-testid="new-channel-btn" title="New Channel (Ctrl+K)" aria-label="New channel">+</button>
        </div>
        <ul class="irc-channel-list" data-testid="sidebar-channel-list" data-component="irc-channel-list">
          ${channelListHTML(channels, activeChannelId)}
        </ul>
      </div>
    </div>
  `;
}

function channelListHTML(channels, activeChannelId) {
  if (!channels?.length) {
    return `<li class="empty text-muted" data-testid="sidebar-no-channels" data-empty
               style="padding:10px 14px;font-size:12px">No channels</li>`;
  }
  return channels.map(ch => `
    <li class="irc-channel-item${ch.id === activeChannelId ? ' active' : ''}"
        data-testid="sidebar-channel-${ch.id}"
        data-channel-id="${ch.id}"
        data-active="${ch.id === activeChannelId}"
        tabindex="0"
        role="menuitem"
        aria-label="Channel ${ch.name}">
      <span class="irc-channel-prefix">#</span>
      <span class="irc-channel-name" data-testid="sidebar-channel-${ch.id}-name">${escapeHtml(ch.name)}</span>
    </li>
  `).join('');
}

function statusClass(status) {
  return { connected: 'online', connecting: 'connecting', disconnected: 'offline', error: 'offline' }[status] ?? 'offline';
}

function bindHandlers(el, { onNavigate, onNewChannel }) {
  el.addEventListener('click', e => {
    const navItem     = e.target.closest('.irc-nav-item');
    const channelItem = e.target.closest('.irc-channel-item');
    const addBtn      = e.target.closest('[data-testid="new-channel-btn"]');

    if (navItem)     onNavigate(navItem.dataset.route);
    if (channelItem) { actions.setActiveChannel(channelItem.dataset.channelId); onNavigate('/now'); }
    if (addBtn)      onNewChannel?.();
  });

  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('.irc-nav-item, .irc-channel-item');
      if (item) { e.preventDefault(); item.click(); }
    }
  });
}
