/* eslint-disable */
/**
 * Chat Service
 *
 * Direct messaging operations with local persistence.
 * Delivers messages via WebRTC when available, falls back to DHT announce.
 */

import { networkService } from './network.ts';
import { discoveryService } from './discoveryService.js';
import { logger } from '../utils/logger.ts';
import { getDHTClient, initializeDHT } from '../network/dht.ts';
import { getPeerID } from '../identity/index.ts';
import { encode } from '@isc/core';

const CHAT_PREFIX = 'isc:chat:';
const UNREAD_PREFIX = 'isc:chat:unread:';
const PENDING_KEY = 'isc:chat:pending';
const DM_INBOX_PREFIX = '/isc/dm/inbox/';
const DM_TTL = 3600; // 1 hour

let dmPollInterval = null;
let myPeerId = null;
let lastDMPollTimestamp = 0;

function getMessagesKey(peerId) {
  return `${CHAT_PREFIX}${peerId}`;
}

function getUnreadKey(peerId) {
  return `${UNREAD_PREFIX}${peerId}`;
}

function getDMInboxKey(peerId) {
  return `${DM_INBOX_PREFIX}${peerId}`;
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
    const matchPeerIds = new Set(matches.map(m => m.peerId));

    // Also include peers we've exchanged DMs with but aren't in discovery matches
    const allMessageKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CHAT_PREFIX)) {
        allMessageKeys.push(key);
      }
    }

    const dmPeerIds = new Set();
    for (const key of allMessageKeys) {
      const peerId = key.slice(CHAT_PREFIX.length);
      if (peerId && !matchPeerIds.has(peerId)) {
        dmPeerIds.add(peerId);
      }
    }

    // Build conversation list from both sources
    const allPeers = [
      ...matches.map(m => ({
        peerId: m.peerId,
        name: m.identity?.name || 'Anonymous',
        similarity: m.similarity,
        online: m.online ?? false,
      })),
      ...Array.from(dmPeerIds).map(peerId => ({
        peerId,
        name: `@${peerId.slice(0, 8)}`,
        similarity: null,
        online: false,
      })),
    ];

    const convs = allPeers.map(p => ({
      peerId: p.peerId,
      name: p.name,
      lastMessage: this._getLastMessage(p.peerId),
      unreadCount: this._getUnreadCount(p.peerId),
      similarity: p.similarity,
      online: p.online,
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

      const delivered = await this._sendViaWebRTC(peerId, message);
      if (!delivered) {
        await this._sendViaDHT(peerId, message);
      }

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
        return true;
      }
    } catch (err) {
      logger.debug('WebRTC send unavailable, falling back to DHT', { error: err.message });
    }
    return false;
  },

  async _sendViaDHT(peerId, message) {
    try {
      const dht = getDHTClient();
      if (typeof dht.isConnected === 'function' && !dht.isConnected()) {
        await initializeDHT();
      }

      const dmMessage = {
        id: message.id,
        senderId: myPeerId || (await getPeerID()),
        content: message.content,
        timestamp: message.timestamp,
      };

      // Fetch existing inbox, append new message, re-announce
      const inboxKey = getDMInboxKey(peerId);
      let inbox = [];
      try {
        const existing = await dht.query(inboxKey, 1);
        if (existing.length > 0) {
          inbox = JSON.parse(new TextDecoder().decode(existing[0]));
          if (!Array.isArray(inbox)) inbox = [];
        }
      } catch {
        // No existing inbox, start fresh
      }

      inbox.push(dmMessage);
      // Keep inbox bounded
      if (inbox.length > 100) inbox = inbox.slice(-100);

      await dht.announce(inboxKey, encode(inbox), DM_TTL);

      message.delivered = true;
      const messages = this.getMessages(peerId);
      const idx = messages.findIndex(m => m.id === message.id);
      if (idx >= 0) {
        messages[idx] = message;
        this._saveMessages(peerId, messages);
      }

      logger.info('Message delivered via DHT', { peerId, messageId: message.id });
    } catch (err) {
      logger.error('DHT send failed, queuing message', { error: err.message });
      message.pending = true;

      const messages = this.getMessages(peerId);
      const idx = messages.findIndex(m => m.id === message.id);
      if (idx >= 0) {
        messages[idx] = message;
        this._saveMessages(peerId, messages);
      }

      const pending = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      pending.push({ peerId, message });
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      throw err;
    }
  },

  deleteConversation(peerId) {
    localStorage.removeItem(getMessagesKey(peerId));
    localStorage.removeItem(getUnreadKey(peerId));
  },

  startDMPolling() {
    if (dmPollInterval) return;
    // Poll every 15 seconds for new messages
    dmPollInterval = setInterval(() => this.pollInbox(), 15_000);
    // Also do an immediate first poll
    this.pollInbox();
  },

  stopDMPolling() {
    if (dmPollInterval) {
      clearInterval(dmPollInterval);
      dmPollInterval = null;
    }
  },

  async pollInbox() {
    try {
      const dht = getDHTClient();
      if (typeof dht.isConnected === 'function' && !dht.isConnected()) return;

      myPeerId = myPeerId || (await getPeerID());
      const inboxKey = getDMInboxKey(myPeerId);
      const results = await dht.query(inboxKey, 1);

      if (results.length === 0) return;

      const inbox = JSON.parse(new TextDecoder().decode(results[0]));
      if (!Array.isArray(inbox)) return;

      // Process only messages newer than last poll
      const newMessages = inbox.filter(m => m.timestamp > lastDMPollTimestamp);

      for (const dm of newMessages) {
        if (!dm?.id || !dm?.senderId || !dm?.content) continue;

        // Skip if we already have this message
        const messages = this.getMessages(dm.senderId);
        if (messages.some(m => m.id === dm.id)) continue;

        this.receiveMessage(dm.senderId, {
          id: dm.id,
          content: dm.content,
          timestamp: dm.timestamp,
        });
      }

      if (newMessages.length > 0) {
        lastDMPollTimestamp = newMessages[newMessages.length - 1].timestamp;
      }
    } catch (err) {
      logger.debug('DM poll failed', { error: err.message });
    }
  },
};
