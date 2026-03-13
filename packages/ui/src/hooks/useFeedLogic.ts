/**
 * useFeedLogic Hook
 *
 * Headless feed logic with loading, error, and pagination state.
 */

import { useState, useEffect, useCallback } from 'preact/hooks';
import type { SignedPost } from '@isc/core';
import { getForYouFeed, getFollowingFeed } from '@isc/core';

/**
 * Feed logic options
 */
export interface UseFeedLogicOptions {
  type: 'for-you' | 'following';
  limit?: number;
  pullToRefresh?: boolean;
}

/**
 * Feed logic return type
 */
export interface UseFeedLogicReturn {
  posts: SignedPost[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  cursor?: string;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Use feed logic hook
 */
export function useFeedLogic({
  type,
  limit = 50,
  pullToRefresh = false,
}: UseFeedLogicOptions): UseFeedLogicReturn {
  const [posts, setPosts] = useState<SignedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string>();

  const fetchPosts = useCallback(
    async (isRefresh = false): Promise<void> => {
      try {
        setLoading(true);
        setError(null);

        const fetched =
          type === 'following'
            ? await getFollowingFeed(limit)
            : await getForYouFeed(limit);

        setPosts(isRefresh ? fetched : [...posts, ...fetched]);
        setHasMore(fetched.length === limit);
        if (fetched.length > 0) {
          setCursor(fetched[fetched.length - 1]?.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    },
    [type, limit, posts]
  );

  const refresh = useCallback(async (): Promise<void> => {
    await fetchPosts(true);
  }, [fetchPosts]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore) return;
    await fetchPosts(false);
  }, [fetchPosts, hasMore]);

  useEffect(() => {
    fetchPosts();
  }, [type]);

  return { posts, loading, error, hasMore, cursor, refresh, loadMore };
}
