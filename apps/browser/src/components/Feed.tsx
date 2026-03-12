import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { SignedPost } from '../social/types.js';
import { Post } from './Post.js';
import { getForYouFeed, getFollowingFeed, refreshFeed } from '../social/index.js';
import { SkeletonPost } from './Skeleton.js';

type FeedType = 'for-you' | 'following';

interface FeedProps {
  type?: FeedType;
  channelID?: string;
  limit?: number;
}

const styles = {
  feed: { display: 'flex', flexDirection: 'column' as const } as const,
  loading: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '48px 16px' } as const,
  error: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '48px 16px', textAlign: 'center' as const } as const,
  retryBtn: { marginTop: '16px', padding: '8px 24px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } as const,
  empty: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '48px 16px', textAlign: 'center' as const, color: '#657786' } as const,
  emptySub: { fontSize: '14px', marginTop: '8px' } as const,
  refreshing: { display: 'flex', justifyContent: 'center', padding: '16px' } as const,
  spinner: { width: '24px', height: '24px', border: '3px solid #e1e8ed', borderTopColor: '#1da1f2', borderRadius: '50%', animation: 'spin 1s linear infinite' } as const,
};

export function Feed({ type = 'for-you', channelID, limit = 50 }: FeedProps) {
  const [posts, setPosts] = useState<SignedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetched = type === 'following' ? await getFollowingFeed(limit) : await getForYouFeed(limit);
      setPosts(fetched);
    } catch {
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [type, limit]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshFeed(channelID);
      await loadPosts();
    } catch {
      console.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [loadPosts, channelID]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    let startY = 0;
    let currentY = 0;
    const handleTouchStart = (e: TouchEvent) => { if (window.scrollY === 0) startY = e.touches[0].clientY; };
    const handleTouchMove = (e: TouchEvent) => {
      if (startY > 0) {
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 100 && !refreshing) handleRefresh();
        startY = 0;
        currentY = 0;
      }
    };
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleRefresh, refreshing]);

  if (loading) {
    return (
      <div style={styles.feed}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonPost key={i} />
        ))}
      </div>
    );
  }
  if (error) return <div style={styles.error}><p>{error}</p><button onClick={loadPosts} style={styles.retryBtn}>Retry</button></div>;
  if (posts.length === 0) return (
    <div style={styles.empty}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
      <p>No posts yet</p>
      <p style={styles.emptySub}>Share your thoughts with the network!</p>
      <button 
        style={{ ...styles.retryBtn, marginTop: '16px' }} 
        onClick={() => import('../router.js').then(({ navigate }) => navigate('compose'))}
      >
        Create Channel
      </button>
    </div>
  );

  return (
    <div style={styles.feed}>
      {refreshing && <div style={styles.refreshing}><div style={styles.spinner}></div></div>}
      {posts.map((post) => <Post key={post.id} post={post} />)}
    </div>
  );
}

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
