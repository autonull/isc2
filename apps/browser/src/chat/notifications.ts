/**
 * Notification Service - Browser notifications for new messages
 */

const NOTIFICATION_PERMISSION_KEY = 'isc-notification-permission';
const NOTIFICATION_PREF_KEY = 'isc-notification-enabled';

export interface NotificationService {
  requestPermission(): Promise<NotificationPermission>;
  hasPermission(): boolean;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  showMessage(peerId: string, message: string): void;
  clearBadge(): void;
  setBadgeCount(count: number): void;
}

class BrowserNotificationService implements NotificationService {
  private badgeCount = 0;
  private enabled = true;

  constructor() {
    // Load saved preference
    const saved = localStorage.getItem(NOTIFICATION_PREF_KEY);
    this.enabled = saved !== 'false';
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('[Notifications] Browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      console.warn('[Notifications] Permission previously denied');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      localStorage.setItem(NOTIFICATION_PERMISSION_KEY, permission);
      return permission;
    } catch (err) {
      console.error('[Notifications] Failed to request permission:', err);
      return 'denied';
    }
  }

  hasPermission(): boolean {
    if (!('Notification' in window)) {
      return false;
    }
    return Notification.permission === 'granted';
  }

  isEnabled(): boolean {
    return this.enabled && this.hasPermission();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem(NOTIFICATION_PREF_KEY, String(enabled));
  }

  showMessage(peerId: string, message: string): void {
    if (!this.isEnabled()) {
      return;
    }

    // Don't show notification if tab is focused
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      return;
    }

    try {
      const notification = new Notification('New Message', {
        body: `Peer ${peerId.slice(0, 8)}...: ${message.slice(0, 100)}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'isc-message',
        requireInteraction: false,
      });

      // Click notification to focus window
      notification.onclick = () => {
        window.focus();
        notification.close();
        // Navigate to chats - custom event for app to handle
        window.dispatchEvent(new CustomEvent('isc-navigate', { detail: { tab: 'chats' } }));
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (err) {
      console.error('[Notifications] Failed to show notification:', err);
    }
  }

  setBadgeCount(count: number): void {
    this.badgeCount = count;

    // Use Navigator Badging API if available
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    }

    // Also update document title
    if (count > 0) {
      const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = `(${count}) ${originalTitle}`;
    } else {
      document.title = document.title.replace(/^\(\d+\)\s*/, '');
    }
  }

  clearBadge(): void {
    this.setBadgeCount(0);
  }

  getBadgeCount(): number {
    return this.badgeCount;
  }
}

// Singleton instance
export const notificationService = new BrowserNotificationService();
