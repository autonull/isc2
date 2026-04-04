/* eslint-disable */
/**
 * ViewMode Component
 *
 * Toggle between list, grid, and space view modes.
 */

import { el } from '../utils/dom.js';

/**
 * @typedef {'list' | 'grid' | 'space'} ViewMode
 */

/**
 * @typedef {Object} ViewModeProps
 * @property {ViewMode} value - Current view mode
 * @property {Function} onChange - Change handler: (mode) => void
 * @property {string} [className]
 */

/**
 * @param {ViewModeProps} props
 * @returns {HTMLElement}
 */
export function ViewMode({ value = 'list', onChange, className = '' }) {
  const modes = [
    { id: 'list', icon: '📋', label: 'List' },
    { id: 'grid', icon: '▦', label: 'Grid' },
    { id: 'space', icon: '🌌', label: 'Space' },
  ];

  const container = el('div', {
    className: `view-mode ${className}`.trim(),
    role: 'tablist',
    'aria-label': 'View mode',
  });

  modes.forEach((mode) => {
    const btn = el(
      'button',
      {
        className: `view-mode__btn ${mode.id === value ? 'view-mode__btn--active' : ''}`,
        'data-mode': mode.id,
        role: 'tab',
        'aria-selected': mode.id === value,
        'aria-label': `${mode.label} view`,
        title: mode.label,
        onClick: () => onChange?.(mode.id),
      },
      [mode.icon]
    );

    container.appendChild(btn);
  });

  return container;
}

/**
 * Mount ViewMode with event handling
 * @param {HTMLElement} container
 * @param {ViewModeProps} props
 * @returns {Function} Cleanup
 */
export function mountViewMode(container, props) {
  const viewMode = ViewMode(props);
  container.appendChild(viewMode);

  const handleClick = (e) => {
    const btn = e.target.closest('[data-mode]');
    if (btn) {
      const mode = btn.dataset.mode;
      props.onChange?.(mode);
    }
  };

  container.addEventListener('click', handleClick);

  return () => {
    container.removeEventListener('click', handleClick);
    viewMode.remove();
  };
}
