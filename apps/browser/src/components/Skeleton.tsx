/**
 * Skeleton Loader Components
 * 
 * Placeholder UI shown while content loads.
 * Improves perceived performance and reduces layout shift.
 */

import { h } from 'preact';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  animation?: 'pulse' | 'wave' | 'none';
  style?: any;
}

const baseStyles = {
  skeleton: {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
  },
  pulse: {
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  },
  wave: {
    animation: 'skeleton-wave 1.5s ease-in-out infinite',
  },
};

const variants = {
  text: {
    height: '16px',
    borderRadius: '4px',
  },
  circular: {
    borderRadius: '50%',
  },
  rectangular: {
    borderRadius: '0',
  },
  rounded: {
    borderRadius: '8px',
  },
};

export function Skeleton({ 
  width, 
  height = '16px', 
  borderRadius, 
  variant = 'text', 
  animation = 'pulse',
  style 
}: SkeletonProps) {
  const skeletonStyle = {
    ...baseStyles.skeleton,
    ...(animation !== 'none' ? baseStyles[animation] : {}),
    ...variants[variant],
    width: width || '100%',
    height,
    borderRadius: borderRadius ?? variants[variant].borderRadius,
    ...style,
  };

  return <div style={skeletonStyle} aria-hidden="true" />;
}

/**
 * Post Card Skeleton
 */
export function PostSkeleton() {
  return (
    <div 
      style={{ 
        padding: '16px', 
        background: 'white', 
        borderRadius: '12px', 
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}
    >
      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <Skeleton variant="circular" width="40px" height="40px" style={{ marginRight: '12px' }} />
        <div style={{ flex: 1 }}>
          <Skeleton width="120px" style={{ marginBottom: '4px' }} />
          <Skeleton width="80px" height="12px" />
        </div>
      </div>
      
      {/* Content */}
      <Skeleton height="16px" style={{ marginBottom: '8px' }} />
      <Skeleton height="16px" style={{ marginBottom: '8px' }} />
      <Skeleton height="16px" width="60%" />
      
      {/* Actions */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
        <Skeleton width="60px" height="32px" variant="rounded" />
        <Skeleton width="60px" height="32px" variant="rounded" />
        <Skeleton width="60px" height="32px" variant="rounded" />
      </div>
    </div>
  );
}

/**
 * Peer Card Skeleton
 */
export function PeerSkeleton() {
  return (
    <div 
      style={{ 
        padding: '16px', 
        background: 'white', 
        borderRadius: '12px', 
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Skeleton variant="circular" width="48px" height="48px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="140px" style={{ marginBottom: '8px' }} />
          <Skeleton height="14px" width="100%" style={{ marginBottom: '4px' }} />
          <Skeleton height="14px" width="80%" style={{ marginBottom: '12px' }} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <Skeleton width="60px" height="24px" variant="rounded" />
            <Skeleton width="80px" height="24px" variant="rounded" />
          </div>
          <Skeleton width="100px" height="36px" variant="rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Channel List Skeleton
 */
export function ChannelListSkeleton() {
  return (
    <div style={{ padding: '8px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div 
          key={i} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '12px', 
            marginBottom: '4px',
            borderRadius: '8px'
          }}
        >
          <Skeleton variant="circular" width="32px" height="32px" style={{ marginRight: '12px' }} />
          <Skeleton width="120px" />
        </div>
      ))}
    </div>
  );
}

/**
 * Feed Skeleton (multiple posts)
 */
export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </>
  );
}

/**
 * Peer List Skeleton (multiple peers)
 */
export function PeerListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <PeerSkeleton key={i} />
      ))}
    </>
  );
}

/**
 * Settings Section Skeleton
 */
export function SettingsSectionSkeleton() {
  return (
    <div 
      style={{ 
        padding: '20px', 
        background: 'white', 
        borderRadius: '12px', 
        marginBottom: '16px'
      }}
    >
      <Skeleton width="160px" height="20px" style={{ marginBottom: '16px' }} />
      <div style={{ marginBottom: '16px' }}>
        <Skeleton width="100px" height="14px" style={{ marginBottom: '8px' }} />
        <Skeleton height="40px" />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <Skeleton width="100px" height="14px" style={{ marginBottom: '8px' }} />
        <Skeleton height="80px" />
      </div>
      <Skeleton width="120px" height="40px" variant="rounded" />
    </div>
  );
}

/**
 * Full Page Loading Skeleton
 */
export function PageSkeleton() {
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <Skeleton width="200px" height="32px" />
        <Skeleton width="100px" height="40px" variant="rounded" />
      </div>
      
      {/* Content */}
      <FeedSkeleton count={3} />
    </div>
  );
}

// CSS Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes skeleton-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes skeleton-wave {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;
document.head.appendChild(styleSheet);
