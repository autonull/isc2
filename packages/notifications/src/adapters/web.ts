/**
 * Web Notification Adapter
 *
 * Browser Notification API adapter.
 */

import type { NotificationHandler, Notification, PermissionStatus } from '../types.js';

/**
 * Web notification adapter
 */
export class WebNotificationAdapter implements NotificationHandler {
  private permission: PermissionStatus = 'default';
  private toastContainer: HTMLElement | null = null;

  constructor() {
    if (typeof Notification !== 'undefined') {
      this.permission = Notification.permission as PermissionStatus;
    }
  }

  private initToastContainer(): void {
    if (typeof document === 'undefined') return;

    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = 'isc-notifications__container';
      this.toastContainer.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 400px;
      `;
      document.body.appendChild(this.toastContainer);
    }
  }

  private createToast(notification: Omit<Notification, 'id' | 'timestamp'>): HTMLElement {
    const toast = document.createElement('div');
    toast.className = `isc-notification isc-notification--${notification.type}`;
    toast.style.cssText = `
      padding: 12px 16px;
      border-radius: 8px;
      background: white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 280px;
    `;

    const colors: Record<string, string> = {
      info: '#3b82f6',
      success: '#17bf63',
      warning: '#ffad1f',
      error: '#ef4444',
    };

    const icons: Record<string, string> = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
    };

    toast.style.borderLeft = `4px solid ${colors[notification.type]}`;

    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    title.textContent = `${icons[notification.type]} ${notification.title}`;

    const message = document.createElement('div');
    message.style.cssText = `
      font-size: 14px;
      color: #666;
    `;
    message.textContent = notification.message;

    toast.appendChild(title);
    toast.appendChild(message);

    // Add action button if present
    if (notification.action) {
      const actionBtn = document.createElement('button');
      actionBtn.textContent = notification.action.label;
      actionBtn.style.cssText = `
        margin-top: 8px;
        padding: 6px 12px;
        background: ${colors[notification.type]};
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      `;
      actionBtn.onclick = () => {
        notification.action!.onClick();
        toast.remove();
      };
      toast.appendChild(actionBtn);
    }

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #999;
    `;
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(closeBtn);

    return toast;
  }

  async show(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<string> {
    // Show browser notification if permission granted
    if (this.permission === 'granted' && typeof Notification !== 'undefined') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon.png',
        badge: '/badge.png',
      });
    }

    // Show toast
    if (typeof document !== 'undefined') {
      this.initToastContainer();
      const toast = this.createToast(notification);
      this.toastContainer?.appendChild(toast);

      // Auto-remove after duration
      if (notification.duration) {
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.transition = 'opacity 0.3s';
          setTimeout(() => toast.remove(), 300);
        }, notification.duration);
      }
    }

    return `notif_${Date.now()}`;
  }

  async dismiss(_id: string): Promise<void> {
    // Toast auto-dismisses or can be closed manually
  }

  async dismissAll(): Promise<void> {
    if (this.toastContainer) {
      this.toastContainer.innerHTML = '';
    }
  }

  async setBadgeCount(count: number): Promise<void> {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count);
      } else {
        navigator.clearAppBadge();
      }
    }
  }

  async requestPermission(): Promise<PermissionStatus> {
    if (typeof Notification === 'undefined') {
      this.permission = 'denied';
      return 'denied';
    }

    const result = await Notification.requestPermission();
    this.permission = result as PermissionStatus;
    return this.permission;
  }

  getPermissionStatus(): PermissionStatus {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    return Notification.permission as PermissionStatus;
  }
}

/**
 * Create web notification adapter
 */
export function createWebNotificationAdapter(): WebNotificationAdapter {
  return new WebNotificationAdapter();
}
