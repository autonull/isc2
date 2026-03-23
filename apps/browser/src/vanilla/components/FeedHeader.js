/**
 * FeedHeader Component
 *
 * Feed title, connection status, and controls.
 */

import { el } from '../utils/dom.js';
import { escapeHtml } from '../utils/dom.js';

/**
 * @typedef {'list' | 'grid' | 'space'} ViewMode
 */

/**
 * @typedef {Object} FeedHeaderProps
 * @property {string} [title] - Feed title
 * @property {string} [subtitle] - Optional subtitle
 * @property {boolean} [connected] - Network connection status
 * @property {string} [status] - Status label
 * @property {ViewMode} [viewMode] - Current view mode
 * @property {Function} [onViewModeChange] - View mode change handler
 * @property {Function} [onRefresh] - Refresh handler
 * @property {Array<{icon:string,label:string,onClick:Function,className?:string}>} [actions] - Custom actions
 * @property {string} [className]
 */

/**
 * @param {FeedHeaderProps} props
 * @returns {HTMLElement}
 */
export function FeedHeader({
  title,
  subtitle,
  connected,
  status,
  viewMode,
  onViewModeChange,
  onRefresh,
  actions,
  className = '',
}) {
  const container = el('div', { className: `feed-header ${className}`.trim() });

  const titleSection = el('div', { className: 'feed-header__titles' });

  if (title) {
    const titleEl = el('h1', { className: 'feed-header__title' }, [escapeHtml(title)]);
    titleSection.appendChild(titleEl);
  }

  if (subtitle) {
    const subtitleEl = el('span', { className: 'feed-header__subtitle' }, [escapeHtml(subtitle)]);
    titleSection.appendChild(subtitleEl);
  }

  container.appendChild(titleSection);

  const controls = el('div', { className: 'feed-header__controls' });

  if (connected !== undefined || status) {
    const statusEl = el(
      'span',
      {
        className: `connection-status ${connected ? 'connected' : 'disconnected'}`,
      },
      [connected ? '●' : '○', ' ', escapeHtml(status || (connected ? 'connected' : 'disconnected'))]
    );
    controls.appendChild(statusEl);
  }

  if (onRefresh) {
    const refreshBtn = el(
      'button',
      {
        className: 'btn btn-icon',
        title: 'Refresh',
        'aria-label': 'Refresh feed',
        onClick: onRefresh,
      },
      ['🔄']
    );
    controls.appendChild(refreshBtn);
  }

  if (viewMode && onViewModeChange) {
    const viewModeControl = el('div', { className: 'view-mode-control' });
    viewModeControl.appendChild(el('label', { className: 'view-label' }, ['View:']));

    const select = el('select', { className: 'view-select', 'data-testid': 'view-mode-select' });
    ['list', 'grid', 'space'].forEach((mode) => {
      const icons = { list: '📋', grid: '▦', space: '🌌' };
      const option = el('option', { value: mode, selected: mode === viewMode }, [
        `${icons[mode]} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
      ]);
      select.appendChild(option);
    });

    select.addEventListener('change', () => onViewModeChange(select.value));
    viewModeControl.appendChild(select);
    controls.appendChild(viewModeControl);
  }

  if (actions?.length) {
    actions.forEach((action) => {
      const btn = el(
        'button',
        {
          className: `btn ${action.className || ''}`,
          title: action.label,
          onClick: action.onClick,
        },
        [
          action.icon
            ? el('span', { className: 'btn-icon' }, [action.icon])
            : escapeHtml(action.label),
        ]
      );
      controls.appendChild(btn);
    });
  }

  container.appendChild(controls);

  return container;
}

/**
 * Mount FeedHeader with event handling
 * @param {HTMLElement} container
 * @param {FeedHeaderProps} props
 * @returns {Function} Cleanup
 */
export function mountFeedHeader(container, props) {
  const header = FeedHeader(props);
  container.appendChild(header);

  const cleanupFns = [];

  if (props.onRefresh) {
    const refreshBtn = header.querySelector('[title="Refresh"]');
    if (refreshBtn) {
      const handler = () => props.onRefresh?.();
      refreshBtn.addEventListener('click', handler);
      cleanupFns.push(() => refreshBtn.removeEventListener('click', handler));
    }
  }

  if (props.viewMode && props.onViewModeChange) {
    const select = header.querySelector('select');
    if (select) {
      const handler = (e) => props.onViewModeChange(e.target.value);
      select.addEventListener('change', handler);
      cleanupFns.push(() => select.removeEventListener('change', handler));
    }
  }

  return () => {
    cleanupFns.forEach((fn) => fn());
    header.remove();
  };
}
