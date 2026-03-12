import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { subscribeToConnectionChanges, type ConnectionStatus } from '../offline/connection.js';

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; bg: string; color: string; dotColor: string }> = {
  online: { label: 'Online', bg: '#e8f5e9', color: '#2e7d32', dotColor: '#4caf50' },
  offline: { label: 'Offline', bg: '#ffebee', color: '#c62828', dotColor: '#f44336' },
  slow: { label: 'Slow Connection', bg: '#fff3e0', color: '#ef6c00', dotColor: '#ff9800' },
};

export function ConnectionStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>('online');

  useEffect(() => {
    const unsubscribe = subscribeToConnectionChanges((info) => setStatus(info.status));
    return unsubscribe;
  }, []);

  const config = STATUS_CONFIG[status];

  return (
    <div class="connection-status" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 500, background: config.bg, color: config.color }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: config.dotColor }} />
      <span>{config.label}</span>
    </div>
  );
}
