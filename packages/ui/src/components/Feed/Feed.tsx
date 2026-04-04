/**
 * Feed Component
 *
 * Headless feed component with logic.
 */

import type { JSX } from 'preact';
import { h } from 'preact';
import type { SignedPost } from '@isc/core';

/**
 * Feed props
 */
export interface FeedProps {
  posts: SignedPost[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onPostClick?: (post: SignedPost) => void;
  onLike?: (post: SignedPost) => void;
  onReply?: (post: SignedPost) => void;
  onRepost?: (post: SignedPost) => void;
  emptyMessage?: string;
  loadingMessage?: string;
}

/**
 * Feed loading component
 */
export function FeedLoading({ message = 'Loading...' }: { message?: string }): JSX.Element {
  return h(
    'div',
    { class: 'isc-feed__loading', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'isc-feed__spinner' }),
    h('p', null, message)
  );
}

/**
 * Feed error component
 */
export function FeedError({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}): JSX.Element {
  return h(
    'div',
    { class: 'isc-feed__error', role: 'alert' },
    h('p', null, error),
    h(
      'button',
      {
        class: 'isc-feed__retry',
        onClick: onRetry,
      },
      'Retry'
    )
  );
}

/**
 * Feed empty component
 */
export function FeedEmpty({
  message = 'No posts yet',
  onRefresh,
}: {
  message?: string;
  onRefresh?: () => void;
}): JSX.Element {
  return h(
    'div',
    { class: 'isc-feed__empty' },
    h('p', null, message),
    onRefresh
      ? h(
          'button',
          {
            class: 'isc-feed__refresh',
            onClick: onRefresh,
          },
          'Refresh'
        )
      : null
  );
}

/**
 * Feed item component
 */
export function FeedItem({
  post,
  onClick,
  onLike,
  onReply,
  onRepost,
}: {
  post: SignedPost;
  onClick?: () => void;
  onLike?: () => void;
  onReply?: () => void;
  onRepost?: () => void;
}): JSX.Element {
  return h(
    'article',
    {
      class: 'isc-feed__item',
      onClick,
      role: 'article',
      'aria-label': `Post by ${post.author}`,
    },
    h('div', { class: 'isc-feed__item-header' }, post.author),
    h('div', { class: 'isc-feed__item-content' }, post.content),
    h(
      'div',
      { class: 'isc-feed__item-actions' },
      h(
        'button',
        {
          class: 'isc-feed__action',
          onClick: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onLike?.();
          },
          'aria-label': 'Like',
        },
        'Like'
      ),
      h(
        'button',
        {
          class: 'isc-feed__action',
          onClick: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onReply?.();
          },
          'aria-label': 'Reply',
        },
        'Reply'
      ),
      h(
        'button',
        {
          class: 'isc-feed__action',
          onClick: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onRepost?.();
          },
          'aria-label': 'Repost',
        },
        'Repost'
      )
    )
  );
}

/**
 * Main feed component
 */
export function Feed({
  posts,
  loading,
  error,
  onRefresh,
  onPostClick,
  onLike,
  onReply,
  onRepost,
  emptyMessage,
  loadingMessage,
}: FeedProps): JSX.Element {
  if (loading) {
    return h(FeedLoading, { message: loadingMessage });
  }

  if (error) {
    return h(FeedError, { error, onRetry: onRefresh });
  }

  if (posts.length === 0) {
    return h(FeedEmpty, { message: emptyMessage, onRefresh });
  }

  return h(
    'div',
    {
      class: 'isc-feed',
      role: 'feed',
      'aria-label': 'Posts feed',
    },
    posts.map((post) =>
      h(FeedItem, {
        key: post.id,
        post,
        onClick: () => onPostClick?.(post),
        onLike: () => onLike?.(post),
        onReply: () => onReply?.(post),
        onRepost: () => onRepost?.(post),
      })
    )
  );
}
