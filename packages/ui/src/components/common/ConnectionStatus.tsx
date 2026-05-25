/**
 * Connection Status Component
 *
 * Displays online/offline status indicator.
 */

import type { JSX} from 'preact';
import { h, Fragment } from 'preact';
import { useIsOnline } from '../../hooks/useAppState.js';

export interface ConnectionStatusProps {
  showLabel?: boolean;
  className?: string;
}

export function ConnectionStatus({
  showLabel = false,
  className = '',
}: ConnectionStatusProps): JSX.Element {
  const isOnline = useIsOnline();

  return (
    <div
      class={`connection-status connection-status--${isOnline ? 'online' : 'offline'} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={isOnline ? 'Connected' : 'Offline'}
    >
      <span class="connection-status__indicator" aria-hidden="true" />
      {showLabel && (
        <span class="connection-status__label">{isOnline ? 'Connected' : 'Offline'}</span>
      )}
    </div>
  );
}

export interface ConnectionBadgeProps {
  offlineCount?: number;
  className?: string;
}

export function ConnectionBadge({
  offlineCount = 0,
  className = '',
}: ConnectionBadgeProps): JSX.Element {
  const isOnline = useIsOnline();

  if (isOnline) {return <></>;}

  return (
    <div class={`connection-badge ${className}`} role="alert" aria-live="polite">
      <span class="connection-badge__icon" aria-hidden="true">
        ⚠️
      </span>
      <span class="connection-badge__text">Offline</span>
      {offlineCount > 0 && (
        <span class="connection-badge__count" aria-label={`${offlineCount} pending actions`}>
          {offlineCount}
        </span>
      )}
    </div>
  );
}

export interface NetworkIndicatorProps {
  latency?: number;
  className?: string;
}

export function NetworkIndicator({ latency, className = '' }: NetworkIndicatorProps): JSX.Element {
  const isOnline = useIsOnline();

  let status: 'excellent' | 'good' | 'fair' | 'poor' | 'offline' = 'offline';
  if (isOnline) {
    if (latency === undefined) {
      status = 'good';
    } else if (latency < 50) {
      status = 'excellent';
    } else if (latency < 150) {
      status = 'good';
    } else if (latency < 300) {
      status = 'fair';
    } else {
      status = 'poor';
    }
  }

  return (
    <div
      class={`network-indicator network-indicator--${status} ${className}`}
      role="status"
      aria-label={`Network status: ${status}${latency ? `, ${latency}ms latency` : ''}`}
    >
      <span class="network-indicator__bar" aria-hidden="true" />
      <span class="network-indicator__bar" aria-hidden="true" />
      <span class="network-indicator__bar" aria-hidden="true" />
      <span class="network-indicator__bar" aria-hidden="true" />
    </div>
  );
}
