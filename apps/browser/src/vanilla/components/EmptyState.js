/* eslint-disable */
/**
 * EmptyState Component
 *
 * Unified empty state display with channel-aware messages.
 */

import { el } from '../utils/dom.js';
import { escapeHtml } from '../utils/dom.js';

/**
 * @typedef {'no-channels' | 'no-posts' | 'no-neighbors' | 'no-matches' | 'offline' | 'error' | 'generic'} EmptyStateType
 */

/**
 * @typedef {Object} EmptyStateOptions
 * @property {EmptyStateType} type - Type of empty state
 * @property {Object} [channel] - Channel context
 * @property {string} [channel.name]
 * @property {boolean} [connected] - Network connection status
 * @property {string} [message] - Custom message override
 * @property {Array<{label:string,href?:string,action?:string,variant?:string}>} [actions]
 * @property {string} [icon] - Custom icon override
 */

/**
 * Get default message for empty state type
 * @param {EmptyStateType} type
 * @param {Object} channel
 * @param {boolean} connected
 * @returns {{icon: string, title: string, description: string}}
 */
function getDefaultContent(type, channel, connected) {
  const channelName = channel?.name;

  const defaults = {
    'no-channels': {
      icon: '💭',
      title: 'What are you thinking about?',
      description:
        "Create a channel — describe what's on your mind. ISC will find people on the same wavelength.",
    },
    'no-posts': {
      icon: '📭',
      title: 'No posts yet',
      description: connected
        ? 'Post something to your channel — peers in your semantic neighborhood will see it.'
        : 'Connect to the network to start exchanging messages with semantic neighbors.',
    },
    'no-neighbors': {
      icon: '🌐',
      title: channelName
        ? `No peers in #${channelName} neighborhood yet`
        : 'No semantic neighbors found yet',
      description: 'Peers with similar interests will appear here as they discover your channel.',
    },
    'no-matches': {
      icon: '🔍',
      title: 'No matches found',
      description: 'Try creating a channel about different topics to find more people.',
    },
    offline: {
      icon: '📡',
      title: 'You are offline',
      description: 'Some features are limited. Connect to the network to find semantic neighbors.',
    },
    error: {
      icon: '⚠️',
      title: 'Something went wrong',
      description: 'An error occurred. Please try again.',
    },
    generic: {
      icon: '📭',
      title: 'Nothing here yet',
      description: 'There is nothing to display.',
    },
  };

  return defaults[type] ?? defaults.generic;
}

/**
 * @param {EmptyStateOptions} options
 * @returns {HTMLElement}
 */
export function EmptyState(options) {
  const { type, channel, connected, message, actions, icon } = options;

  const content = getDefaultContent(type, channel, connected);

  const container = el('div', {
    className: 'empty-state',
    'data-testid': `empty-state-${type}`,
    'data-type': type,
  });

  // Icon
  container.appendChild(el('div', { className: 'empty-state-icon' }, [icon ?? content.icon]));

  // Title
  container.appendChild(
    el('div', { className: 'empty-state-title' }, [escapeHtml(message ?? content.title)])
  );

  // Description (if not custom message)
  if (!message) {
    const descEl = el('div', { className: 'empty-state-description' }, [
      escapeHtml(content.description),
    ]);
    container.appendChild(descEl);
  }

  // Offline banner
  if (type === 'offline' || (type === 'no-posts' && !connected)) {
    const banner = el('div', {
      className: 'info-banner warning mt-4',
    });
    const connLabel = connected ? 'connected' : 'disconnected';
    banner.textContent = `○ Network is ${connLabel} — you can still create channels offline`;
    container.appendChild(banner);
  }

  // Actions
  if (actions?.length) {
    const actionsEl = el('div', {
      className: 'form-actions',
      style: 'justify-content:center;margin-top:16px',
    });

    actions.forEach(({ label, href, action, variant = 'primary' }) => {
      if (href) {
        const link = el(
          'a',
          {
            href,
            className: `btn btn-${variant}`,
          },
          [escapeHtml(label)]
        );
        actionsEl.appendChild(link);
      } else {
        const btn = el(
          'button',
          {
            className: `btn btn-${variant}`,
            'data-action': action,
          },
          [escapeHtml(label)]
        );
        actionsEl.appendChild(btn);
      }
    });

    container.appendChild(actionsEl);
  }

  return container;
}

/**
 * Render empty state as HTML string
 * @param {EmptyStateOptions} options
 * @returns {string}
 */
export function renderEmptyState(options) {
  const { type, channel, connected, message, actions, icon } = options;

  const content = getDefaultContent(type, channel, connected);
  const displayIcon = icon ?? content.icon;
  const displayTitle = message ?? content.title;
  const displayDesc = message
    ? ''
    : `<div class="empty-state-description">${escapeHtml(content.description)}</div>`;

  let offlineBanner = '';
  if (type === 'offline' || (type === 'no-posts' && !connected)) {
    const connLabel = connected ? 'connected' : 'disconnected';
    offlineBanner = `<div class="info-banner warning mt-4">○ Network is ${escapeHtml(connLabel)} — you can still create channels offline</div>`;
  }

  let actionsHtml = '';
  if (actions?.length) {
    actionsHtml = `
      <div class="form-actions" style="justify-content:center;margin-top:16px">
        ${actions
          .map(({ label, href, action, variant = 'primary' }) =>
            href
              ? `<a href="${escapeHtml(href)}" class="btn btn-${variant}">${escapeHtml(label)}</a>`
              : `<button class="btn btn-${variant}" data-action="${escapeHtml(action ?? '')}">${escapeHtml(label)}</button>`
          )
          .join('')}
      </div>
    `;
  }

  return `
    <div class="empty-state" data-testid="empty-state-${type}" data-type="${type}">
      <div class="empty-state-icon">${displayIcon}</div>
      <div class="empty-state-title">${escapeHtml(displayTitle)}</div>
      ${displayDesc}
      ${offlineBanner}
      ${actionsHtml}
    </div>
  `;
}

/**
 * Create channel-aware empty state
 * @param {Object} channel
 * @param {boolean} connected
 * @returns {HTMLElement}
 */
export function createNoPostsState(channel, connected) {
  return EmptyState({
    type: 'no-posts',
    channel,
    connected,
    actions: [],
  });
}

/**
 * Create no neighbors empty state
 * @param {Object} channel
 * @returns {HTMLElement}
 */
export function createNoNeighborsState(channel) {
  return EmptyState({
    type: 'no-neighbors',
    channel,
    connected: false,
  });
}

/**
 * Create no channels empty state
 * @returns {HTMLElement}
 */
export function createNoChannelsState() {
  return EmptyState({
    type: 'no-channels',
    actions: [
      {
        label: 'Create Your First Channel',
        href: '#',
        action: 'new-channel',
        variant: 'primary',
      },
    ],
  });
}

/**
 * Create offline empty state
 * @returns {HTMLElement}
 */
export function createOfflineState() {
  return EmptyState({
    type: 'offline',
    connected: false,
  });
}

export default EmptyState;
