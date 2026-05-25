/* eslint-disable */
/**
 * Notification Service - Browser notifications for new messages and matches
 */

const NOTIFICATION_PERMISSION_KEY = 'isc-notification-permission';
const NOTIFICATION_PREF_KEY = 'isc-notification-enabled';

export interface NotificationService {
  requestPermission(): Promise<NotificationPermission>;
  hasPermission(): boolean;
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
  showMessage(peerId: string, message: string): void;
  showMatchNotification(matchCount: number, topMatchSimilarity: number): void;
  clearBadge(): void;
  setBadgeCount(count: number): void;
}

class BrowserNotificationService implements NotificationService {
  private badgeCount = 0;
  private enabled = true;
  private lastNotificationTime = new Map<string, number>();
  private readonly NOTIFICATION_COOLDOWN = 60000; // 1 minute between same type notifications

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

  /**
   * Show notification for new message
   */
  showMessage(peerId: string, message: string): void {
    if (!this.shouldShowNotification('message')) {
      return;
    }

    // Don't show notification if tab is focused
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      return;
    }

    this.showNotification({
      title: 'New Message',
      body: `Peer ${peerId.slice(0, 8)}...: ${message.slice(0, 100)}`,
      tag: 'isc-message',
      icon: '/favicon.ico',
    });
  }

  /**
   * Show notification for new matches found
   */
  showMatchNotification(matchCount: number, topMatchSimilarity: number): void {
    if (!this.shouldShowNotification('match')) {
      return;
    }

    // Don't show notification if tab is focused
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      return;
    }

    const similarityLabel = topMatchSimilarity >= 0.85 ? 'Very Close' :
                           topMatchSimilarity >= 0.70 ? 'Nearby' : 'Orbiting';

    this.showNotification({
      title: 'New Matches Found',
      body: `${matchCount} new peer${matchCount !== 1 ? 's' : ''} discovered! Top match: ${similarityLabel} (${Math.round(topMatchSimilarity * 100)}%)`,
      tag: 'isc-match',
      icon: '/favicon.ico',
    });
  }

  /**
   * Check if notification should be shown (rate limiting)
   */
  private shouldShowNotification(type: string): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    const now = Date.now();
    const lastTime = this.lastNotificationTime.get(type) || 0;

    if (now - lastTime < this.NOTIFICATION_COOLDOWN) {
      return false; // Rate limit
    }

    this.lastNotificationTime.set(type, now);
    return true;
  }

  /**
   * Show browser notification
   */
  private showNotification(options: {
    title: string;
    body: string;
    tag: string;
    icon?: string;
  }): void {
    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon,
        badge: '/favicon.ico',
        tag: options.tag,
        requireInteraction: false,
      });

      // Click notification to focus window and navigate
      notification.onclick = () => {
        window.focus();
        notification.close();
        
        // Navigate based on notification type
        if (options.tag === 'isc-message') {
          window.dispatchEvent(new CustomEvent('isc-navigate', { detail: { tab: 'chats' } }));
        } else if (options.tag === 'isc-match') {
          window.dispatchEvent(new CustomEvent('isc-navigate', { detail: { tab: 'discover' } }));
        }
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
