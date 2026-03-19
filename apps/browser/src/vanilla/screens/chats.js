/**
 * Chats Screen — P2P end-to-end encrypted direct messages
 * Conversations are opened via WebRTC DataChannels — no server stores your messages.
 * Real-time delivery between browser contexts uses the localStorage storage event.
 */

import { chatService } from '../../services/index.js';
import { networkService } from '../../services/network.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatTime, formatTimestamp } from '../../utils/time.js';
import { toasts } from '../../utils/toast.js';

// Module-level — persists for the app lifetime (JS modules are singletons)
let activePeerId  = null;
let boundContainer = null;  // reference for storage event handler
let typingTimeout  = null;
const TYPING_TTL   = 3000;  // ms another context's "typing" indicator is shown

export function render() {
  const conversations = chatService.getConversations();
  const isOffline     = !navigator.onLine;

  return `
    <div class="screen chats-screen" data-testid="chats-screen">
      <div class="screen-header" data-testid="chats-header">
        <h1 class="screen-title">💬 Chats <span class="screen-subtitle">E2E encrypted</span></h1>
        <a href="#/discover" class="btn btn-ghost btn-sm" aria-label="Find more peers">+ Find Peers</a>
      </div>

      ${isOffline ? `
        <div class="info-banner offline" data-testid="offline-indicator">
          📡 Offline — messages will be queued and delivered when reconnected
        </div>
      ` : ''}

      <div class="chats-layout" data-testid="chats-layout">
        <div class="conversation-list-panel" data-testid="conversation-list-panel">
          <div class="panel-header">
            <span class="panel-title">Conversations</span>
            <span class="panel-subtitle">${conversations.length > 0 ? `${conversations.length} peer${conversations.length !== 1 ? 's' : ''}` : ''}</span>
          </div>
          <div class="conversation-list" data-testid="conversation-list" id="conversation-list">
            ${conversations.length === 0
              ? renderEmptyConversations()
              : conversations.map(c => renderConvItem(c, activePeerId)).join('')}
          </div>
        </div>

        <div class="chat-panel" data-testid="chat-panel" id="chat-panel">
          ${activePeerId ? renderChatView(activePeerId, conversations) : renderNoChatSelected()}
        </div>
      </div>
    </div>
  `;
}

function renderEmptyConversations() {
  return `
    <div class="empty-state" style="padding:24px 16px" data-testid="empty-conversations">
      <div class="empty-state-icon" style="font-size:32px">🔭</div>
      <div class="empty-state-title" style="font-size:14px">No conversations yet</div>
      <div class="empty-state-description" style="font-size:12px">
        Discover peers with similar interests and connect with them.
      </div>
      <a href="#/discover" class="btn btn-primary btn-sm" data-testid="go-discover-btn">📡 Discover Peers</a>
    </div>
  `;
}

