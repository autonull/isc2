/* eslint-disable */
/**
 * Component Factory
 *
 * Reusable UI component builders for consistent patterns.
 */

import { el, escapeHtml, delegate } from './dom.js';

/**
 * Button component
 * @param {Object} props
 * @param {'primary'|'secondary'|'icon'|'ghost'} [props.variant='primary']
 * @param {string} [props.icon]
 * @param {string} [props.label]
 * @param {string} [props.title]
 * @param {boolean} [props.disabled]
 * @param {Function} [props.onClick]
 * @param {Object} [props.dataset]
 * @returns {HTMLButtonElement}
 */
export function Button({ variant = 'primary', icon, label, title, disabled, onClick, dataset }) {
  const classes = ['btn', `btn-${variant}`];
  if (icon && !label) classes.push('btn-icon-only');

  return el('button', {
    className: classes.join(' '),
    disabled,
    title,
    dataset,
    onClick: disabled ? null : onClick,
  }, [
    icon ? el('span', { className: 'btn-icon' }, [icon]) : null,
    label ? el('span', { className: 'btn-label' }, [label]) : null,
  ].filter(Boolean));
}

/**
 * Badge component
 * @param {Object} props
 * @param {string} props.label
 * @param {'default'|'success'|'warning'|'danger'|'brand'} [props.variant='default']
 * @param {string} [props.title]
 * @returns {HTMLSpanElement}
 */
export function Badge({ label, variant = 'default', title }) {
  return el('span', {
    className: `badge badge-${variant}`,
    title,
  }, [String(label)]);
}

/**
 * Select dropdown component
 * @param {Object} props
 * @param {Array<{value:string,label:string}>} props.options
 * @param {string} [props.value]
 * @param {Function} [props.onChange]
 * @param {string} [props.className]
 * @returns {HTMLSelectElement}
 */
export function Select({ options, value, onChange, className = '' }) {
  return el('select', {
    className: `form-select ${className}`.trim(),
    onChange,
  }, options.map(opt =>
    el('option', { value: opt.value, selected: opt.value === value }, [opt.label])
  ));
}

/**
 * Input field component
 * @param {Object} props
 * @param {'text'|'email'|'password'|'number'} [props.type='text']
 * @param {string} [props.value]
 * @param {string} [props.placeholder]
 * @param {boolean} [props.disabled]
 * @param {Function} [props.onInput]
 * @param {Function} [props.onChange]
 * @param {number} [props.maxLength]
 * @returns {HTMLInputElement}
 */
export function Input({ type = 'text', value, placeholder, disabled, onInput, onChange, maxLength }) {
  return el('input', {
    type,
    className: 'form-input',
    value,
    placeholder,
    disabled,
    maxLength,
    onInput,
    onChange,
  });
}

/**
 * Textarea component
 * @param {Object} props
 * @param {string} [props.value]
 * @param {string} [props.placeholder]
 * @param {number} [props.rows=3]
 * @param {number} [props.maxLength]
 * @param {boolean} [props.disabled]
 * @param {Function} [props.onInput]
 * @returns {HTMLTextAreaElement}
 */
export function Textarea({ value, placeholder, rows = 3, maxLength, disabled, onInput }) {
  return el('textarea', {
    className: 'form-textarea',
    rows,
    placeholder,
    maxLength,
    disabled,
    onInput,
  }, [value ?? '']);
}

/**
 * Card component
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 * @param {Array<Node>} [props.children]
 * @param {string} [props.className]
 * @returns {HTMLDivElement}
 */
export function Card({ title, subtitle, children, className = '' }) {
  return el('div', {
    className: `card ${className}`.trim(),
  }, [
    title ? el('div', { className: 'card-header' }, [
      el('h3', { className: 'card-title' }, [title]),
      subtitle ? el('p', { className: 'card-subtitle' }, [subtitle]) : null,
    ].filter(Boolean)) : null,
    el('div', { className: 'card-body' }, children ?? []),
  ].filter(Boolean));
}

