/**
 * useFeed Hook
 *
 * Feed management with loading and error states.
 */

import { useCallback, useMemo } from 'preact/hooks';
import type { AppState } from '@isc/state';
import type { SignedPost } from '@isc/core';
import { useAppState } from './useAppState.js';

/**
 * Feed options
 */
export interface FeedOptions {
  limit?: number;
  cursor?: string;
}

/**
 * Feed return type
 */
export interface UseFeedReturn {
  posts: SignedPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor?: string;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Use feed hook
 */
export function useFeed(type: 'for-you' | 'following', options?: FeedOptions): UseFeedReturn {
  const feedState = useAppState((state: AppState) => state.feeds[type]);
  const postsMap = useAppState((state: AppState) => state.posts);

  const posts = useMemo(() => {
    return feedState.posts
      .map((id) => postsMap.get(id))
      .filter((p): p is SignedPost => p !== undefined);
  }, [feedState.posts, postsMap]);

  const refresh = useCallback(async () => {
    // Action dispatch would be handled by store
  }, [type, options]);

  const loadMore = useCallback(async () => {
    if (!feedState.hasMore) return;
  }, [type, feedState.hasMore, feedState.cursor]);

  return {
    posts,
    loading: feedState.loading,
    error: feedState.error,
    hasMore: feedState.hasMore,
    cursor: feedState.cursor,
    refresh,
    loadMore,
  };
}
