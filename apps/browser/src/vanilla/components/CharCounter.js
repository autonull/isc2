/**
 * CharCounter Component
 *
 * Character counter with warning states for text inputs.
 */

import { el } from '../utils/dom.js';

/**
 * @typedef {Object} CharCounterProps
 * @property {number} current - Current character count
 * @property {number} max - Maximum character count
 * @property {boolean} [showPercentage] - Show percentage instead of count
 * @property {string} [className]
 */

/**
 * @param {CharCounterProps} props
 * @returns {HTMLElement}
 */
export function CharCounter({ current, max, showPercentage = false, className = '' }) {
  const percentage = Math.round((current / max) * 100);
  const display = showPercentage ? `${percentage}%` : `${current} / ${max}`;

  const warningLevel = percentage >= 100 ? 'danger' : percentage >= 90 ? 'warning' : 'normal';
  const classes = ['char-counter', `char-counter--${warningLevel}`, className]
    .filter(Boolean)
    .join(' ');

  return el('span', { className: classes, 'data-current': current, 'data-max': max }, [display]);
}

/**
 * Mount CharCounter to input element
 * @param {HTMLTextAreaElement|HTMLInputElement} input
 * @param {Object} options
 * @param {number} [options.max=2000]
 * @param {boolean} [options.showPercentage]
 * @param {string} [options.counterClassName]
 * @returns {Function} Cleanup
 */
export function bindCharCounter(
  input,
  { max = 2000, showPercentage = false, counterClassName = '' } = {}
) {
  if (!input) return () => {};

  const counter = CharCounter({
    current: input.value.length,
    max,
    showPercentage,
    className: counterClassName,
  });
  input.parentNode?.insertBefore(counter, input.nextSibling);

  const update = () => {
    const current = input.value.length;
    const percentage = Math.round((current / max) * 100);
    const display = showPercentage ? `${percentage}%` : `${current} / ${max}`;

    counter.textContent = display;
    counter.dataset.current = current;

    if (percentage >= 100) {
      counter.classList.remove('char-counter--warning');
      counter.classList.add('char-counter--danger');
    } else if (percentage >= 90) {
      counter.classList.remove('char-counter--danger');
      counter.classList.add('char-counter--warning');
    } else {
      counter.classList.remove('char-counter--warning', 'char-counter--danger');
    }
  };

  input.addEventListener('input', update);
  update();

  return () => {
    input.removeEventListener('input', update);
    counter.remove();
  };
}
