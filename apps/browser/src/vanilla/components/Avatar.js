/**
 * Avatar Component
 *
 * User avatar with initials, online status, and size variants.
 */

import { el } from '../utils/dom.js';

/**
 * @typedef {'sm' | 'md' | 'lg' | 'xl'} AvatarSize
 */

/**
 * @typedef {Object} AvatarProps
 * @property {string} name - User name for initials
 * @property {string} [src] - Avatar image URL
 * @property {boolean} [online] - Online status indicator
 * @property {AvatarSize} [size='md']
 * @property {string} [className]
 * @property {Object} [dataset]
 */

/**
 * Render avatar element
 * @param {AvatarProps} props
 * @returns {HTMLElement}
 */
export function Avatar({ name, src, online, size = 'md', className = '', dataset }) {
  const initials = getInitials(name);
  const classes = ['avatar', `avatar--${size}`, className].filter(Boolean).join(' ');

  const container = el('div', { className: classes, dataset });

  if (src) {
    const img = el('img', { src, alt: name, className: 'avatar__image' });
    container.appendChild(img);
  } else {
    const text = el('span', { className: 'avatar__initials' }, [initials]);
    container.appendChild(text);
  }

  if (typeof online === 'boolean') {
    const status = el('span', {
      className: `avatar__status ${online ? 'avatar__status--online' : 'avatar__status--offline'}`,
    });
    container.appendChild(status);
  }

  return container;
}

/**
 * Create avatar with lifecycle
 * @param {HTMLElement} container
 * @param {AvatarProps} props
 * @returns {Function} Cleanup
 */
export function mountAvatar(container, props) {
  const avatar = Avatar(props);
  container.appendChild(avatar);
  return () => avatar.remove();
}

/**
 * Update avatar
 * @param {HTMLElement} container
 * @param {AvatarProps} props
 */
export function updateAvatar(container, props) {
  container.innerHTML = '';
  container.appendChild(Avatar(props));
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts.at(-1).charAt(0)).toUpperCase();
}