function renderConvItem(conv, active) {
  const isActive = conv.peerId === active;
  const preview  = conv.lastMessage?.content?.slice(0, 50) ?? 'No messages yet…';
  const time     = conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : '';
  const initial  = (conv.name?.[0] ?? 'C').toUpperCase();
  const simPct   = conv.similarity != null ? Math.round(conv.similarity * 100) : null;
  const simClass = conv.similarity >= 0.85 ? 'very-high' : conv.similarity >= 0.70 ? 'high' : 'medium';
  const unread   = conv.unreadCount > 0;

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
        ${simPct != null ? `<div class="conv-match ${simClass}">${simPct >= 85 ? '🔥' : simPct >= 70 ? '✨' : '~'} ${simPct}% match</div>` : ''}
      </div>
    </div>
  `;
}

function renderNoChatSelected() {
  return `
    <div class="no-chat-selected" data-testid="no-chat-selected">
      <div class="empty-state">
        <div class="empty-state-icon">🔐</div>
        <div class="empty-state-title">Select a conversation</div>
        <div class="empty-state-description">Choose from the list to open a secure channel.</div>
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

function renderChatView(peerId, conversations) {
  const conv     = conversations.find(c => c.peerId === peerId);
  const messages = chatService.getMessages(peerId);
  const name     = conv?.name ?? 'Anonymous';
  const online   = conv?.online ?? false;
  const simPct   = conv?.similarity != null ? Math.round(conv.similarity * 100) : null;

  return `
    <div class="chat-view" data-peer-id="${escapeHtml(peerId)}" data-testid="chat-view">
      <div class="chat-header" data-testid="chat-header">
        <div class="chat-peer-info">
          <div class="chat-avatar">${(name[0] ?? 'A').toUpperCase()}</div>
          <div>
            <span class="chat-peer-name" data-testid="chat-peer-name">${escapeHtml(name)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="chat-peer-status ${online ? 'online' : 'offline'}" data-testid="chat-peer-status">
                ${online ? '● Online' : '○ Offline'}
              </span>
              ${simPct != null ? `<span class="chat-sim-badge">${simPct}% match</span>` : ''}
            </div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm mobile-back-btn" data-close-chat title="Back to conversations" data-testid="close-chat-mobile" aria-label="Close chat">← Back</button>
        <button class="btn btn-icon desktop-close-btn" data-close-chat data-testid="close-chat" title="Close conversation" aria-label="Close chat">×</button>
      </div>

      <div class="chat-messages" id="chat-messages" data-testid="chat-messages">
        ${messages.length === 0 ? `
          <div class="chat-start-state" data-testid="empty-chat">
            <div class="chat-start-avatar">${(name[0] ?? 'A').toUpperCase()}</div>
            <div class="chat-start-name">${escapeHtml(name)}</div>
            ${simPct != null ? `
              <div class="chat-start-sim">
                <span>Your thoughts are</span>
                <strong class="sim-value">${simPct}% similar</strong>
              </div>
            ` : ''}
            <div class="encryption-badge small">
              🔒 Messages are end-to-end encrypted
            </div>
          </div>
        ` : renderMessageGroup(messages)}
      </div>

      <div class="typing-indicator hidden" id="typing-indicator" aria-live="polite">
        <span class="typing-dots"><span></span><span></span><span></span></span>
        <span class="typing-text">${escapeHtml(name)} is typing…</span>
      </div>

      <div class="chat-input-area" data-testid="chat-input-area">
        <textarea class="chat-input" id="chat-input"
               placeholder="Message ${escapeHtml(name)}…"
               autocomplete="off" maxlength="2000" rows="1"
               data-testid="chat-input" aria-label="Message input"></textarea>
        <button class="btn btn-primary btn-sm" id="chat-send" data-testid="send-message-button" aria-label="Send message">Send</button>
      </div>
      <div class="chat-input-hint">Enter to send · Shift+Enter for newline</div>
    </div>
  `;
}

function renderMessageGroup(messages) {
  let html = '';
  let lastDate = null;

  messages.forEach(msg => {
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

export function bind(container) {
  boundContainer = container;
  const list = container.querySelector('#conversation-list');

  // Conversation click
  list?.addEventListener('click', e => {
    const item = e.target.closest('.conversation-item');
    if (!item) return;
    activePeerId = item.dataset.peerId;
    openChat(container, activePeerId);
  });

  // Keyboard navigation in conversation list
  list?.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.target.closest('.conversation-item')?.click();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const items = [...list.querySelectorAll('.conversation-item')];
      const idx = items.findIndex(el => el === document.activeElement);
      items[Math.min(idx + 1, items.length - 1)]?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...list.querySelectorAll('.conversation-item')];
      const idx = items.findIndex(el => el === document.activeElement);
      items[Math.max(idx - 1, 0)]?.focus();
    }
  });

  // start-chat event from Discover screen
  const onStartChat = e => {
    const { peerId } = e.detail || {};
    if (!peerId) return;
    activePeerId = peerId;
    update(container);
    openChat(container, peerId);
  };
  document.addEventListener('isc:start-chat', onStartChat);

  // Real-time cross-tab message reception via localStorage storage events
  const onStorage = e => {
    if (!e.key?.startsWith('isc:chat:') || e.key.includes(':unread:') || e.key.includes(':typing:')) return;
    const peerId = e.key.replace('isc:chat:', '');

    // Update conversation list
    update(container);

    // If this chat is currently open, append new messages
    if (activePeerId === peerId) {
      refreshMessages(container, peerId);
    } else {
      // Flash the conversation item to draw attention
      const convItem = container.querySelector(`.conversation-item[data-peer-id="${CSS.escape(peerId)}"]`);
      convItem?.classList.add('has-unread');
    }

    // Browser notification for new incoming messages when app is not focused
    if (!document.hasFocus() && e.newValue) {
      try {
        const msgs = JSON.parse(e.newValue);
        const latest = msgs[msgs.length - 1];
        if (latest && !latest.fromMe && 'Notification' in window && Notification.permission === 'granted') {
          const settings = JSON.parse(localStorage.getItem('isc:settings') || '{}');
          if (settings.notifications !== false) {
            const conv = chatService.getConversations().find(c => c.peerId === peerId);
            new Notification(`ISC — ${conv?.name ?? 'New message'}`, {
              body: String(latest.content ?? '').slice(0, 100),
              icon: '/favicon.ico',
              tag: `isc-chat-${peerId}`,
            });
          }
        }
      } catch { /* ignore parse errors */ }
    }
  };
  window.addEventListener('storage', onStorage);

  // Typing indicator via storage events from peer
  // Key format written by broadcastTyping(): isc:typing:SENDER_ID:to:RECEIVER_ID
  const onStorageTyping = e => {
    if (!e.key?.startsWith('isc:typing:')) return;
    const rest = e.key.slice('isc:typing:'.length);       // "SENDER_ID:to:RECEIVER_ID"
    const toIdx = rest.indexOf(':to:');
    const senderId = toIdx >= 0 ? rest.slice(0, toIdx) : rest;
    if (senderId !== activePeerId) return;
    showTypingIndicator(container);
  };
  window.addEventListener('storage', onStorageTyping);

  // Online/offline banner
  window.addEventListener('online',  () => container.querySelector('[data-testid="offline-indicator"]')?.remove());
  window.addEventListener('offline', () => {
    if (!container.querySelector('[data-testid="offline-indicator"]')) {
      const banner = document.createElement('div');
      banner.className = 'info-banner offline';
      banner.setAttribute('data-testid', 'offline-indicator');
      banner.innerHTML = '📡 Offline — messages will be queued and delivered when reconnected';
      container.querySelector('.chats-layout')?.before(banner);
    }
  });

  bindChatInputHandlers(container);

  // If a peer was already selected (e.g. after route re-render), restore it
  if (activePeerId) openChat(container, activePeerId);
}

