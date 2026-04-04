/* eslint-disable */
/**
 * ComposeBar Component
 *
 * Post composition with channel selection, character counter, and Ctrl+Enter submit.
 */

import { el } from '../utils/dom.js';
import { escapeHtml } from '../utils/dom.js';
import { CharCounter, bindCharCounter } from './CharCounter.js';

/**
 * @typedef {Object} Channel
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} ComposeBarProps
 * @property {Channel[]} channels - Available channels
 * @property {string} [activeChannelId] - Currently selected channel
 * @property {number} [maxLength=2000]
 * @property {Function} [onSubmit] - Submit handler: (content, channelId) => void
 * @property {Function} [onCancelReply] - Cancel reply context
 * @property {Object} [replyTo] - Reply context: { author, content }
 * @property {string} [className]
 */

/**
 * @param {ComposeBarProps} props
 * @returns {HTMLElement}
 */
export function ComposeBar({
  channels,
  activeChannelId,
  maxLength = 2000,
  onSubmit,
  onCancelReply,
  replyTo,
  className = '',
}) {
  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? channels[0];
  const channelName = activeChannel?.name ?? 'default';
  const placeholder = `What's on your mind? Your post reaches the #${channelName} neighborhood.`;

  const container = el('div', { className: `compose-bar ${className}`.trim() });

  const form = el('form', { className: 'compose-form', 'data-testid': 'compose-form' });

  if (channels.length > 1) {
    const header = el('div', { className: 'compose-header' });
    header.appendChild(el('span', { className: 'compose-label' }, ['Posting to:']));

    const select = el('select', {
      className: 'compose-channel-select',
      'data-testid': 'compose-channel-sel',
    });
    channels.forEach((ch) => {
      const option = el('option', { value: ch.id, selected: ch.id === activeChannelId }, [
        `#${escapeHtml(ch.name)}`,
      ]);
      select.appendChild(option);
    });
    header.appendChild(select);
    form.appendChild(header);
  } else if (activeChannel) {
    const header = el('div', { className: 'compose-header' });
    header.appendChild(el('span', { className: 'compose-label' }, ['Posting to:']));
    header.appendChild(el('span', { className: 'channel-name' }, [`#${escapeHtml(channelName)}`]));
    form.appendChild(header);
  }

  const textarea = el('textarea', {
    className: 'compose-input',
    placeholder,
    maxlength: maxLength,
    'data-testid': 'compose-input',
    rows: 3,
  });
  form.appendChild(textarea);

  const actions = el('div', { className: 'compose-actions' });

  const counter = CharCounter({ current: 0, max: maxLength });
  counter.classList.add('char-count');
  counter.setAttribute('data-testid', 'compose-count');
  actions.appendChild(counter);

  const submitBtn = el(
    'button',
    {
      type: 'submit',
      className: 'btn btn-primary',
      'data-testid': 'compose-submit',
      disabled: true,
    },
    ['Post']
  );
  actions.appendChild(submitBtn);

  form.appendChild(actions);
  container.appendChild(form);

  if (replyTo) {
    const replyContext = el('div', {
      className: 'compose-reply-context',
      'data-testid': 'compose-reply-context',
    });
    replyContext.appendChild(el('span', {}, ['Replying to: ']));
    replyContext.appendChild(
      el('strong', { className: 'reply-author' }, [escapeHtml(replyTo.author ?? 'Unknown')])
    );
    const cancelBtn = el(
      'button',
      {
        type: 'button',
        className: 'btn-clear-reply',
        title: 'Cancel',
        onClick: onCancelReply,
      },
      ['✕']
    );
    replyContext.appendChild(cancelBtn);
    container.appendChild(replyContext);
  }

  return container;
}

/**
 * Mount ComposeBar with event handling
 * @param {HTMLElement} container
 * @param {ComposeBarProps} props
 * @returns {Function} Cleanup
 */
export function mountComposeBar(container, props) {
  const { channels, activeChannelId, maxLength, onSubmit, onCancelReply } = props;

  const bar = ComposeBar(props);
  container.appendChild(bar);

  const form = bar.querySelector('form');
  const textarea = bar.querySelector('textarea');
  const counter = bar.querySelector('.char-count');
  const submitBtn = bar.querySelector('[data-testid="compose-submit"]');
  const channelSelect = bar.querySelector('select');

  const cleanupCharCounter = bindCharCounter(textarea, {
    max: maxLength,
    counterClassName: 'char-count',
  });

  const handleInput = () => {
    const hasContent = textarea.value.trim().length > 0;
    submitBtn.disabled = !hasContent;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const content = textarea.value.trim();
    if (!content) return;

    const channelId = channelSelect?.value ?? activeChannelId ?? channels?.[0]?.id;
    await onSubmit?.(content, channelId);

    textarea.value = '';
    handleInput();
  };

  textarea.addEventListener('input', handleInput);

  textarea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', handleSubmit);

  if (channelSelect) {
    channelSelect.addEventListener('change', () => {
      const selectedId = channelSelect.value;
      const channel = channels.find((c) => c.id === selectedId);
      if (channel) {
        textarea.placeholder = `What's on your mind? Your post reaches the #${channel.name} neighborhood.`;
      }
    });
  }

  return () => {
    textarea.removeEventListener('input', handleInput);
    form.removeEventListener('submit', handleSubmit);
    cleanupCharCounter?.();
    bar.remove();
  };
}
