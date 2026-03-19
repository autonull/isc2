/**
 * Modal Component
 * Simple, accessible modal system with promise-based confirm dialogs
 */

import { escapeHtml } from '../../utils/dom.js';

let activeModal = null;

export const modals = {
  /** Open a modal with arbitrary HTML content */
  open(contentHTML, { onClose } = {}) {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('data-testid', 'modal-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('data-testid', 'modal');
    modal.innerHTML = contentHTML;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    activeModal = { overlay, onClose };

    // Close on overlay click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.close();
    });

    // Close on Escape
    const handleKey = e => {
      if (e.key === 'Escape') { this.close(); document.removeEventListener('keydown', handleKey); }
    };
    document.addEventListener('keydown', handleKey);

    // Focus first focusable element
    setTimeout(() => modal.querySelector('button, input, textarea, select, [tabindex]')?.focus(), 50);

    return overlay;
  },

  close() {
    if (!activeModal) return;
    const { overlay, onClose } = activeModal;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s';
    setTimeout(() => { overlay.remove(); }, 150);
    activeModal = null;
    onClose?.();
  },

  /** Promise-based confirm dialog */
  confirm(message, { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
    return new Promise(resolve => {
      const html = `
        <div class="modal-header">
          <h2 class="modal-title">${escapeHtml(title)}</h2>
          <button class="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body" data-testid="modal-body">${escapeHtml(message)}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-action="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      `;

      const overlay = this.open(html);
      overlay.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        this.close();
        resolve(btn.dataset.action === 'confirm');
      });
    });
  },

  /** Show keyboard shortcuts help */
  showHelp() {
    const shortcuts = [
      { key: '?',       desc: 'Show this help' },
      { key: 'Ctrl+K',  desc: 'New Channel' },
      { key: 'Ctrl+,',  desc: 'Settings' },
      { key: 'Ctrl+D',  desc: 'Toggle debug panel' },
      { key: 'Ctrl+Enter', desc: 'Send message / Submit' },
      { key: '/',       desc: 'Focus input (when no input focused)' },
      { key: 'Esc',     desc: 'Close modal / dialog' },
    ];

    const html = `
      <div class="modal-header">
        <h2 class="modal-title">⌨️ Keyboard Shortcuts</h2>
        <button class="modal-close" data-testid="modal-close" aria-label="Close">×</button>
      </div>
      <div class="shortcuts-list" data-testid="shortcuts-list">
        ${shortcuts.map(s => `
          <div class="shortcut-item">
            <kbd>${escapeHtml(s.key)}</kbd>
            <span>${escapeHtml(s.desc)}</span>
          </div>
        `).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" data-testid="modal-got-it">Got it</button>
      </div>
    `;

    const overlay = this.open(html, { });
    overlay.addEventListener('click', e => {
      if (e.target.closest('.modal-close, [data-testid="modal-got-it"]')) this.close();
    });
  },
};
