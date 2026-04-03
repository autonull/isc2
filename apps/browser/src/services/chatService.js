/**
 * Chat Service
 *
 * Direct messaging operations with local persistence.
 */

import { networkService } from './network.ts';
import { discoveryService } from './discoveryService.js';
import { logger } from '../logger.js';

const CHAT_PREFIX = 'isc:chat:';
const UNREAD_PREFIX = 'isc:chat:unread:';
const PENDING_KEY = 'isc:chat:pending';

function getMessagesKey(peerId) {
  return `${CHAT_PREFIX}${peerId}`;
}

function getUnreadKey(peerId) {
  return `${UNREAD_PREFIX}${peerId}`;
}

export const chatService = {
  onIncomingMessage: null,

  setIncomingHandler(handler) {
    this.onIncomingMessage = handler;
  },

  receiveMessage(peerId, messageData) {
    const message = {
      id: messageData.id || `msg-${Date.now()}`,
      peerId,
      content: messageData.content,
      timestamp: messageData.timestamp || Date.now(),
      fromMe: false,
      delivered: true,
    };

    const messages = this.getMessages(peerId);
    messages.push(message);
    this._saveMessages(peerId, messages);

    const unread = parseInt(localStorage.getItem(getUnreadKey(peerId)) || '0', 10) + 1;
    localStorage.setItem(getUnreadKey(peerId), String(unread));

    const conv = discoveryService.getMatches().find(m => m.peerId === peerId);
    const peerName = conv?.identity?.name || 'Someone';
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('isc:new-chat-message', {
        detail: { peerId, peerName, content: messageData.content },
      }));
    }

    if (this.onIncomingMessage) {
      this.onIncomingMessage({ peerId, message });
    }

    return message;
  },

  getConversations() {
    const matches = discoveryService.getMatches();

    const convs = matches.map(m => ({
      peerId: m.peerId,
      name: m.identity?.name || 'Anonymous',
      lastMessage: this._getLastMessage(m.peerId),
      unreadCount: this._getUnreadCount(m.peerId),
      similarity: m.similarity,
      online: m.online ?? false,
    }));

    return convs
      .filter(c => c.lastMessage)
      .sort((a, b) => (b.lastMessage?.timestamp ?? 0) - (a.lastMessage?.timestamp ?? 0));
  },

  getMessages(peerId) {
    try {
      const data = localStorage.getItem(getMessagesKey(peerId));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  markAsRead(peerId) {
    localStorage.setItem(getUnreadKey(peerId), '0');
  },

  async sendMessage(peerId, content) {
    try {
      const message = {
        id: `msg-${Date.now()}`,
        peerId,
        content,
        timestamp: Date.now(),
        fromMe: true,
        delivered: false,
      };

      const messages = this.getMessages(peerId);
      messages.push(message);
      this._saveMessages(peerId, messages);

      await this._sendViaWebRTC(peerId, message);

      return message;
    } catch (err) {
      logger.error('Message send failed', { error: err.message });
      throw err;
    }
  },

  _getLastMessage(peerId) {
    const messages = this.getMessages(peerId);
    return messages[messages.length - 1] || null;
  },

  _getUnreadCount(peerId) {
    return parseInt(localStorage.getItem(getUnreadKey(peerId)) || '0', 10);
  },

  _saveMessages(peerId, messages) {
    localStorage.setItem(getMessagesKey(peerId), JSON.stringify(messages));
  },

  async _sendViaWebRTC(peerId, message) {
    try {
      const net = networkService.getService?.();
      if (net?.sendData) {
        const payload = {
          type: 'chat-message',
          data: {
            id: message.id,
            content: message.content,
            timestamp: message.timestamp,
            fromMe: true,
          },
        };
        await net.sendData(peerId, payload);
        message.delivered = true;
        const messages = this.getMessages(peerId);
        const idx = messages.findIndex(m => m.id === message.id);
        if (idx >= 0) {
          messages[idx] = message;
          this._saveMessages(peerId, messages);
        }
        return;
      }
    } catch (err) {
      logger.warn('WebRTC send failed, queuing message', { error: err.message });
    }

    message.pending = true;
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    pending.push({ peerId, message });
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  },

  deleteConversation(peerId) {
    localStorage.removeItem(getMessagesKey(peerId));
    localStorage.removeItem(getUnreadKey(peerId));
  },
};
