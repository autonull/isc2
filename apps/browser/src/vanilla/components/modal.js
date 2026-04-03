/**
 * Modal Component
 *
 * Simple, accessible modal system with promise-based confirm dialogs.
 */

import { escapeHtml } from '../utils/dom.js';
import { moderationService } from '../../services/index.js';

let activeModal = null;

/**
 * @typedef {Object} ModalOptions
 * @property {Function} [onClose]
 */

/**
 * @typedef {Object} ConfirmOptions
 * @property {string} [title='Confirm']
 * @property {string} [confirmText='Confirm']
 * @property {string} [cancelText='Cancel']
 * @property {boolean} [danger=false]
 */

export const modals = {
  /**
   * Open a modal with arbitrary HTML content
   * @param {string} contentHTML
   * @param {ModalOptions} [options]
   * @returns {HTMLElement} Overlay element
   */
  open(contentHTML, { onClose } = {}) {
    this.close();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('data-testid', 'modal-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = contentHTML;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const focusableSelectors =
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), ' +
      'select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const handleTabTrap = e => {
      if (e.key !== 'Tab' || !activeModal) return;
      const focusable = [...modal.querySelectorAll(focusableSelectors)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleTabTrap);

    activeModal = { overlay, onClose, handleTabTrap };

    overlay.addEventListener('click', e => {
      if (e.target === overlay) this.close();
    });

    const handleKey = e => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleKey);
      }
    };
    document.addEventListener('keydown', handleKey);

    setTimeout(() => modal.querySelector('button, input, textarea, select, [tabindex]')?.focus(), 50);

    return overlay;
  },

  /**
   * Close active modal
   */
  close() {
    if (!activeModal) return;

    const { overlay, onClose, handleTabTrap } = activeModal;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s';
    setTimeout(() => overlay.remove(), 150);

    if (handleTabTrap) {
      document.removeEventListener('keydown', handleTabTrap);
    }

    activeModal = null;
    onClose?.();
  },

  /**
   * Promise-based confirm dialog
   * @param {string} message
   * @param {ConfirmOptions} [options]
   * @returns {Promise<boolean>}
   */
  confirm(message, { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
    return new Promise(resolve => {
      let resolved = false;
      const settle = value => {
        if (!resolved) {
          resolved = true;
          resolve(value);
        }
      };

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

      const overlay = this.open(html, { onClose: () => settle(false) });
      overlay.addEventListener('click', e => {
        if (e.target.closest('.modal-close')) {
          settle(false);
          this.close();
          return;
        }
        const btn = e.target.closest('[data-action]');
        if (btn) {
          settle(btn.dataset.action === 'confirm');
          this.close();
        }
      });
    });
  },

  /**
   * Show keyboard shortcuts help
   */
  showHelp() {
    const shortcuts = [
      { key: '?', desc: 'Show this help' },
      { key: 'Ctrl+K', desc: 'New channel' },
      { key: 'Ctrl+,', desc: 'Settings' },
      { key: 'Ctrl+D', desc: 'Toggle debug panel' },
      { key: 'Ctrl+Enter', desc: 'Send message / Submit form' },
      { key: '/', desc: 'Focus search / input' },
      { key: 'Ctrl+Space', desc: 'Toggle serendipity mode' },
      { key: 'Esc', desc: 'Close modal / dialog' },
      { key: '↑ ↓', desc: 'Navigate conversation list' },
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

    const overlay = this.open(html);
    overlay.addEventListener('click', e => {
      if (e.target.closest('.modal-close, [data-testid="modal-got-it"]')) this.close();
    });
  },

  /**
   * H1: Show peer profile modal
   * @param {Object} peer - Peer match object with identity, similarity, etc.
   */
  showPeerProfile(peer) {
    if (!peer) return;

    const identity = peer.identity ?? {};
    const name = identity.name ?? 'Anonymous';
    const bio = identity.bio ?? 'No bio provided';
    const peerId = peer.peerId ?? identity.peerId ?? 'Unknown';
    const similarity = peer.similarity != null ? Math.round(peer.similarity * 100) : null;
    const online = peer.online ?? false;
    const matchedTopics = peer.matchedTopics ?? [];
    const initials = (name[0] ?? 'A').toUpperCase();
    const isBlocked = moderationService.isBlocked(peerId);

    const html = `
      <div class="peer-profile-modal" data-testid="peer-profile-modal">
        <div class="modal-header">
          <h2 class="modal-title">Peer Profile</h2>
          <button class="modal-close" data-testid="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body peer-profile-body">
          <div class="peer-profile-header">
            <div class="peer-avatar-large${online ? ' online' : ''}">${initials}</div>
            <div class="peer-profile-info">
              <h3 class="peer-profile-name">${escapeHtml(name)}</h3>
              <div class="flex-row gap-2">
                <span class="peer-status-badge ${online ? 'online' : 'offline'}">
                  ${online ? '● Online' : '○ Offline'}
                </span>
                ${similarity != null ? `
                  <span class="peer-sim-badge">${similarity}% match</span>
                ` : ''}
              </div>
            </div>
          </div>
          <div class="peer-profile-section">
            <h4 class="peer-profile-label">About</h4>
            <p class="peer-profile-bio">${escapeHtml(bio)}</p>
          </div>
          ${matchedTopics.length > 0 ? `
            <div class="peer-profile-section">
              <h4 class="peer-profile-label">Shared Interests</h4>
              <div class="peer-topics">
                ${matchedTopics.slice(0, 10).map(t => `
                  <span class="peer-topic-tag">${escapeHtml(t)}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div class="peer-profile-section">
            <h4 class="peer-profile-label">Peer ID</h4>
            <code class="peer-profile-id">${escapeHtml(peerId.slice(0, 16))}${peerId.length > 16 ? '…' : ''}</code>
          </div>
          ${isBlocked ? `
            <div class="peer-profile-section danger">
              <h4 class="peer-profile-label text-danger">⚠️ This peer is blocked</h4>
              <p class="text-muted text-sm">You will not see messages or updates from this peer.</p>
            </div>
          ` : ''}
        </div>
        <div class="modal-actions peer-profile-actions">
          <button class="btn btn-ghost" data-action="close">Close</button>
          ${isBlocked ? `
            <button class="btn btn-primary" data-action="unblock">Unblock Peer</button>
          ` : `
            <button class="btn btn-danger" data-action="block">Block Peer</button>
            <button class="btn btn-primary" data-action="start-chat">Start Conversation</button>
          `}
        </div>
      </div>
    `;

    const overlay = this.open(html);
    overlay.addEventListener('click', e => {
      if (e.target.closest('.modal-close, [data-action="close"]')) {
        this.close();
        return;
      }
      if (e.target.closest('[data-action="start-chat"]')) {
        this.close();
        // Navigate to chats and open conversation with this peer
        window.location.hash = '#/chats';
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }));
        }, 100);
        return;
      }
      if (e.target.closest('[data-action="block"]')) {
        moderationService.block(peerId, 'User blocked via profile');
        this.close();
        // Re-open modal to show blocked state
        setTimeout(() => this.showPeerProfile(peer), 100);
        return;
      }
      if (e.target.closest('[data-action="unblock"]')) {
        moderationService.unblock(peerId);
        this.close();
        // Re-open modal to show unblocked state
        setTimeout(() => this.showPeerProfile(peer), 100);
      }
    });
  },
};

export default modals;
