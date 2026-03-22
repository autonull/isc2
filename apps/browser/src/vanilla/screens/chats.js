/**
 * Chats Screen
 *
 * P2P end-to-end encrypted direct messages via WebRTC DataChannels.
 */

import { chatService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { toasts } from '../../utils/toast.js';
import { escapeHtml } from '../utils/dom.js';
import { formatTime, formatTimestamp } from '../../utils/time.js';
import { renderEmpty, createScreen } from '../utils/screen.js';
import { getBridgeSuggestions } from '../../services/thoughtBridging.ts';
import { markPeerContacted } from '../../services/peerProximity.ts';
import { modals } from '../components/modal.js';

let activePeerId = null;
let boundContainer = null;
let typingTimeout = null;
let typingInterval = null;
const TYPING_TTL = 3000;
let currentBridgeSuggestion = null;
let handleNewMessage = null;

const SIM_CLASS = {
  0.85: 'very-high',
  0.7: 'high',
  0.55: 'medium',
};

export function render() {
  const conversations = chatService.getConversations();
  const isOffline = !navigator.onLine;

  return `
    <div class="screen chats-screen" data-testid="chats-screen">
      ${renderHeader()}
      ${isOffline ? renderOfflineBanner() : ''}
      <div class="chats-layout" data-testid="chats-layout">
        ${renderConversationList(conversations)}
        ${renderChatPanel(activePeerId, conversations)}
      </div>
    </div>
  `;
}

function renderHeader() {
  return `
    <div class="screen-header" data-testid="chats-header">
      <h1 class="screen-title">💬 Chats <span class="screen-subtitle">E2E encrypted</span></h1>
      <div class="header-actions">
        <a href="#/channel" class="btn btn-ghost btn-sm">Open Channel</a>
        <button class="btn btn-primary btn-sm" id="new-chat-btn"
                data-testid="new-chat-btn" aria-label="New conversation">+</button>
      </div>
    </div>
  `;
}

function renderOfflineBanner() {
  return `
    <div class="info-banner offline" data-testid="offline-indicator">
      📡 Offline — messages will be queued and delivered when reconnected
    </div>
  `;
}

function renderConversationList(conversations) {
  return `
    <div class="conversation-list-panel" data-testid="conversation-list-panel">
      <div class="panel-header">
        <span class="panel-title">Conversations</span>
        <span class="panel-subtitle">${conversations.length > 0 ? `${conversations.length} peer${conversations.length !== 1 ? 's' : ''}` : ''}</span>
      </div>
      <div class="conversation-list" data-testid="conversation-list" id="conversation-list">
        ${
          conversations.length === 0
            ? renderEmptyConv()
            : conversations.map((c) => renderConvItem(c, activePeerId)).join('')
        }
      </div>
    </div>
  `;
}

function renderEmptyConv() {
  return renderEmpty({
    icon: '🔭',
    title: 'No conversations yet',
    description: 'Create a channel to find peers with similar interests.',
    actions: [{ label: '# Open Channel', href: '#/channel', variant: 'primary' }],
  });
}

function renderConvItem(conv, active) {
  const isActive = conv.peerId === active;
  const preview = conv.lastMessage?.content?.slice(0, 50) ?? 'No messages yet…';
  const time = conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : '';
  const initial = (conv.name?.[0] ?? 'C').toUpperCase();
  const simPct = conv.similarity != null ? Math.round(conv.similarity * 100) : null;
  const simClass = getSimClass(conv.similarity);
  const unread = conv.unreadCount > 0;
  const simIcon = simPct >= 85 ? '🔥' : simPct >= 70 ? '✨' : '~';

  return `
    <div class="conversation-item${isActive ? ' active' : ''}${unread ? ' has-unread' : ''}"
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
        ${simPct != null ? `<div class="conv-match ${simClass}">${simIcon} ${simPct}% match</div>` : ''}
      </div>
    </div>
  `;
}

function getSimClass(similarity) {
  if (similarity == null) return '';
  if (similarity >= 0.85) return SIM_CLASS[0.85];
  if (similarity >= 0.7) return SIM_CLASS[0.7];
  if (similarity >= 0.55) return SIM_CLASS[0.55];
  return '';
}

function renderBridgeSuggestion(suggestion) {
  return `
    <div class="bridge-suggestion" id="bridge-suggestion">
      <span class="bridge-icon">🌉</span>
      <span class="bridge-phrase">You might explore: <strong>${escapeHtml(suggestion.phrase)}</strong></span>
      <button class="bridge-dismiss" id="bridge-dismiss" aria-label="Dismiss">&times;</button>
    </div>
  `;
}

async function loadBridgeSuggestion(peerId, similarity) {
  currentBridgeSuggestion = null;

  try {
    const suggestions = await getBridgeSuggestions(peerId, similarity);
    if (suggestions.length > 0) {
      currentBridgeSuggestion = suggestions[0];
    }
  } catch {
    currentBridgeSuggestion = null;
  }
}

function renderChatPanel(peerId, conversations) {
  return `
    <div class="chat-panel" data-testid="chat-panel" id="chat-panel">
      ${peerId ? renderChatView(peerId, conversations) : renderNoChatSelected()}
    </div>
  `;
}

function renderNoChatSelected() {
  return `
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
  `;
}

function renderChatView(peerId, conversations) {
  const conv = conversations.find((c) => c.peerId === peerId);
  const messages = chatService.getMessages(peerId);
  const name = conv?.name ?? 'Anonymous';
  const online = conv?.online ?? false;
  const simPct = conv?.similarity != null ? Math.round(conv.similarity * 100) : null;

  return `
    <div class="chat-view" data-peer-id="${escapeHtml(peerId)}" data-testid="chat-view">
      ${renderChatHeader(name, online, simPct)}
      ${renderChatMessages(messages, name, simPct)}
      ${renderTypingIndicator(name)}
      ${renderChatInput(name)}
    </div>
  `;
}

function renderChatHeader(name, online, simPct) {
  return `
    <div class="chat-header" data-testid="chat-header">
      ${currentBridgeSuggestion ? renderBridgeSuggestion(currentBridgeSuggestion) : ''}
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
        <button class="btn btn-icon" data-video-call title="Start video call" aria-label="Video call" data-testid="video-call-btn">📹</button>
        <button class="btn btn-ghost btn-sm" data-chat-more title="More options" aria-label="More options" data-testid="chat-more-btn">⋮</button>
        <button class="btn btn-ghost btn-sm mobile-back-btn" data-close-chat title="Back to conversations" data-testid="close-chat-mobile" aria-label="Close chat">← Back</button>
        <button class="btn btn-icon desktop-close-btn" data-close-chat data-testid="close-chat" title="Close conversation" aria-label="Close chat">×</button>
      </div>
    </div>
  `;
}

function renderChatMessages(messages, name, simPct) {
  if (messages.length === 0) {
    return `
      <div class="chat-messages" id="chat-messages" data-testid="chat-messages">
        <div class="chat-start-state" data-testid="empty-chat">
          <div class="chat-start-avatar">${(name[0] ?? 'A').toUpperCase()}</div>
          <div class="chat-start-name">${escapeHtml(name)}</div>
          ${
            simPct != null
              ? `
            <div class="chat-start-sim">
              <span>Your thoughts are</span>
              <strong class="sim-value">${simPct}% similar</strong>
            </div>
          `
              : ''
          }
          <div class="encryption-badge small">🔒 Messages are end-to-end encrypted</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="chat-messages" id="chat-messages" data-testid="chat-messages">
      ${renderMessageGroup(messages)}
    </div>
  `;
}

function renderMessageGroup(messages) {
  let html = '';
  let lastDate = null;

  messages.forEach((msg) => {
    const msgDate = new Date(msg.timestamp).toDateString();
    if (msgDate !== lastDate) {
      html += `<div class="chat-date-separator"><span>${formatDateLabel(msg.timestamp)}</span></div>`;
      lastDate = msgDate;
    }
    html += renderMessage(msg);
  });

  return html;
}

function formatDateLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function renderMessage(msg) {
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

function renderTypingIndicator(name) {
  return `
    <div class="typing-indicator hidden" id="typing-indicator" aria-live="polite">
      <span class="typing-dots"><span></span><span></span><span></span></span>
      <span class="typing-text">${escapeHtml(name)} is typing…</span>
    </div>
  `;
}

function renderChatInput(name) {
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

export function bind(container) {
  boundContainer = container;
  const list = container.querySelector('#conversation-list');

  chatService.setIncomingHandler(({ peerId, message }) => {
    if (peerId === activePeerId) {
      const msgs = container.querySelector('#chat-messages');
      if (msgs) {
        msgs.querySelector('.chat-start-state')?.remove();
        msgs.insertAdjacentHTML('beforeend', renderMessage(message));
        msgs.scrollTop = msgs.scrollHeight;
      }
    }
    update(container);
  });

  handleNewMessage = (e) => {
    const { peerId, peerName, content } = e.detail || {};
    if (peerId !== activePeerId) {
      toasts.info(`💬 ${peerName}: ${content.slice(0, 50)}${content.length > 50 ? '…' : ''}`);
    }
  };
  document.addEventListener('isc:new-chat-message', handleNewMessage);

  const checkTyping = () => {
    if (!activePeerId) return;
    const identity = networkService.getIdentity();
    const myId = identity?.pubkey ?? identity?.peerId;
    if (!myId) return;

    const key = `isc:typing:${activePeerId}:to:${myId}`;
    try {
      const lastTyping = parseInt(localStorage.getItem(key) || '0', 10);
      const now = Date.now();
      const indicator = container.querySelector('#typing-indicator');
      if (indicator && now - lastTyping < TYPING_TTL) {
        indicator.classList.remove('hidden');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => indicator.classList.add('hidden'), TYPING_TTL);
      }
    } catch {}
  };
  typingInterval = setInterval(checkTyping, 500);

  list?.addEventListener('click', (e) => {
    const item = e.target.closest('.conversation-item');
    if (item) {
      activePeerId = item.dataset.peerId;
      openChat(container, activePeerId);
    }
  });

  list?.addEventListener('keydown', (e) => {
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
  });

  const onStartChat = (e) => {
    const { peerId } = e.detail || {};
    if (!peerId) return;
    activePeerId = peerId;
    update(container);
    openChat(container, peerId);
  };
  document.addEventListener('isc:start-chat', onStartChat);

  const onStorage = (e) => {
    if (!e.key?.startsWith('isc:chat:') || e.key.includes(':unread:') || e.key.includes(':typing:'))
      return;
    const peerId = e.key.replace('isc:chat:', '');
    update(container);
    if (activePeerId === peerId) refreshMessages(container, peerId);
    else
      container
        .querySelector(`.conversation-item[data-peer-id="${CSS.escape(peerId)}"]`)
        ?.classList.add('has-unread');

    if (
      !document.hasFocus() &&
      e.newValue &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const msgs = JSON.parse(e.newValue);
        const latest = msgs[msgs.length - 1];
        if (latest && !latest.fromMe) {
          const settings = JSON.parse(localStorage.getItem('isc:settings') || '{}');
          if (settings.notifications !== false) {
            const conv = chatService.getConversations().find((c) => c.peerId === peerId);
            new Notification(`ISC — ${conv?.name ?? 'New message'}`, {
              body: String(latest.content ?? '').slice(0, 100),
              icon: '/favicon.ico',
              tag: `isc-chat-${peerId}`,
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
  };
  window.addEventListener('storage', onStorage);

  const onStorageTyping = (e) => {
    if (!e.key?.startsWith('isc:typing:')) return;
    const rest = e.key.slice('isc:typing:'.length);
    const toIdx = rest.indexOf(':to:');
    const senderId = toIdx >= 0 ? rest.slice(0, toIdx) : rest;
    if (senderId !== activePeerId) return;
    showTypingIndicator(container);
  };
  window.addEventListener('storage', onStorageTyping);

  const onOnline = () => container.querySelector('[data-testid="offline-indicator"]')?.remove();
  window.addEventListener('online', onOnline);

  const onOffline = () => {
    if (!container.querySelector('[data-testid="offline-indicator"]')) {
      const banner = document.createElement('div');
      banner.className = 'info-banner offline';
      banner.setAttribute('data-testid', 'offline-indicator');
      banner.textContent = '📡 Offline — messages will be queued and delivered when reconnected';
      container.querySelector('.chats-layout')?.before(banner);
    }
  };
  window.addEventListener('offline', onOffline);

  if (activePeerId) openChat(container, activePeerId);

  container.addEventListener('click', (e) => {
    const moreBtn = e.target.closest('[data-chat-more]');
    if (moreBtn) {
      const chatView = container.querySelector('[data-testid="chat-view"]');
      const peerId = chatView?.dataset.peerId;
      if (!peerId) return;

      const html = `
        <div class="modal-header">
          <h2 class="modal-title">More Options</h2>
          <button class="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body chat-more-menu">
          <button class="chat-more-item" data-action="send-file" data-testid="send-file-action">
            <span class="chat-more-icon">📎</span>
            <span class="chat-more-label">Send File</span>
            <span class="chat-more-desc">Share a document or image</span>
          </button>
          <button class="chat-more-item" data-action="send-photo" data-testid="send-photo-action">
            <span class="chat-more-icon">🖼️</span>
            <span class="chat-more-label">Send Photo</span>
            <span class="chat-more-desc">Share an image from your device</span>
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
      overlay.querySelector('[data-action="send-file"]')?.addEventListener('click', () => {
        modals.close();
        document.dispatchEvent(new CustomEvent('isc:send-file', { detail: { peerId } }));
      });
      overlay.querySelector('[data-action="send-photo"]')?.addEventListener('click', () => {
        modals.close();
        document.dispatchEvent(
          new CustomEvent('isc:send-file', { detail: { peerId, accept: 'image/*' } })
        );
      });
    }
  });

  // New conversation button
  container.querySelector('#new-chat-btn')?.addEventListener('click', () => {
    const html = `
      <div class="modal-header">
        <h2 class="modal-title">Start Conversation</h2>
        <button class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="dial-peer-id-input">Peer ID</label>
          <input type="text" id="dial-peer-id-input" class="form-input font-mono"
                 placeholder="12D3KooW…" autocomplete="off"
                 data-testid="dial-peer-input" />
          <div class="form-hint">Paste a peer's ID to open a direct encrypted chat.</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="confirm" id="dial-confirm-btn">
          Open Chat
        </button>
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
      activePeerId = peerId;
      update(container);
      openChat(container, peerId);
    });
  });

  return [
    () => document.removeEventListener('isc:start-chat', onStartChat),
    () => window.removeEventListener('storage', onStorage),
    () => window.removeEventListener('storage', onStorageTyping),
    () => window.removeEventListener('online', onOnline),
    () => window.removeEventListener('offline', onOffline),
    () => {
      activePeerId = null;
      boundContainer = null;
      clearTimeout(typingTimeout);
    },
  ];
}

async function openChat(container, peerId) {
  activePeerId = peerId;

  container.querySelectorAll('.conversation-item').forEach((el) => {
    const active = el.dataset.peerId === peerId;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
  });

  // Toggle .chat-open for mobile layout
  container.querySelector('.chats-layout')?.classList.add('chat-open');

  await markPeerContacted(peerId).catch(() => {});
  chatService.markAsRead(peerId);
  const convItem = container.querySelector(
    `.conversation-item[data-peer-id="${CSS.escape(peerId)}"]`
  );
  convItem?.classList.remove('has-unread');
  convItem?.querySelector('.unread-badge')?.remove();

  const chatPanel = container.querySelector('#chat-panel');
  if (!chatPanel) return;

  const conversations = chatService.getConversations();
  const conv = conversations.find((c) => c.peerId === peerId);
  const similarity = conv?.similarity ?? 0;

  await loadBridgeSuggestion(peerId, similarity);

  chatPanel.innerHTML = renderChatView(peerId, conversations);

  bindChatInputHandlers(container);

  const dismissBtn = container.querySelector('#bridge-dismiss');
  dismissBtn?.addEventListener('click', () => {
    currentBridgeSuggestion = null;
    const banner = container.querySelector('.bridge-suggestion');
    banner?.remove();
  });

  const videoCallBtn = container.querySelector('[data-video-call]');
  videoCallBtn?.addEventListener('click', () => {
    const chatView = container.querySelector('[data-testid="chat-view"]');
    const peerId = chatView?.dataset.peerId;
    if (peerId) {
      import('../components/videoCallOverlay.js').then((m) => {
        const conv = conversations.find((c) => c.peerId === peerId);
        m.openVideoCall(peerId, conv?.name ?? 'Peer');
      });
    }
  });

  requestAnimationFrame(() => {
    const msgs = chatPanel.querySelector('#chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  });
}

function refreshMessages(container, peerId) {
  const msgs = container.querySelector('#chat-messages');
  if (!msgs) return;

  const messages = chatService.getMessages(peerId);
  msgs.innerHTML =
    messages.length === 0
      ? '<div class="chat-start-state" data-testid="empty-chat"><div class="encryption-badge small">🔒 Messages are end-to-end encrypted</div></div>'
      : renderMessageGroup(messages);

  msgs.scrollTop = msgs.scrollHeight;
}

function showTypingIndicator(container) {
  const indicator = container.querySelector('#typing-indicator');
  if (!indicator) return;

  indicator.classList.remove('hidden');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => indicator.classList.add('hidden'), TYPING_TTL);
}

function broadcastTyping() {
  const identity = networkService.getIdentity();
  const myId = identity?.pubkey ?? identity?.peerId;
  if (!myId || !activePeerId) return;

  try {
    localStorage.setItem(`isc:typing:${myId}:to:${activePeerId}`, String(Date.now()));
  } catch {
    /* ignore quota errors */
  }
}

function bindChatInputHandlers(container) {
  const chatInput = container.querySelector('#chat-input');
  const chatSend = container.querySelector('#chat-send');
  const closeBtns = container.querySelectorAll('[data-close-chat]');

  const doSend = async () => {
    if (!chatInput) return;
    const content = chatInput.value.trim();
    const chatView = container.querySelector('[data-testid="chat-view"]');
    const peerId = chatView?.dataset.peerId;
    if (!content || !peerId) return;

    chatInput.disabled = true;
    if (chatSend) chatSend.disabled = true;

    try {
      await chatService.sendMessage(peerId, content);
      chatInput.value = '';
      chatInput.style.height = '';

      const msgs = container.querySelector('#chat-messages');
      if (msgs) {
        msgs.querySelector('.chat-start-state')?.remove();
        const msg = chatService.getMessages(peerId).at(-1);
        if (msg) msgs.insertAdjacentHTML('beforeend', renderMessage(msg));
        msgs.scrollTop = msgs.scrollHeight;
      }

      const convItem = container.querySelector(
        `.conversation-item[data-peer-id="${CSS.escape(peerId)}"]`
      );
      const preview = convItem?.querySelector('.conv-preview');
      if (preview) preview.textContent = content.slice(0, 50);
    } catch (err) {
      toasts.error(`Send failed: ${err.message}`);
    } finally {
      chatInput.disabled = false;
      if (chatSend) chatSend.disabled = false;
      chatInput.focus();
    }
  };

  chatSend?.addEventListener('click', doSend);
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });
  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    broadcastTyping();
  });

  const doClose = () => {
    activePeerId = null;
    container.querySelector('.chats-layout')?.classList.remove('chat-open');
    container.querySelector('#chat-panel').innerHTML = renderNoChatSelected();
    container.querySelectorAll('.conversation-item').forEach((el) => {
      el.classList.remove('active');
      el.setAttribute('aria-selected', 'false');
    });
  };
  closeBtns.forEach((btn) => btn.addEventListener('click', doClose));
}

export function update(container) {
  const conversations = chatService.getConversations();
  const list = container.querySelector('#conversation-list');
  if (list) {
    list.innerHTML =
      conversations.length === 0
        ? renderEmptyConv()
        : conversations.map((c) => renderConvItem(c, activePeerId)).join('');
  }
}

export function destroy() {
  activePeerId = null;
  boundContainer = null;
  clearTimeout(typingTimeout);
  currentBridgeSuggestion = null;
  chatService.setIncomingHandler(null);
  document.removeEventListener('isc:new-chat-message', handleNewMessage);
  clearInterval(typingInterval);
}

export default createScreen({ render, bind, update, destroy });
