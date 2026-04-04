/**
 * Chat Panel Component
 *
 * Individual chat view with messages, input, and typing indicator.
 * OOP class with self-contained state and scoped events.
 */

import { chatService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { toast as toasts } from '../../utils/toast.ts';
import { modals } from '../components/modal.js';
import { escapeHtml } from '../utils/dom.js';
import { formatTimestamp } from '../../utils/time.ts';
import { renderEmpty } from '../utils/screen.js';

const TYPING_TTL = 3000;

class ChatPanelComponent {
  #container;
  #peerId = null;
  #boundHandlers = [];
  #typingTimeout = null;
  #typingInterval = null;

  constructor(container, { peerId = null } = {}) {
    this.#container = container;
    this.#peerId = peerId;
    this.#render();
    this.#bind();
  }

  setPeer(peerId) {
    this.#peerId = peerId;
    this.#render();
    this.#bind();
    this.#container.dispatchEvent(
      new CustomEvent('chat:opened', {
        detail: { peerId },
        bubbles: true,
      })
    );
  }

  get peerId() {
    return this.#peerId;
  }

  #render() {
    const conversations = chatService.getConversations();
    this.#container.innerHTML = this.#peerId
      ? this.#renderChatView(this.#peerId, conversations)
      : this.#renderNoChatSelected();
  }

  #renderNoChatSelected() {
    return `
      <div class="chat-panel" data-testid="chat-panel">
        <div class="no-chat-selected" data-testid="no-chat-selected">
          ${renderEmpty({
            icon: '🔐',
            title: 'Select a conversation',
            description: 'Choose from the list to open a secure channel.',
          })}
          <div class="encryption-badge">
            <span>🔒 End-to-end encrypted</span>
            <span>·</span>
            <span>🌐 No central server</span>
            <span>·</span>
            <span>⚡ WebRTC direct</span>
          </div>
        </div>
      </div>
    `;
  }

  #renderChatView(peerId, conversations) {
    const conv = conversations.find((c) => c.peerId === peerId);
    const messages = chatService.getMessages(peerId);
    const name = conv?.name ?? 'Anonymous';
    const online = conv?.online ?? false;
    const simPct = conv?.similarity != null ? Math.round(conv.similarity * 100) : null;

    return `
      <div class="chat-panel" data-testid="chat-panel">
        <div class="chat-view" data-peer-id="${escapeHtml(peerId)}" data-testid="chat-view">
          ${this.#renderChatHeader(name, online, simPct)}
          ${this.#renderChatMessages(messages, name, simPct)}
          ${this.#renderTypingIndicator(name)}
          ${this.#renderChatInput(name)}
        </div>
      </div>
    `;
  }

  #renderChatHeader(name, online, simPct) {
    return `
      <div class="chat-header" data-testid="chat-header">
        <div class="chat-peer-info">
          <div class="chat-avatar">${(name[0] ?? 'A').toUpperCase()}</div>
          <div>
            <span class="chat-peer-name" data-testid="chat-peer-name">${escapeHtml(name)}</span>
            <div class="flex-row gap-2">
              <span class="chat-peer-status ${online ? 'online' : 'offline'}" data-testid="chat-peer-status">
                ${online ? '● Online' : '○ Offline'}
              </span>
              ${simPct != null ? `<span class="chat-sim-badge">${simPct}% match</span>` : ''}
            </div>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="btn btn-ghost btn-sm" data-action="more" title="More options" aria-label="More options" data-testid="chat-more-btn">⋮</button>
          <button class="btn btn-ghost btn-sm mobile-back-btn" data-action="back" title="Back to conversations" data-testid="close-chat-mobile" aria-label="Close chat">← Back</button>
          <button class="btn btn-icon desktop-close-btn" data-action="close" data-testid="close-chat" title="Close conversation" aria-label="Close chat">×</button>
        </div>
      </div>
    `;
  }

  #renderChatMessages(messages, name, simPct) {
    if (messages.length === 0) {
      return `
        <div class="chat-messages" id="chat-messages" data-testid="chat-messages">
          <div class="chat-start-state" data-testid="empty-chat">
            <div class="chat-start-avatar">${(name[0] ?? 'A').toUpperCase()}</div>
            <div class="chat-start-name">${escapeHtml(name)}</div>
            ${
              simPct != null
                ? `<div class="chat-start-sim"><span>Your thoughts are</span><strong class="sim-value">${simPct}% similar</strong></div>`
                : ''
            }
            <div class="encryption-badge small">🔒 Messages are end-to-end encrypted</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="chat-messages" id="chat-messages" data-testid="chat-messages">
        ${this.#renderMessageGroup(messages)}
      </div>
    `;
  }

  #renderMessageGroup(messages) {
    let html = '';
    let lastDate = null;

    messages.forEach((msg) => {
      const msgDate = new Date(msg.timestamp).toDateString();
      if (msgDate !== lastDate) {
        html += `<div class="chat-date-separator"><span>${this.#formatDateLabel(msg.timestamp)}</span></div>`;
        lastDate = msgDate;
      }
      html += this.#renderMessage(msg);
    });

    return html;
  }

  #formatDateLabel(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }

  #renderMessage(msg) {
    const statusIcon = msg.delivered ? '✓✓' : msg.pending ? '○' : '✓';
    const time = formatTimestamp(msg.timestamp);

    return `
      <div class="chat-message${msg.fromMe ? ' own' : ''}" data-testid="chat-message" data-msg-id="${escapeHtml(msg.id)}">
        <div class="message-bubble">
          <div class="message-content">${escapeHtml(msg.content)}</div>
          <div class="message-meta">
            <span class="message-time" title="${new Date(msg.timestamp).toLocaleString()}">${time}</span>
            ${msg.fromMe ? `<span class="message-status ${msg.delivered ? 'delivered' : ''}" title="${msg.delivered ? 'Delivered' : msg.pending ? 'Sending…' : 'Sent'}">${statusIcon}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  #renderTypingIndicator(name) {
    return `
      <div class="typing-indicator hidden" id="typing-indicator" aria-live="polite">
        <span class="typing-dots"><span></span><span></span><span></span></span>
        <span class="typing-text">${escapeHtml(name)} is typing…</span>
      </div>
    `;
  }

  #renderChatInput(name) {
    return `
      <div class="chat-input-area" data-testid="chat-input-area">
        <textarea class="chat-input" id="chat-input"
                  placeholder="Message ${escapeHtml(name)}…"
                  autocomplete="off" maxlength="2000" rows="1"
                  data-testid="chat-input" aria-label="Message input"></textarea>
        <button class="btn btn-primary btn-sm" id="chat-send" data-testid="send-message-button" aria-label="Send message">Send</button>
      </div>
      <div class="chat-input-hint">Enter to send · Shift+Enter for newline</div>
    `;
  }

  #bind() {
    this.#startTypingCheck();
    this.#bindChatActions();
  }

  #startTypingCheck() {
    this.#typingInterval = setInterval(() => {
      if (!this.#peerId) return;
      const identity = networkService.getIdentity();
      const myId = identity?.pubkey ?? identity?.peerId;
      if (!myId) return;

      const key = `isc:typing:${this.#peerId}:to:${myId}`;
      try {
        const lastTyping = parseInt(localStorage.getItem(key) || '0', 10);
        const now = Date.now();
        const indicator = this.#container.querySelector('#typing-indicator');
        if (indicator && now - lastTyping < TYPING_TTL) {
          indicator.classList.remove('hidden');
          clearTimeout(this.#typingTimeout);
          this.#typingTimeout = setTimeout(() => indicator.classList.add('hidden'), TYPING_TTL);
        }
      } catch (err) {
        console.debug('Typing check failed:', err);
      }
    }, 500);
  }

  #bindChatActions() {
    const chatView = this.#container.querySelector('.chat-view');
    if (!chatView) return;

    chatView.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;

      switch (action) {
        case 'more':
          this.#showMoreMenu();
          break;
        case 'close':
        case 'back':
          this.#peerId = null;
          this.#render();
          this.#bind();
          this.#container.dispatchEvent(
            new CustomEvent('chat:closed', {
              detail: { peerId: this.#peerId },
              bubbles: true,
            })
          );
          break;
      }
    });

    const input = this.#container.querySelector('#chat-input');
    const sendBtn = this.#container.querySelector('#chat-send');

    const sendMessage = async () => {
      const content = input?.value.trim();
      if (!content || !this.#peerId) return;

      try {
        await chatService.send(this.#peerId, content);
        input.value = '';
        this.#refreshMessages();
      } catch (err) {
        toasts.error('Failed to send: ' + err.message);
      }
    };

    sendBtn?.addEventListener('click', sendMessage);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  #showMoreMenu() {
    const peerId = this.#peerId;
    const html = `
      <div class="modal-header">
        <h2 class="modal-title">More Options</h2>
        <button class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body chat-more-menu">
        <button class="chat-more-item danger" data-action="block-peer">
          <span class="chat-more-icon">🚫</span>
          <span class="chat-more-label">Block Peer</span>
          <span class="chat-more-desc">Stop receiving messages from this person</span>
        </button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="cancel">Cancel</button>
      </div>
    `;
    const overlay = modals.open(html);
    overlay
      .querySelector('[data-action="cancel"]')
      ?.addEventListener('click', () => modals.close());
    overlay.querySelector('[data-action="block-peer"]')?.addEventListener('click', () => {
      modals.close();
      const peer = networkService.getMatches?.()?.find((p) => p.peerId === peerId) ?? {
        peerId,
        identity: { name: '?', bio: '' },
        similarity: null,
      };
      modals.showPeerProfile(peer);
    });
  }

  #refreshMessages() {
    if (!this.#peerId) return;
    const conversations = chatService.getConversations();
    const conv = conversations.find((c) => c.peerId === this.#peerId);
    const messages = chatService.getMessages(this.#peerId);
    const name = conv?.name ?? 'Anonymous';
    const simPct = conv?.similarity != null ? Math.round(conv.similarity * 100) : null;

    const messagesEl = this.#container.querySelector('.chat-messages');
    if (messagesEl) {
      messagesEl.innerHTML =
        messages.length === 0
          ? (this.#renderChatMessages([], name, simPct).match(
              /<div class="chat-messages"[^>]*>([\s\S]*?)<\/div>/
            )?.[1] ?? '')
          : this.#renderMessageGroup(messages);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  appendMessage(message) {
    const messagesEl = this.#container.querySelector('.chat-messages');
    if (messagesEl) {
      messagesEl.querySelector('.chat-start-state')?.remove();
      messagesEl.insertAdjacentHTML('beforeend', this.#renderMessage(message));
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  refresh() {
    this.#render();
    this.#bind();
  }

  destroy() {
    clearTimeout(this.#typingTimeout);
    this.#typingTimeout = null;
    if (this.#typingInterval) {
      clearInterval(this.#typingInterval);
      this.#typingInterval = null;
    }
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
    this.#container.innerHTML = '';
  }
}

export { ChatPanelComponent };
