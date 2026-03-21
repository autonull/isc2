/**
 * Channel Drawer Component (Mobile)
 *
 * Slide-up bottom sheet showing channel list.
 * Hidden on desktop (sidebar is always visible).
 */

import { getState, actions } from '../../state.js';
import { escapeHtml } from '../../utils/dom.js';

export function createChannelDrawer(onNavigate) {
  const backdrop = document.createElement('div');
  backdrop.className = 'channel-drawer-backdrop';

  const drawer = document.createElement('div');
  drawer.className = 'channel-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', 'Your channels');
  drawer.setAttribute('data-testid', 'channel-drawer');

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  function render() {
    const { channels, activeChannelId } = getState();
    drawer.innerHTML = `
      <div class="channel-drawer-header">
        <span class="channel-drawer-title">My Channels</span>
        <button class="channel-drawer-new" data-testid="drawer-new-channel"
                aria-label="New Channel">+ New</button>
        <button class="channel-drawer-close" aria-label="Close">×</button>
      </div>
      <ul class="channel-drawer-list" role="listbox">
        ${channels.length === 0
          ? '<li class="drawer-empty">No channels yet — press + New to start</li>'
          : channels.map(ch => `
              <li class="drawer-channel-item${ch.id === activeChannelId ? ' active' : ''}"
                  data-channel-id="${escapeHtml(ch.id)}" role="option"
                  aria-selected="${ch.id === activeChannelId}" tabindex="0">
                <span class="drawer-channel-prefix">#</span>
                <span class="drawer-channel-name">${escapeHtml(ch.name)}</span>
              </li>
            `).join('')}
      </ul>
    `;
    bindDrawerEvents();
  }

  function bindDrawerEvents() {
    drawer.querySelector('.channel-drawer-close')
      ?.addEventListener('click', close);
    drawer.querySelector('.channel-drawer-new')
      ?.addEventListener('click', () => { close(); onNavigate('/compose'); });
    drawer.querySelectorAll('.drawer-channel-item').forEach(item => {
      item.addEventListener('click', () => {
        actions.setActiveChannel(item.dataset.channelId);
        onNavigate('/now');
        close();
      });
      item.addEventListener('keydown', (e) => {
        if (['Enter', ' '].includes(e.key)) {
          e.preventDefault();
          item.click();
        }
      });
    });
  }

  function open() {
    render();
    drawer.classList.add('open');
    backdrop.classList.add('open');
    document.addEventListener('keydown', handleEscape);
  }

  function close() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    document.removeEventListener('keydown', handleEscape);
  }

  function handleEscape(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', close);
  document.addEventListener('isc:toggle-channel-drawer', () => {
    drawer.classList.contains('open') ? close() : open();
  });

  return { open, close, destroy() { backdrop.remove(); drawer.remove(); } };
}
