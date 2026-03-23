/**
 * Event Bus Module
 *
 * Centralized event system for application-wide communication.
 * Provides both in-memory and DOM event dispatch for compatibility.
 */

const listeners = new Map();

/**
 * @typedef {Object} EventBus
 * @property {Function} on - Subscribe to event
 * @property {Function} off - Unsubscribe from event
 * @property {Function} emit - Emit event (both memory + DOM)
 * @property {Function} once - Subscribe to event once
 */

/**
 * Subscribe to an event
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} Unsubscribe function
 */
export function on(event, handler) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(handler);

  return () => off(event, handler);
}

/**
 * Unsubscribe from an event
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 */
export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

/**
 * Emit an event (both in-memory and DOM)
 * @param {string} event - Event name
 * @param {*} detail - Event detail/payload
 */
export function emit(event, detail) {
  listeners.get(event)?.forEach((fn) => {
    try {
      fn(detail);
    } catch (err) {
      console.error(`[Events] Handler error for "${event}":`, err);
    }
  });

  document.dispatchEvent(new CustomEvent(`isc:${event}`, { detail, bubbles: true }));
}

/**
 * Subscribe to an event once
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {Function} Unsubscribe function
 */
export function once(event, handler) {
  const wrapper = (detail) => {
    off(event, wrapper);
    handler(detail);
  };
  return on(event, wrapper);
}

/**
 * Clear all listeners for an event
 * @param {string} event - Event name
 */
export function clear(event) {
  if (event) {
    listeners.delete(event);
  } else {
    listeners.clear();
  }
}

/**
 * Get listener count for an event
 * @param {string} event - Event name
 * @returns {number}
 */
export function listenerCount(event) {
  return listeners.get(event)?.size ?? 0;
}

/**
 * Event names constants for type safety
 * @readonly
 * @enum {string}
 */
export const EVENTS = {
  // Navigation
  NAVIGATE: 'navigate',

  // Channels
  NEW_CHANNEL: 'new-channel',
  CHANNEL_CREATED: 'channel-created',
  CHANNEL_UPDATED: 'channel-updated',
  CHANNEL_DELETED: 'channel-deleted',
  NEED_CHANNEL: 'need-channel',

  // Feed
  REFRESH_FEED: 'refresh-feed',
  FEED_UPDATED: 'feed-updated',

  // Posts
  NEW_POST: 'new-post',
  LIKE_POST: 'like-post',
  DELETE_POST: 'delete-post',
  REPLY_POST: 'reply-post',

  // Chats
  START_CHAT: 'start-chat',
  NEW_MESSAGE: 'new-message',
  MESSAGE_READ: 'message-read',

  // Network
  PEERS_FOUND: 'peers-found',
  CONNECTION_STATUS: 'connection-status',

  // UI
  TOAST: 'toast',
  MODAL_OPEN: 'modal-open',
  MODAL_CLOSE: 'modal-close',

  // Settings
  SETTINGS_CHANGED: 'settings-changed',
  THEME_CHANGED: 'theme-changed',

  // Debug
  TOGGLE_DEBUG: 'toggle-debug',
  TOGGLE_CHAOS: 'toggle-chaos',

  // PWA
  PWA_INSTALL: 'pwa-install',
};

/**
 * Convenience: Create typed event emitter
 * @param {string} namespace - Event namespace prefix
 * @returns {EventBus}
 */
export function createEventBus(namespace) {
  const prefix = namespace ? `${namespace}:` : '';

  return {
    on: (event, handler) => on(prefix + event, handler),
    off: (event, handler) => off(prefix + event, handler),
    emit: (event, detail) => emit(prefix + event, detail),
    once: (event, handler) => once(prefix + event, handler),
    clear: (event) => clear(event ? prefix + event : undefined),
    listenerCount: (event) => listenerCount(prefix + event),
  };
}

/**
 * Default event bus instance
 */
export const events = {
  on,
  off,
  emit,
  once,
  clear,
  listenerCount,
  EVENTS,
  createEventBus,
};

// Default export for convenience
export default events;
