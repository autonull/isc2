/**
 * Notification Hooks
 *
 * Preact hooks for notifications.
 */

import { useCallback, useMemo } from 'preact/hooks';
import type { UseNotificationReturn, Notification } from '../types.js';

let globalHandler: {
  show: (n: Omit<Notification, 'id' | 'timestamp'>) => Promise<string>;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
} | null = null;

/**
 * Set global notification handler
 */
export function setNotificationHandler(handler: {
  show: (n: Omit<Notification, 'id' | 'timestamp'>) => Promise<string>;
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
}): void {
  globalHandler = handler;
}

/**
 * Get global notification handler
 */
export function getNotificationHandler(): typeof globalHandler {
  return globalHandler;
}

/**
 * Use notifications hook
 */
export function useNotifications(): UseNotificationReturn {
  const show = useCallback(
    (notification: Omit<Notification, 'id' | 'timestamp'>): string => {
      const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      globalHandler?.show(notification);
      return id;
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    globalHandler?.dismiss(id);
  }, []);

  const dismissAll = useCallback(() => {
    globalHandler?.dismissAll();
  }, []);

  const info = useCallback(
    (title: string, message: string, duration: number = 5000): string => {
      return show({ type: 'info', title, message, duration });
    },
    [show]
  );

  const success = useCallback(
    (title: string, message: string, duration: number = 5000): string => {
      return show({ type: 'success', title, message, duration });
    },
    [show]
  );

  const warning = useCallback(
    (title: string, message: string, duration: number = 5000): string => {
      return show({ type: 'warning', title, message, duration });
    },
    [show]
  );

  const error = useCallback(
    (title: string, message: string, duration: number = 5000): string => {
      return show({ type: 'error', title, message, duration });
    },
    [show]
  );

  return useMemo(
    () => ({
      enabled: true,
      show,
      dismiss,
      dismissAll,
      info,
      success,
      warning,
      error,
    }),
    [show, dismiss, dismissAll, info, success, warning, error]
  );
}

/**
 * Use badge count hook
 */
export function useBadgeCount(): number {
  // This would connect to state in a real implementation
  return 0;
}