/**
 * Empty state component
 * @param {Object} props
 * @param {string} props.icon
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {Array<{label:string,href:string,variant?:string}>} [props.actions]
 * @returns {HTMLDivElement}
 */
export function EmptyState({ icon, title, description, actions }) {
  return el('div', {
    className: 'empty-state',
  }, [
    el('div', { className: 'empty-state-icon' }, [icon]),
    el('div', { className: 'empty-state-title' }, [title]),
    description ? el('div', { className: 'empty-state-description' }, [description]) : null,
    actions?.length ? el('div', { className: 'form-actions' }, [
      actions.map(({ label, href, variant = 'primary' }) =>
        el('a', { href, className: `btn btn-${variant}` }, [label])
      ),
    ]) : null,
  ].filter(Boolean));
}

/**
 * Loading spinner component
 * @param {Object} props
 * @param {string} [props.size='md']
 * @param {string} [props.label='Loading...']
 * @returns {HTMLDivElement}
 */
export function Spinner({ size = 'md', label }) {
  return el('div', {
    className: `spinner spinner-${size}`,
    role: 'status',
    'aria-label': label ?? 'Loading',
  });
}

/**
 * Modal component
 * @param {Object} props
 * @param {string} props.title
 * @param {Array<Node>} [props.children]
 * @param {Array<{label:string,variant?:string,onClick?:Function}>} [props.actions]
 * @param {Function} [props.onClose]
 * @returns {HTMLDivElement}
 */
export function Modal({ title, children, actions, onClose }) {
  const overlay = el('div', { className: 'modal-overlay' });
  const modal = el('div', { className: 'modal-content' }, [
    el('div', { className: 'modal-header' }, [
      el('h3', { className: 'modal-title' }, [title]),
      el('button', {
        className: 'modal-close',
        onClick: onClose,
        'aria-label': 'Close',
      }, ['×']),
    ]),
    el('div', { className: 'modal-body' }, children ?? []),
    actions?.length ? el('div', { className: 'modal-footer' }, [
      actions.map(({ label, variant = 'secondary', onClick }) =>
        el('button', {
          className: `btn btn-${variant}`,
          onClick: e => { onClick?.(e); onClose?.(); },
        }, [label])
      ),
    ]) : null,
  ].filter(Boolean));

  overlay.appendChild(modal);
  overlay.addEventListener('click', e => { if (e.target === overlay) onClose?.(); });
  return overlay;
}

/**
 * Toast notification component
 * @param {Object} props
 * @param {string} props.message
 * @param {'info'|'success'|'warning'|'error'} [props.type='info']
 * @param {number} [props.duration=3000]
 * @returns {HTMLDivElement}
 */
export function Toast({ message, type = 'info', duration = 3000 }) {
  const toast = el('div', {
    className: `toast toast-${type}`,
    role: 'alert',
  }, [escapeHtml(message)]);

  if (duration > 0) {
    setTimeout(() => toast.remove(), duration);
  }

  return toast;
}

/**
 * List component with items
 * @param {Object} props
 * @param {Array<{id:string,content:Node,onClick?:Function}>} props.items
 * @param {string} [props.className]
 * @returns {HTMLUListElement}
 */
export function List({ items, className = '' }) {
  return el('ul', {
    className: `list ${className}`.trim(),
  }, items.map(item =>
    el('li', {
      className: 'list-item',
      'data-id': item.id,
      onClick: item.onClick,
    }, [item.content])
  ));
}

/**
 * Grid component
 * @param {Object} props
 * @param {number} [props.columns=3]
 * @param {Array<Node>} [props.children]
 * @param {string} [props.className]
 * @returns {HTMLDivElement}
 */
export function Grid({ columns = 3, children, className = '' }) {
  return el('div', {
    className: `grid grid-${columns} ${className}`.trim(),
    style: { '--grid-columns': columns },
  }, children ?? []);
}
