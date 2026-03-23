/**
 * Chats Screen - P2P E2E encrypted direct messages via WebRTC DataChannels.
 */

import { chatService } from '../../services/index.js';
import { toasts } from '../../utils/toast.js';
import { modals } from '../components/modal.js';
import { ConversationListComponent } from '../components/conversationList.js';
import { ChatPanelComponent } from '../components/chatPanel.js';

class ChatsScreen {
  #container;
  #conversationList = null;
  #chatPanel = null;
  #boundHandlers = [];

  render() {
    const isOffline = !navigator.onLine;
    return `
      <div class="screen chats-screen" data-testid="chats-screen">
        ${this.#renderHeader()}
        ${isOffline ? this.#renderOfflineBanner() : ''}
        <div class="chats-layout" data-testid="chats-layout">
          <div class="conversation-list-container" data-component="conversation-list"></div>
          <div class="chat-panel-container" data-component="chat-panel"></div>
        </div>
      </div>
    `;
  }

  #renderHeader() {
    return `
      <div class="screen-header" data-testid="chats-header">
        <h1 class="screen-title">💬 Chats <span class="screen-subtitle">E2E encrypted</span></h1>
        <div class="header-actions">
          <a href="#/channel" class="btn btn-ghost btn-sm">Open Channel</a>
          <button class="btn btn-primary btn-sm" id="new-chat-btn" data-testid="new-chat-btn" aria-label="New conversation">+</button>
        </div>
      </div>
    `;
  }

  #renderOfflineBanner() {
    return `<div class="info-banner offline" data-testid="offline-indicator">📡 Offline — messages will be queued and delivered when reconnected</div>`;
  }

  bind(container) {
    this.#container = container;
    const listContainer = container.querySelector('[data-component="conversation-list"]');
    const panelContainer = container.querySelector('[data-component="chat-panel"]');

    this.#conversationList = new ConversationListComponent(listContainer, {
      onSelect: (peerId) => this.#openChat(peerId),
    });

    this.#chatPanel = new ChatPanelComponent(panelContainer);

    chatService.setIncomingHandler(({ peerId, message }) => {
      this.#conversationList?.refresh();
      if (this.#chatPanel?.peerId === peerId) {
        this.#chatPanel.appendMessage(message);
      }
    });

    this.#bindEvents(container);
    return () => this.#cleanup();
  }

  #bindEvents(container) {
    const handleNewMessage = (e) => {
      const { peerId, peerName, content } = e.detail || {};
      if (peerId !== this.#chatPanel?.peerId) {
        toasts.info(`💬 ${peerName}: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`);
      }
    };
    document.addEventListener('isc:new-chat-message', handleNewMessage);
    this.#boundHandlers.push(() =>
      document.removeEventListener('isc:new-chat-message', handleNewMessage)
    );

    const handleStartChat = (e) => {
      const { peerId } = e.detail || {};
      if (!peerId) return;
      this.#conversationList?.setActivePeer(peerId);
      this.#chatPanel?.setPeer(peerId);
    };
    document.addEventListener('isc:start-chat', handleStartChat);
    this.#boundHandlers.push(() => document.removeEventListener('isc:start-chat', handleStartChat));

    const handleStorage = (e) => {
      if (
        !e.key?.startsWith('isc:chat:') ||
        e.key.includes(':unread:') ||
        e.key.includes(':typing:')
      )
        return;
      this.#conversationList?.refresh();
    };
    window.addEventListener('storage', handleStorage);
    this.#boundHandlers.push(() => window.removeEventListener('storage', handleStorage));

    const handleOnline = () =>
      container.querySelector('[data-testid="offline-indicator"]')?.remove();
    window.addEventListener('online', handleOnline);
    this.#boundHandlers.push(() => window.removeEventListener('online', handleOnline));

    const handleOffline = () => {
      if (!container.querySelector('[data-testid="offline-indicator"]')) {
        const banner = document.createElement('div');
        banner.className = 'info-banner offline';
        banner.setAttribute('data-testid', 'offline-indicator');
        banner.textContent = '📡 Offline — messages will be queued and delivered when reconnected';
        container.querySelector('.chats-layout')?.before(banner);
      }
    };
    window.addEventListener('offline', handleOffline);
    this.#boundHandlers.push(() => window.removeEventListener('offline', handleOffline));

    container
      .querySelector('#new-chat-btn')
      ?.addEventListener('click', () => this.#showNewChatModal());
  }

  #openChat(peerId) {
    this.#conversationList?.setActivePeer(peerId);
    this.#chatPanel?.setPeer(peerId);
    this.#container?.querySelector('.chats-layout')?.classList.add('chat-open');
  }

  async #showNewChatModal() {
    const html = `
      <div class="modal-header">
        <h2 class="modal-title">Start Conversation</h2>
        <button class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="dial-peer-id-input">Peer ID</label>
          <input type="text" id="dial-peer-id-input" class="form-input font-mono" placeholder="12D3KooW…" autocomplete="off" data-testid="dial-peer-input" />
          <div class="form-hint">Paste a peer's ID to open a direct encrypted chat.</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="confirm" id="dial-confirm-btn">Open Chat</button>
      </div>
    `;
    const overlay = modals.open(html);
    overlay
      .querySelector('[data-action="cancel"]')
      ?.addEventListener('click', () => modals.close());
    overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
      const peerId = overlay.querySelector('#dial-peer-id-input')?.value.trim();
      if (!peerId) return;
      modals.close();
      this.#conversationList?.setActivePeer(peerId);
      this.#chatPanel?.setPeer(peerId);
    });
  }

  update() {
    this.#conversationList?.refresh();
    this.#chatPanel?.refresh();
  }

  #cleanup() {
    this.#conversationList?.destroy();
    this.#chatPanel?.destroy();
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
  }

  destroy() {
    this.#cleanup();
    this.#conversationList = null;
    this.#chatPanel = null;
    this.#container = null;
  }
}

const chatsScreen = new ChatsScreen();
export const { render, bind, update, destroy } = chatsScreen;
