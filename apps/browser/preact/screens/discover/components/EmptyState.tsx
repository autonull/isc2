/**
 * Empty State Component
 */

import { h } from 'preact';
import { discoverStyles as styles } from '../styles/Discover.css.js';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    primary?: boolean;
  }>;
}

export function EmptyState({
  icon = '🔍',
  title,
  message,
  actions = [],
}: EmptyStateProps) {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '14px', color: '#657786' }}>{message}</p>
      {actions.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            marginTop: '16px',
          }}
        >
          {actions.map((action, index) => (
            <button
              key={index}
              style={{
                ...styles.refreshBtn,
                margin: 0,
                background: action.primary ? '#1da1f2' : '#f7f9fa',
                color: action.primary ? 'white' : '#657786',
              }}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
