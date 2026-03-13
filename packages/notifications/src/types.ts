/**
 * Notifications Type Definitions
 *
 * Cross-platform notification types.
 */

/**
 * Notification type
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Permission status
 */
export type PermissionStatus = 'granted' | 'denied' | 'default';

/**
 * Permission result
 */
export type PermissionResult = PermissionStatus;

/**
 * Notification action
 */
export interface NotificationAction {
  label: string;
  onClick: () => void;
}

/**
 * Notification
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
  action?: NotificationAction;
  onDismiss?: () => void;
}

/**
 * Notification handler interface
 */
export interface NotificationHandler {
  show(notification: Omit<Notification, 'id' | 'timestamp'>): Promise<string>;
  dismiss(id: string): Promise<void>;
  dismissAll(): Promise<void>;
  setBadgeCount(count: number): Promise<void>;
  requestPermission(): Promise<PermissionResult>;
  getPermissionStatus(): PermissionStatus;
}

/**
 * Notification queue item
 */
export interface QueuedNotification {
  notification: Omit<Notification, 'id' | 'timestamp'>;
  resolve: (id: string) => void;
  reject: (error: Error) => void;
}

/**
 * Notification listener
 */
export type NotificationListener = (notification: Notification) => void;

/**
 * Hook return type for useNotification
 */
export interface UseNotificationReturn {
  enabled: boolean;
  show: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  info: (title: string, message: string, duration?: number) => string;
  success: (title: string, message: string, duration?: number) => string;
  warning: (title: string, message: string, duration?: number) => string;
  error: (title: string, message: string, duration?: number) => string;
}
