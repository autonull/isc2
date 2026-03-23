/**
 * PeerCard Component
 *
 * Displays peer information with similarity score and actions.
 */

import { el } from '../utils/dom.js';
import { escapeHtml } from '../utils/dom.js';
import { Avatar } from './Avatar.js';

/**
 * @typedef {Object} PeerData
 * @property {string} peerId
 * @property {Object} [identity]
 * @property {string} [identity.name]
 * @property {string} [identity.bio]
 * @property {number} [similarity]
 * @property {boolean} [online]
 * @property {string[]} [matchedTopics]
 */

/**
 * @typedef {Object} PeerCardProps
 * @property {PeerData} peer
 * @property {Function} [onClick]
 * @property {Function} [onStartChat]
 * @property {Function} [onBlock]
 * @property {Function} [onUnblock]
 * @property {boolean} [showActions=true]
 * @property {boolean} [isBlocked]
 * @property {string} [className]
 */

/**
 * @param {PeerCardProps} props
 * @returns {HTMLElement}
 */
export function PeerCard({
  peer,
  onClick,
  onStartChat,
  onBlock,
  onUnblock,
  showActions = true,
  isBlocked,
  className = '',
}) {
  const name = peer?.identity?.name ?? 'Anonymous';
  const bio = peer?.identity?.bio ?? 'No bio';
  const peerId = peer?.peerId ?? peer?.identity?.peerId ?? 'Unknown';
  const similarity = peer?.similarity != null ? Math.round(peer.similarity * 100) : null;
  const online = peer?.online ?? false;
  const matchedTopics = peer?.matchedTopics ?? [];
  const initials = name.charAt(0).toUpperCase();

  const container = el('div', {
    className: `peer-card ${className}`.trim(),
    onClick,
  });

  const avatar = Avatar({ name, online, size: 'md' });
  container.appendChild(avatar);

  const info = el('div', { className: 'peer-card__info' });

  const header = el('div', { className: 'peer-card__header' });
  header.appendChild(el('span', { className: 'peer-card__name' }, [escapeHtml(name)]));

  const status = el(
    'span',
    {
      className: `peer-card__status ${online ? 'online' : 'offline'}`,
    },
    [online ? '● Online' : '○ Offline']
  );
  header.appendChild(status);
  info.appendChild(header);

  if (similarity != null) {
    const similarityBadge = el('span', { className: 'peer-card__similarity' }, [
      `${similarity}% match`,
    ]);
    info.appendChild(similarityBadge);
  }

  if (bio) {
    const bioEl = el('p', { className: 'peer-card__bio' }, [escapeHtml(bio.slice(0, 100))]);
    info.appendChild(bioEl);
  }

  if (matchedTopics.length > 0) {
    const topics = el('div', { className: 'peer-card__topics' });
    matchedTopics.slice(0, 5).forEach((topic) => {
      const tag = el('span', { className: 'peer-card__topic' }, [escapeHtml(topic)]);
      topics.appendChild(tag);
    });
    info.appendChild(topics);
  }

  container.appendChild(info);

  if (showActions) {
    const actions = el('div', { className: 'peer-card__actions' });

    if (isBlocked) {
      const unblockBtn = el(
        'button',
        {
          className: 'btn btn-sm btn-ghost',
          'data-action': 'unblock',
          onClick: (e) => {
            e.stopPropagation();
            onUnblock?.(peer);
          },
        },
        ['Unblock']
      );
      actions.appendChild(unblockBtn);
    } else {
      const chatBtn = el(
        'button',
        {
          className: 'btn btn-sm btn-primary',
          'data-action': 'start-chat',
          onClick: (e) => {
            e.stopPropagation();
            onStartChat?.(peer);
          },
        },
        ['Chat']
      );
      actions.appendChild(chatBtn);

      const blockBtn = el(
        'button',
        {
          className: 'btn btn-sm btn-ghost',
          'data-action': 'block',
          onClick: (e) => {
            e.stopPropagation();
            onBlock?.(peer);
          },
        },
        ['Block']
      );
      actions.appendChild(blockBtn);
    }

    container.appendChild(actions);
  }

  return container;
}

/**
 * @param {HTMLElement} container
 * @param {PeerCardProps} props
 * @returns {Function} Cleanup
 */
export function mountPeerCard(container, props) {
  const card = PeerCard(props);
  container.appendChild(card);

  const cleanupFns = [];

  if (props.onStartChat) {
    const handler = (e) => {
      const btn = e.target.closest('[data-action="start-chat"]');
      if (btn) props.onStartChat(props.peer);
    };
    container.addEventListener('click', handler);
    cleanupFns.push(() => container.removeEventListener('click', handler));
  }

  return () => {
    cleanupFns.forEach((fn) => fn());
    card.remove();
  };
}
