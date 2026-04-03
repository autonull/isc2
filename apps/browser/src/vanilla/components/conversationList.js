/**
 * Conversation List Component
 *
 * Displays list of active conversations with unread counts.
 * OOP class with self-contained state and scoped events.
 */

import { chatService } from '../../services/index.js';
import { escapeHtml } from '../utils/dom.js';
import { formatTime } from '../../utils/time.ts';
import { getProximityTier, formatProximity } from '../../utils/proximity.ts';
import { renderEmpty } from '../utils/screen.js';

class ConversationListComponent {
  #container;
  #activePeerId = null;
  #onSelect = null;
  #boundHandlers = [];

  constructor(container, { activePeerId = null, onSelect } = {}) {
    this.#container = container;
    this.#activePeerId = activePeerId;
    this.#onSelect = onSelect;
    this.#render();
    this.#bind();
  }

  setActivePeer(peerId) {
    this.#activePeerId = peerId;
    this.#updateActiveState();
  }

  get activePeerId() {
    return this.#activePeerId;
  }

  #render() {
    const conversations = chatService.getConversations();
    this.#container.innerHTML = this.#renderList(conversations);
  }

  #renderList(conversations) {
    return `
      <div class="conversation-list-panel" data-testid="conversation-list-panel">
        <div class="panel-header">
          <span class="panel-title">Conversations</span>
          <span class="panel-subtitle">${conversations.length > 0 ? `${conversations.length} peer${conversations.length !== 1 ? 's' : ''}` : ''}</span>
        </div>
        <div class="conversation-list" data-testid="conversation-list">
          ${conversations.length === 0 ? this.#renderEmpty() : conversations.map((c) => this.#renderItem(c)).join('')}
        </div>
      </div>
    `;
  }

  #renderEmpty() {
    return `<div data-testid="empty-conversations">${renderEmpty({
      icon: '🔭',
      title: 'No conversations yet',
      description: 'Create a channel to find peers with similar interests.',
      actions: [{ label: '# Open Channel', href: '#/channel', variant: 'primary' }],
    })}</div>`;
  }

  #renderItem(conv) {
    const isActive = conv.peerId === this.#activePeerId;
    const preview = conv.lastMessage?.content?.slice(0, 50) ?? 'No messages yet…';
    const time = conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : '';
    const initial = (conv.name?.[0] ?? 'C').toUpperCase();
    const similarity = conv.similarity ?? null;
    const unread = conv.unreadCount > 0;
    const tier = similarity != null ? getProximityTier(similarity) : null;
    const tierClass = tier?.cssClass ?? '';
    const tierLabel = similarity != null ? formatProximity(similarity) : '';

    return `
      <div class="conversation-item${isActive ? ' active' : ''}${unread ? ' has-unread' : ''} ${tierClass}"
           data-peer-id="${escapeHtml(conv.peerId)}"
           data-testid="conversation-${escapeHtml(conv.peerId)}"
           tabindex="0" role="option" aria-selected="${isActive}">
        <div class="conv-avatar${conv.online ? ' online' : ''}">${initial}</div>
        <div class="conv-info">
          <div class="conv-header">
            <span class="conv-name">${escapeHtml(conv.name ?? 'Unknown')}</span>
            <span class="conv-time">${time}</span>
          </div>
          <div class="conv-preview-row">
            <span class="conv-preview">${escapeHtml(preview)}</span>
            ${unread ? `<span class="unread-badge" aria-label="${conv.unreadCount} unread">${conv.unreadCount}</span>` : ''}
          </div>
          ${tierLabel ? `<div class="conv-tier">${tierLabel}</div>` : ''}
        </div>
      </div>
    `;
  }

  #bind() {
    const list = this.#container.querySelector('.conversation-list');
    if (!list) return;

    const clickHandler = (e) => {
      const item = e.target.closest('.conversation-item');
      if (item) {
        this.#activePeerId = item.dataset.peerId;
        this.#updateActiveState();
        this.#container.dispatchEvent(
          new CustomEvent('conversation:select', {
            detail: { peerId: this.#activePeerId },
            bubbles: true,
          })
        );
      }
    };
    list.addEventListener('click', clickHandler);
    this.#boundHandlers.push(() => list.removeEventListener('click', clickHandler));

    const keydownHandler = (e) => {
      const items = [...list.querySelectorAll('.conversation-item')];
      const idx = items.findIndex((el) => el === document.activeElement);

      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        e.target.closest('.conversation-item')?.click();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[Math.min(idx + 1, items.length - 1)]?.focus();
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[Math.max(idx - 1, 0)]?.focus();
      }
    };
    list.addEventListener('keydown', keydownHandler);
    this.#boundHandlers.push(() => list.removeEventListener('keydown', keydownHandler));
  }

  #updateActiveState() {
    this.#container.querySelectorAll('.conversation-item').forEach((el) => {
      const active = el.dataset.peerId === this.#activePeerId;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', String(active));
    });
  }

  refresh() {
    this.#render();
    this.#bind();
  }

  destroy() {
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
    this.#container.innerHTML = '';
  }
}

export { ConversationListComponent };
