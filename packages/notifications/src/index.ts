/**
 * @isc/notifications - Notification System
 *
 * Cross-platform notification API.
 */

export {
  createNotificationHandler,
  createDefaultHandler,
  NotificationQueue,
} from './handler.js';
export {
  WebNotificationAdapter,
  createWebNotificationAdapter,
} from './adapters/web.js';
export {
  useNotifications,
  useBadgeCount,
  setNotificationHandler,
  getNotificationHandler,
} from './hooks/index.js';
export type {
  NotificationType,
  PermissionStatus,
  PermissionResult,
  NotificationAction,
  Notification,
  NotificationHandler,
  QueuedNotification,
  NotificationListener,
  UseNotificationReturn,
} from './types.js';
