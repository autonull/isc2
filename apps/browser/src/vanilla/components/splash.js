/**
 * Splash Screen Component
 * Shown during app initialization with progress tracking
 */

import { escapeHtml } from '../utils/dom.js';

export function createSplash(container) {
  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('data-testid', 'splash-screen');
  el.innerHTML = `
    <div class="splash-logo" data-testid="splash-logo">ISC</div>
    <div class="splash-status" data-testid="splash-status">Initializing...</div>
    <div class="splash-progress-track">
      <div class="splash-progress-fill" data-testid="splash-progress" style="width:0%"></div>
    </div>
  `;
  container.appendChild(el);

  const statusEl  = el.querySelector('[data-testid="splash-status"]');
  const fillEl    = el.querySelector('[data-testid="splash-progress"]');

  return {
    update(status, progress) {
      if (statusEl) statusEl.textContent = status;
      if (fillEl)   fillEl.style.width = `${progress}%`;
    },

    showError(message, onRetry) {
      el.querySelector('.splash-error')?.remove();
      const div = document.createElement('div');
      div.className = 'splash-error';
      div.setAttribute('data-testid', 'splash-error');
      div.innerHTML = `
        <div data-testid="splash-error-message">⚠️ ${escapeHtml(message)}</div>
        <button class="btn btn-danger mt-2" data-testid="retry-init">Retry</button>
      `;
      div.querySelector('[data-testid="retry-init"]')?.addEventListener('click', onRetry);
      el.appendChild(div);
    },

    hide() {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease';
      setTimeout(() => el.remove(), 300);
    },

    destroy() { el.remove(); },
  };
}
