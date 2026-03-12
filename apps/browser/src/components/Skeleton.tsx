/**
 * Skeleton Loading Components
 * Placeholder UI while content loads
 */

import { h } from 'preact';

const styles = {
  skeleton: {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-loading 1.5s infinite',
    borderRadius: '4px',
  },
  skeletonText: {
    height: '16px',
    marginBottom: '8px',
  },
  skeletonTitle: {
    height: '24px',
    width: '60%',
    marginBottom: '12px',
  },
  skeletonAvatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    marginBottom: '12px',
  },
  skeletonCard: {
    padding: '16px',
    marginBottom: '16px',
    background: 'white',
    borderRadius: '8px',
  },
  skeletonMatch: {
    padding: '16px',
    marginBottom: '12px',
    background: 'white',
    borderRadius: '8px',
    border: '1px solid #e1e8ed',
  },
};

interface SkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'card' | 'match';
  width?: string;
  height?: string;
  lines?: number;
}

export function Skeleton({ variant = 'text', width, height, lines = 1 }: SkeletonProps) {
  const baseStyle = { ...styles.skeleton, ...styles[`skeleton${variant.charAt(0).toUpperCase() + variant.slice(1)}` as keyof typeof styles] };
  
  if (variant === 'text' && lines > 1) {
    return (
      <div>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              width: width || (i === lines - 1 ? '60%' : '100%'),
              height: height || '16px',
              marginBottom: i < lines - 1 ? '8px' : '0',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        width,
        height,
      }}
    />
  );
}

interface SkeletonPostProps {}

export function SkeletonPost({}: SkeletonPostProps) {
  return (
    <div style={styles.skeletonCard}>
      <div style={{ display: 'flex', marginBottom: '12px' }}>
        <Skeleton variant="avatar" />
        <div style={{ flex: 1, marginLeft: '12px' }}>
          <Skeleton variant="title" width="120px" height="18px" />
          <Skeleton variant="text" width="80px" height="14px" />
        </div>
      </div>
      <Skeleton variant="text" lines={3} />
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
        <Skeleton variant="text" width="60px" height="14px" />
        <Skeleton variant="text" width="60px" height="14px" />
        <Skeleton variant="text" width="60px" height="14px" />
      </div>
    </div>
  );
}

interface SkeletonMatchProps {}

export function SkeletonMatch({}: SkeletonMatchProps) {
  return (
    <div style={styles.skeletonMatch}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <Skeleton variant="title" width="100px" height="18px" />
        <Skeleton variant="text" width="60px" height="14px" />
      </div>
      <Skeleton variant="text" lines={2} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <Skeleton variant="text" width="80px" height="32px" />
        <Skeleton variant="text" width="80px" height="32px" />
      </div>
    </div>
  );
}

interface SkeletonConversationProps {}

export function SkeletonConversation({}: SkeletonConversationProps) {
  return (
    <div style={{ ...styles.skeletonCard, borderBottom: '1px solid #e1e8ed', borderRadius: 0 }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <Skeleton variant="avatar" />
        <div style={{ flex: 1 }}>
          <Skeleton variant="title" width="150px" height="18px" />
          <Skeleton variant="text" lines={1} />
        </div>
      </div>
    </div>
  );
}

// Add skeleton animation styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}
