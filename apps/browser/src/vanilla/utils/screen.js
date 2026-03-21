/**
 * Screen Utilities
 *
 * Base utilities for consistent screen patterns.
 */

import { escapeHtml, delegate, render as renderHtml } from './dom.js';
import { Spinner, EmptyState } from './component.js';

/**
 * Screen lifecycle management
 * @typedef {Object} ScreenLifecycle
 * @property {Function} render
 * @property {Function} bind
 * @property {Function} update
 * @property {Function} destroy
 */

/**
 * Create screen with lifecycle
 * @param {Object} options
 * @param {Function} options.render
 * @param {Function} [options.bind]
 * @param {Function} [options.update]
 * @param {Function} [options.destroy]
 * @returns {ScreenLifecycle}
 */
export function createScreen({ render: renderFn, bind, update, destroy }) {
  let unbindFns = [];

  return {
    render: renderFn,
    bind(container) {
      unbindFns = bind?.(container) ?? [];
    },
    update(container, ...args) {
      if (!update) return;
      const oldContent = container?.innerHTML;
      const newContent = renderFn();
      if (oldContent !== newContent) {
        renderHtml(container, newContent);
        unbindFns.forEach(fn => fn?.());
        unbindFns = bind?.(container) ?? [];
      } else {
        update(container, ...args);
      }
    },
    destroy() {
      unbindFns.forEach(fn => fn?.());
      destroy?.();
      unbindFns = [];
    },
  };
}

/**
 * Render header with title and actions
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.subtitle]
 * @param {Array<{icon?:string,label:string,onClick?:Function,className?:string}>} [options.actions]
 * @returns {string}
 */
export function renderHeader({ title, subtitle, actions }) {
  return `
    <div class="screen-header">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <h1 class="screen-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<span class="screen-subtitle">${escapeHtml(subtitle)}</span>` : ''}
      </div>
      ${actions?.length ? `
        <div class="header-actions">
          ${actions.map(({ icon, label, className = '' }) => `
            <button class="btn ${className}" ${icon ? `title="${escapeHtml(label)}"` : ''}>
              ${icon ? `<span class="btn-icon">${icon}</span>` : ''}
              ${!icon ? escapeHtml(label) : ''}
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render loading state
 * @param {string} [message='Loading...']
 * @returns {string}
 */
export function renderLoading(message = 'Loading...') {
  return `
    <div class="empty-state">
      <div class="spinner spinner-lg"></div>
      <p class="text-muted mt-3">${escapeHtml(message)}</p>
    </div>
  `;
}

/**
 * Render error state
 * @param {string} message
 * @param {Object} [options]
 * @param {string} [options.retryLabel='Retry']
 * @param {Function} [options.onRetry]
 * @returns {string}
 */
export function renderError(message, { retryLabel = 'Retry', onRetry } = {}) {
  const retryAttr = onRetry ? `onclick="${onRetry.toString()}"` : '';
  return `
    <div class="empty-state" data-testid="error-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Error</div>
      <div class="empty-state-description">${escapeHtml(message)}</div>
      ${onRetry ? `
        <button class="btn btn-primary mt-4" ${retryAttr}>${escapeHtml(retryLabel)}</button>
      ` : ''}
    </div>
  `;
}

/**
 * Render empty state
 * @param {Object} options
 * @param {string} options.icon
 * @param {string} options.title
 * @param {string} [options.description]
 * @param {Array<{label:string,href?:string,action?:string,variant?:string}>} [options.actions]
 * @returns {string}
 */
export function renderEmpty({ icon, title, description, actions }) {
  return `
    <div class="empty-state" data-testid="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      ${description ? `<div class="empty-state-description">${escapeHtml(description)}</div>` : ''}
      ${actions?.length ? `
        <div class="form-actions" style="justify-content:center;margin-top:16px">
          ${actions.map(({ label, href, action, variant = 'primary' }) => `
            ${href
              ? `<a href="${escapeHtml(href)}" class="btn btn-${variant}">${escapeHtml(label)}</a>`
              : `<button class="btn btn-${variant}" data-action="${escapeHtml(action ?? '')}">${escapeHtml(label)}</button>`
            }
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render list of items
 * @param {Array<Object>} items
 * @param {Function} renderItem
 * @param {Object} [options]
 * @param {string} [options.className='list']
 * @param {string} [options.emptyMessage='No items']
 * @returns {string}
 */
export function renderList(items, renderItem, { className = 'list', emptyMessage = 'No items' } = {}) {
  if (!items?.length) {
    return renderEmpty({ icon: '📭', title: emptyMessage });
  }

  return `
    <div class="${className}" data-testid="list-container">
      ${items.map((item, i) => renderItem(item, i)).join('')}
    </div>
  `;
}

/**
 * Render grid of items
 * @param {Array<Object>} items
 * @param {Function} renderItem
 * @param {number} [columns=3]
 * @param {string} [emptyMessage='No items']
 * @returns {string}
 */
export function renderGrid(items, renderItem, columns = 3, emptyMessage = 'No items') {
  if (!items?.length) {
    return renderEmpty({ icon: '📭', title: emptyMessage });
  }

  return `
    <div class="grid grid-${columns}" data-testid="grid-container" style="--grid-columns:${columns}">
      ${items.map((item, i) => renderItem(item, i)).join('')}
    </div>
  `;
}

/**
 * Bind delegated event handler
 * @param {HTMLElement} container
 * @param {string} selector
 * @param {string} event
 * @param {Function} handler
 * @returns {Function} Unbind function
 */
export function bindDelegate(container, selector, event, handler) {
  return delegate(container, selector, event, (e, target) => handler(e, target, e.target));
}

/**
 * Auto-grow textarea
 * @param {HTMLTextAreaElement} el
 * @param {number} [maxHeight=200]
 */
export function autoGrow(el, maxHeight = 200) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
}

/**
 * Character counter for textarea
 * @param {HTMLTextAreaElement} input
 * @param {HTMLElement} counter
 * @param {number} max
 */
export function setupCharCounter(input, counter, max) {
  if (!input || !counter) return;

  const update = () => {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.classList.toggle('text-danger', len > max * 0.9);
  };

  input.addEventListener('input', update);
  update();

  return () => input.removeEventListener('input', update);
}

/**
 * Setup form submission
 * @param {HTMLFormElement} form
 * @param {Function} onSubmit
 * @returns {Function} Cleanup
 */
export function setupFormSubmit(form, onSubmit) {
  if (!form) return;

  const handleSubmit = async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    await onSubmit(data, form);
  };

  form.addEventListener('submit', handleSubmit);
  return () => form.removeEventListener('submit', handleSubmit);
}

/**
 * Setup Ctrl+Enter submission
 * @param {HTMLTextAreaElement} input
 * @param {HTMLFormElement} form
 */
export function setupCtrlEnterSubmit(input, form) {
  if (!input || !form) return;

  input.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });
}
