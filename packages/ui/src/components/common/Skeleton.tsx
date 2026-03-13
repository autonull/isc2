/**
 * Skeleton Component
 *
 * Loading placeholder component with multiple variants.
 */

import { h, JSX } from 'preact';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'post' | 'avatar';
  width?: string | number;
  height?: string | number;
  className?: string;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
  animation = 'pulse',
}: SkeletonProps): JSX.Element {
  const style: JSX.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      class={`skeleton skeleton--${variant} skeleton--${animation} ${className}`}
      style={style}
      aria-label="Loading"
      role="progressbar"
      aria-busy="true"
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  className?: string;
}

export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  className = '',
}: SkeletonTextProps): JSX.Element {
  return (
    <div class={`skeleton-text ${className}`} role="progressbar" aria-label="Loading text">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={lineHeight}
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}

export interface SkeletonPostProps {
  className?: string;
}

export function SkeletonPost({ className = '' }: SkeletonPostProps): JSX.Element {
  return (
    <div class={`skeleton-post ${className}`} role="progressbar" aria-label="Loading post">
      <div class="skeleton-post__header">
        <Skeleton variant="circular" width={48} height={48} />
        <div class="skeleton-post__meta">
          <Skeleton variant="text" height={16} width={120} />
          <Skeleton variant="text" height={12} width={80} />
        </div>
      </div>
      <div class="skeleton-post__content">
        <Skeleton variant="text" height={16} />
        <Skeleton variant="text" height={16} width="80%" />
        <Skeleton variant="text" height={16} width="60%" />
      </div>
    </div>
  );
}

export interface SkeletonFeedProps {
  count?: number;
  className?: string;
}

export function SkeletonFeed({ count = 5, className = '' }: SkeletonFeedProps): JSX.Element {
  return (
    <div class={`skeleton-feed ${className}`} role="progressbar" aria-label="Loading feed">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPost key={i} />
      ))}
    </div>
  );
}

export interface SkeletonAvatarProps {
  size?: number;
  className?: string;
}

export function SkeletonAvatar({ size = 48, className = '' }: SkeletonAvatarProps): JSX.Element {
  return (
    <Skeleton
      variant="circular"
      width={size}
      height={size}
      className={`skeleton-avatar ${className}`}
    />
  );
}

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps): JSX.Element {
  return (
    <div class={`skeleton-card ${className}`} role="progressbar" aria-label="Loading card">
      <Skeleton variant="rectangular" height={200} />
      <div class="skeleton-card__content">
        <Skeleton variant="text" height={20} width="70%" />
        <Skeleton variant="text" height={14} />
        <Skeleton variant="text" height={14} width="80%" />
      </div>
    </div>
  );
}
