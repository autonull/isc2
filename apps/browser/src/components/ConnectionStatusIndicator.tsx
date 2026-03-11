/**
 * Connection Status Indicator
 * 
 * Shows current connection status (online/offline/slow).
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { subscribeToConnectionChanges, type ConnectionStatus } from '../offline/connection.js';

const styles = {
  indicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500,
  },
  online: {
    background: '#e8f5e9',
    color: '#2e7d32',
  },
  offline: {
    background: '#ffebee',
    color: '#c62828',
  },
  slow: {
    background: '#fff3e0',
    color: '#ef6c00',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
};

export function ConnectionStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('online');

  useEffect(() => {
    const unsubscribe = subscribeToConnectionChanges((info) => {
      setStatus(info.status);
    });

    return unsubscribe;
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          label: 'Online',
          style: styles.online,
          dotColor: '#4caf50',
        };
      case 'offline':
        return {
          label: 'Offline',
          style: styles.offline,
          dotColor: '#f44336',
        };
      case 'slow':
        return {
          label: 'Slow Connection',
          style: styles.slow,
          dotColor: '#ff9800',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div class="connection-status" style={{ ...styles.indicator, ...config.style }}>
      <span
        style={{
          ...styles.dot,
          background: config.dotColor,
        }}
      />
      <span>{config.label}</span>
    </div>
  );
}
