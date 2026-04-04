/**
 * Notification Provider
 *
 * Provides notification context to component tree.
 */

import type { JSX } from 'preact';
import { h } from 'preact';
import { createContext } from 'preact';
import { useNotifications as useNotificationsHook } from '../hooks/useNotification.js';
import type { Notification } from '../hooks/useNotification.js';

/**
 * Notification context value
 */
export interface NotificationContextValue {
  show: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  info: (title: string, message: string, duration?: number) => string;
  success: (title: string, message: string, duration?: number) => string;
  warning: (title: string, message: string, duration?: number) => string;
  error: (title: string, message: string, duration?: number) => string;
}

/**
 * Notification context
 */
export const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * Notification provider props
 */
export interface NotificationProviderProps {
  children: JSX.Element;
}

/**
 * Notification provider component
 */
export function NotificationProvider({ children }: NotificationProviderProps): JSX.Element {
  const notifications = useNotificationsHook();

  return h(NotificationContext.Provider, { value: notifications }, children);
}

/**
 * Use notifications from context
 */
export function useNotificationContext(): NotificationContextValue {
  return useNotificationsHook();
}
