/**
 * Channel Drawer Component (Mobile)
 *
 * Slide-up bottom sheet showing channel list.
 * OOP class with self-contained state and scoped event handling.
 */

import { getState, actions } from '../../state.js';
import { escapeHtml } from '../../utils/dom.js';

class ChannelDrawerComponent {
  #onNavigate;
  #drawer;
  #backdrop;
  #boundHandlers = [];

  constructor(onNavigate) {
    this.#onNavigate = onNavigate;
    this.#backdrop = document.createElement('div');
    this.#backdrop.className = 'channel-drawer-backdrop';

    this.#drawer = document.createElement('div');
    this.#drawer.className = 'channel-drawer';
    this.#drawer.setAttribute('role', 'dialog');
    this.#drawer.setAttribute('aria-label', 'Your channels');
    this.#drawer.setAttribute('data-testid', 'channel-drawer');

    document.body.appendChild(this.#backdrop);
    document.body.appendChild(this.#drawer);

    this.#bind();
  }

  #bind() {
    this.#backdrop.addEventListener('click', () => this.close());
    this.#boundHandlers.push(() => this.#backdrop.removeEventListener('click', this.close));

    const handleKeydown = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', handleKeydown);
    this.#boundHandlers.push(() => document.removeEventListener('keydown', handleKeydown));
  }

  #render() {
    const { channels, activeChannelId } = getState();
    this.#drawer.innerHTML = `
      <div class="channel-drawer-header">
        <span class="channel-drawer-title">My Channels</span>
        <button class="channel-drawer-new" data-testid="drawer-new-channel" aria-label="New Channel">+ New</button>
        <button class="channel-drawer-close" aria-label="Close">×</button>
      </div>
      <ul class="channel-drawer-list" role="listbox">
        ${
          channels.length === 0
            ? '<li class="drawer-empty">No channels yet — press + New to start</li>'
            : channels
                .map(
                  (ch) => `
              <li class="drawer-channel-item${ch.id === activeChannelId ? ' active' : ''}"
                  data-channel-id="${escapeHtml(ch.id)}" role="option"
                  aria-selected="${ch.id === activeChannelId}" tabindex="0">
                <span class="drawer-channel-prefix">#</span>
                <span class="drawer-channel-name">${escapeHtml(ch.name)}</span>
              </li>
            `
                )
                .join('')
        }
      </ul>
    `;

    this.#drawer
      .querySelector('.channel-drawer-close')
      ?.addEventListener('click', () => this.close());
    this.#drawer.querySelector('.channel-drawer-new')?.addEventListener('click', () => {
      this.close();
      this.#dispatch('drawer:new-channel');
    });

    this.#drawer.querySelectorAll('.drawer-channel-item').forEach((item) => {
      const handler = () => {
        actions.setActiveChannel(item.dataset.channelId);
        this.#onNavigate('/channel');
        this.close();
      };
      item.addEventListener('click', handler);
      item.addEventListener('keydown', (e) => {
        if (['Enter', ' '].includes(e.key)) {
          e.preventDefault();
          handler();
        }
      });
    });
  }

  #dispatch(eventName, detail = {}) {
    this.#drawer.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
  }

  open() {
    this.#render();
    this.#drawer.classList.add('open');
    this.#backdrop.classList.add('open');
  }

  close() {
    this.#drawer.classList.remove('open');
    this.#backdrop.classList.remove('open');
  }

  toggle() {
    this.#drawer.classList.contains('open') ? this.close() : this.open();
  }

  destroy() {
    this.close();
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
    this.#backdrop.remove();
    this.#drawer.remove();
  }
}

export function createChannelDrawer(onNavigate) {
  return new ChannelDrawerComponent(onNavigate);
}

export { ChannelDrawerComponent };
