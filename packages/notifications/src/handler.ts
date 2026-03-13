/**
 * Notification Handler
 *
 * Core notification management with queue.
 */

import type {
  NotificationHandler,
  Notification,
  PermissionStatus,
  QueuedNotification,
  NotificationListener,
} from './types.js';

/**
 * Notification queue
 */
export class NotificationQueue {
  private queue: QueuedNotification[] = [];
  private processing: boolean = false;

  enqueue(item: QueuedNotification): void {
    this.queue.push(item);
    this.process();
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        // Processing is handled by the handler
        item.resolve(`notif_${Date.now()}`);
      } catch (error) {
        item.reject(error as Error);
      }
    }

    this.processing = false;
  }

  clear(): void {
    this.queue = [];
  }

  get length(): number {
    return this.queue.length;
  }
}

/**
 * Create notification handler
 */
export function createNotificationHandler(config?: {
  adapter?: NotificationHandler;
}): NotificationHandler {
  const { adapter } = config || {};
  const notifications = new Map<string, Notification>();
  const listeners = new Set<NotificationListener>();
  let badgeCount = 0;
  let permission: PermissionStatus = 'default';

  function notify(_event: 'show' | 'dismiss' | 'dismissAll', notification?: Notification): void {
    if (notification) {
      listeners.forEach((listener) => listener(notification));
    }
  }

  async function show(
    notification: Omit<Notification, 'id' | 'timestamp'>
  ): Promise<string> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    const fullNotification: Notification = {
      ...notification,
      id,
      timestamp,
    };

    notifications.set(id, fullNotification);
    notify('show', fullNotification);

    // Auto-dismiss if duration specified
    if (notification.duration) {
      setTimeout(() => {
        dismiss(id);
      }, notification.duration);
    }

    // Use adapter if available
    if (adapter) {
      await adapter.show(notification);
    }

    return id;
  }

  async function dismiss(id: string): Promise<void> {
    const notification = notifications.get(id);
    if (!notification) return;

    notifications.delete(id);
    notify('dismiss', notification);

    if (notification.onDismiss) {
      notification.onDismiss();
    }

    if (adapter) {
      await adapter.dismiss(id);
    }
  }

  async function dismissAll(): Promise<void> {
    const ids = Array.from(notifications.keys());
    notifications.clear();
    notify('dismissAll');

    for (const id of ids) {
      const notification = notifications.get(id);
      if (notification?.onDismiss) {
        notification.onDismiss();
      }
    }

    if (adapter) {
      await adapter.dismissAll();
    }
  }

  async function setBadgeCount(count: number): Promise<void> {
    badgeCount = Math.max(0, count);

    if (adapter) {
      await adapter.setBadgeCount(badgeCount);
    }
  }

  async function requestPermission(): Promise<PermissionStatus> {
    if (adapter) {
      permission = await adapter.requestPermission();
    } else if (typeof Notification !== 'undefined') {
      const result = await Notification.requestPermission();
      permission = result as PermissionStatus;
    }

    return permission;
  }

  function getPermissionStatus(): PermissionStatus {
    if (adapter) {
      return adapter.getPermissionStatus();
    }

    if (typeof Notification !== 'undefined') {
      return Notification.permission as PermissionStatus;
    }

    return 'default';
  }

  function _subscribe(listener: NotificationListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function _getNotifications(): Notification[] {
    return Array.from(notifications.values());
  }

  function _getNotification(id: string): Notification | undefined {
    return notifications.get(id);
  }

  return {
    show,
    dismiss,
    dismissAll,
    setBadgeCount,
    requestPermission,
    getPermissionStatus,
  } as NotificationHandler & {
    subscribe: (listener: NotificationListener) => () => void;
    getNotifications: () => Notification[];
    getNotification: (id: string) => Notification | undefined;
  };

  // Unused functions kept for type compatibility
  void _subscribe;
  void _getNotifications;
  void _getNotification;
}

/**
 * Default notification handler with in-memory storage
 */
export function createDefaultHandler(): NotificationHandler {
  return createNotificationHandler();
}
