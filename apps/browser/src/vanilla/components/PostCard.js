/**
 * PostCard Component
 *
 * Individual post display with actions (like, reply, delete).
 */

import { el } from '../utils/dom.js';
import { escapeHtml } from '../utils/dom.js';
import { Avatar } from './Avatar.js';

/**
 * @typedef {Object} PostData
 * @property {string} id
 * @property {string} content
 * @property {string} authorId
 * @property {Object} [author]
 * @property {string} [author.name]
 * @property {number} [timestamp]
 * @property {number} [likes]
 * @property {boolean} [liked]
 * @property {Object} [replyTo]
 * @property {string} [replyTo.content]
 * @property {Object} [replyTo.author]
 */

/**
 * @typedef {Object} PostCardProps
 * @property {PostData} post
 * @property {Function} [onLike]
 * @property {Function} [onReply]
 * @property {Function} [onDelete]
 * @property {Function} [onClick]
 * @property {string} [className]
 */

/**
 * @param {PostCardProps} props
 * @returns {HTMLElement}
 */
export function PostCard({ post, onLike, onReply, onDelete, onClick, className = '' }) {
  const { id, content, author, authorId, timestamp, likes = 0, liked, replyTo } = post;
  const name = author?.name ?? authorId?.slice(0, 8) ?? 'Anonymous';
  const timeAgo = formatTimeAgo(timestamp);

  const container = el('article', {
    className: `post-card ${className}`.trim(),
    'data-post-id': id,
    onClick,
  });

  const avatar = Avatar({ name, size: 'sm' });
  container.appendChild(avatar);

  const body = el('div', { className: 'post-card__body' });

  const header = el('header', { className: 'post-card__header' });
  header.appendChild(el('span', { className: 'post-card__author' }, [escapeHtml(name)]));
  header.appendChild(
    el('time', { className: 'post-card__time', datetime: new Date(timestamp).toISOString() }, [
      timeAgo,
    ])
  );
  body.appendChild(header);

  if (replyTo) {
    const replySnippet = el('blockquote', { className: 'post-card__reply' }, [
      escapeHtml((replyTo.content || '').slice(0, 100)),
    ]);
    body.appendChild(replySnippet);
  }

  const contentEl = el('div', { className: 'post-card__content' }, [escapeHtml(content)]);
  body.appendChild(contentEl);

  const actions = el('div', { className: 'post-card__actions' });

  const likeBtn = el(
    'button',
    {
      className: `post-card__action ${liked ? 'post-card__action--active' : ''}`,
      'data-action': 'like',
      'aria-label': liked ? 'Unlike' : 'Like',
      onClick: (e) => {
        e.stopPropagation();
        onLike?.(id);
      },
    },
    [
      el('span', { className: 'post-card__action-icon' }, [liked ? '❤️' : '🤍']),
      el('span', { className: 'post-card__action-count' }, [String(likes)]),
    ]
  );
  actions.appendChild(likeBtn);

  const replyBtn = el(
    'button',
    {
      className: 'post-card__action',
      'data-action': 'reply',
      'aria-label': 'Reply',
      onClick: (e) => {
        e.stopPropagation();
        onReply?.(id);
      },
    },
    [
      el('span', { className: 'post-card__action-icon' }, ['💬']),
      el('span', { className: 'post-card__action-count' }, ['Reply']),
    ]
  );
  actions.appendChild(replyBtn);

  if (onDelete) {
    const deleteBtn = el(
      'button',
      {
        className: 'post-card__action post-card__action--danger',
        'data-action': 'delete',
        'aria-label': 'Delete',
        onClick: (e) => {
          e.stopPropagation();
          onDelete?.(id);
        },
      },
      [el('span', { className: 'post-card__action-icon' }, ['🗑️'])]
    );
    actions.appendChild(deleteBtn);
  }

  body.appendChild(actions);
  container.appendChild(body);

  return container;
}

/**
 * @param {HTMLElement} container
 * @param {PostCardProps} props
 * @returns {Function} Cleanup
 */
export function mountPostCard(container, props) {
  const card = PostCard(props);
  container.appendChild(card);

  const cleanupFns = [];
  const handlers = {
    like: (id) => props.onLike?.(id),
    reply: (id) => props.onReply?.(id),
    delete: (id) => props.onDelete?.(id),
  };

  const handleClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      handlers[action]?.(props.post.id);
    }
  };

  container.addEventListener('click', handleClick);
  cleanupFns.push(() => container.removeEventListener('click', handleClick));

  return () => {
    cleanupFns.forEach((fn) => fn());
    card.remove();
  };
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;

  return new Date(timestamp).toLocaleDateString();
}