function openChat(container, peerId) {
  activePeerId = peerId;

  // Highlight in conversation list
  container.querySelectorAll('.conversation-item').forEach(el => {
    const active = el.dataset.peerId === peerId;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
  });

  // Mark as read
  chatService.markAsRead(peerId);
  const convItem = container.querySelector(`.conversation-item[data-peer-id="${CSS.escape(peerId)}"]`);
  convItem?.classList.remove('has-unread');
  const badge = convItem?.querySelector('.unread-badge');
  if (badge) badge.remove();

  // Render chat panel
  const chatPanel = container.querySelector('#chat-panel');
  if (!chatPanel) return;
  chatPanel.innerHTML = renderChatView(peerId, chatService.getConversations());
  bindChatInputHandlers(container);

  // Scroll to bottom
  requestAnimationFrame(() => {
    const msgs = chatPanel.querySelector('#chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  });
}

function refreshMessages(container, peerId) {
  const msgs = container.querySelector('#chat-messages');
  if (!msgs) return;
  const messages = chatService.getMessages(peerId);
  msgs.innerHTML = messages.length === 0
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
  const key = `isc:typing:${myId}:to:${activePeerId}`;
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // localStorage quota exceeded — ignore
  }
}

function bindChatInputHandlers(container) {
  const chatInput = container.querySelector('#chat-input');
  const chatSend  = container.querySelector('#chat-send');
  const closeBtns = container.querySelectorAll('[data-close-chat]');

  const doSend = async () => {
    if (!chatInput) return;
    const content  = chatInput.value.trim();
    const chatView = container.querySelector('[data-testid="chat-view"]');
    const peerId   = chatView?.dataset.peerId;
    if (!content || !peerId) return;

    chatInput.disabled = true;
    if (chatSend) chatSend.disabled = true;

    try {
      await chatService.sendMessage(peerId, content);
      chatInput.value = '';
      chatInput.style.height = '';

      // Append optimistically
      const msgs = container.querySelector('#chat-messages');
      if (msgs) {
        msgs.querySelector('.chat-start-state')?.remove();
        const msg = chatService.getMessages(peerId).at(-1);
        if (msg) msgs.insertAdjacentHTML('beforeend', renderMessage(msg));
        msgs.scrollTop = msgs.scrollHeight;
      }

      // Update preview in list
      const convItem = container.querySelector(`.conversation-item[data-peer-id="${CSS.escape(peerId)}"]`);
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

  chatInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });

  chatInput?.addEventListener('input', () => {
    // Auto-grow
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    // Signal typing to other contexts
    broadcastTyping();
  });

  const doClose = () => {
    activePeerId = null;
    container.querySelector('#chat-panel').innerHTML = renderNoChatSelected();
    container.querySelectorAll('.conversation-item').forEach(el => {
      el.classList.remove('active');
      el.setAttribute('aria-selected', 'false');
    });
  };
  closeBtns.forEach(btn => btn.addEventListener('click', doClose));
}

export function update(container) {
  const conversations = chatService.getConversations();
  const list = container.querySelector('#conversation-list');
  if (list) {
    list.innerHTML = conversations.length === 0
      ? renderEmptyConversations()
      : conversations.map(c => renderConvItem(c, activePeerId)).join('');
  }
}
