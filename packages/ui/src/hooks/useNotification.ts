/**
 * useNotification Hook
 *
 * Notification management hook.
 */

import { useCallback } from 'preact/hooks';
import { useAppState } from './useAppState.js';
import type { AppState } from '@isc/state';

/**
 * Notification type
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

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
}

/**
 * Use notifications hook
 */
export function useNotifications() {
  const notificationsEnabled = useAppState(
    (state: AppState) => state.settings.notifications
  );

  const show = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>): string => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('Show notification:', { id, ...notification });
      // Would dispatch action in real implementation
      return id;
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    console.log('Dismiss notification:', id);
    // Would dispatch action in real implementation
  }, []);

  const dismissAll = useCallback(() => {
    console.log('Dismiss all notifications');
    // Would dispatch action in real implementation
  }, []);

  const info = useCallback(
    (title: string, message: string, duration?: number): string => {
      return show({ type: 'info', title, message, duration });
    },
    [show]
  );

  const success = useCallback(
    (title: string, message: string, duration?: number): string => {
      return show({ type: 'success', title, message, duration });
    },
    [show]
  );

  const warning = useCallback(
    (title: string, message: string, duration?: number): string => {
      return show({ type: 'warning', title, message, duration });
    },
    [show]
  );

  const error = useCallback(
    (title: string, message: string, duration?: number): string => {
      return show({ type: 'error', title, message, duration });
    },
    [show]
  );

  return {
    enabled: notificationsEnabled,
    show,
    dismiss,
    dismissAll,
    info,
    success,
    warning,
    error,
  };
}

/**
 * Use badge count hook
 */
export function useBadgeCount(): number {
  return useAppState((state: AppState) =>
    Array.from(state.conversations.values()).reduce((sum, c) => sum + c.unreadCount, 0)
  );
}
