/**
 * Time Formatting Utilities
 *
 * Shared utilities for formatting timestamps and relative time.
 */

/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format timestamp as absolute date/time
 */
export function formatDateTime(timestamp: number, options?: Intl.DateTimeFormatOptions): string {
  return new Date(timestamp).toLocaleString(undefined, options);
}

/**
 * Check if timestamp is within time window
 */
export function isWithinTimeWindow(timestamp: number, windowMs: number): boolean {
  return Date.now() - timestamp < windowMs;
}

/**
 * Get time remaining until expiry
 */
export function getTimeRemaining(timestamp: number, ttlMs: number): number {
  const expiresAt = timestamp + ttlMs;
  return Math.max(0, expiresAt - Date.now());
}
