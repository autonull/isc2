/* eslint-disable */
/**
 * Toast Notification System
 * 
 * Provides user feedback for actions and events.
 */

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const styles: Record<ToastType, string> = {
  success: '#17bf63',
  error: '#e0245e',
  info: '#1da1f2',
  warning: '#ffad1f',
};

const icons: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

/**
 * Show a toast notification
 */
export function showToast(message: string, options: ToastOptions = {}): void {
  const {
    type = 'info',
    duration = 3000,
    position = 'bottom-right',
  } = options;

  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      ${position.includes('top') ? 'top: 20px' : 'bottom: 20px'};
      ${position.includes('left') ? 'left: 20px' : position.includes('right') ? 'right: 20px' : 'left: 50%; transform: translateX(-50%)'};
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.style.cssText = `
    min-width: 280px;
    max-width: 400px;
    padding: 14px 20px;
    background: white;
    border-left: 4px solid ${styles[type]};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #14171a;
    animation: toastSlideIn 0.3s ease;
  `;

  toast.innerHTML = `
    <span style="font-size: 18px;">${icons[type]}</span>
    <span style="flex: 1;">${message}</span>
    <button 
      onclick="this.parentElement.remove()"
      style="background: none; border: none; cursor: pointer; padding: 4px; color: #657786; font-size: 18px;"
    >×</button>
  `;

  container.appendChild(toast);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// Add CSS animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes toastSlideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes toastSlideOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(20px);
    }
  }
`;
document.head.appendChild(styleSheet);

/**
 * Convenience functions
 */
export const toast = {
  success: (message: string) => showToast(message, { type: 'success' }),
  error: (message: string) => showToast(message, { type: 'error' }),
  info: (message: string) => showToast(message, { type: 'info' }),
  warning: (message: string) => showToast(message, { type: 'warning' }),
};

/**
 * Show loading toast (returns dismiss function)
 */
export function showLoading(message: string): () => void {
  const container = document.getElementById('toast-container') || (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;';
    document.body.appendChild(c);
    return c;
  })();

  const toast = document.createElement('div');
  toast.style.cssText = `
    min-width: 280px;
    padding: 14px 20px;
    background: white;
    border-left: 4px solid #1da1f2;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    color: #14171a;
  `;

  toast.innerHTML = `
    <span style="animation: spin 1s linear infinite;">⏳</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  return () => toast.remove();
}

// Add spin animation
const spinStyle = document.createElement('style');
spinStyle.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(spinStyle);

/**
 * Show confirmation dialog
 */
export function showConfirm(message: string, options: { title?: string; confirmText?: string; cancelText?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const {
      title = 'Confirm',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
    } = options;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      animation: fadeIn 0.2s ease;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      animation: slideUp 0.3s ease;
    `;

    dialog.innerHTML = `
      <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #14171a;">${title}</h3>
      <p style="margin: 0 0 24px 0; color: #657786; line-height: 1.5;">${message}</p>
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button 
          id="confirm-cancel"
          style="padding: 10px 20px; border: 1px solid #e1e8ed; background: white; border-radius: 6px; cursor: pointer; font-weight: 500; color: #657786;"
        >${cancelText}</button>
        <button 
          id="confirm-ok"
          style="padding: 10px 20px; border: none; background: #1da1f2; color: white; border-radius: 6px; cursor: pointer; font-weight: 500;"
        >${confirmText}</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
    };

    dialog.querySelector('#confirm-cancel')?.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    dialog.querySelector('#confirm-ok')?.addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });

    // Escape key closes dialog
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  });
}

// Add dialog animations
const dialogStyle = document.createElement('style');
dialogStyle.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(dialogStyle);
