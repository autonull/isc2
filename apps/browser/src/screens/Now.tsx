/**
 * Now Screen - Main feed view
 * 
 * Shows the "For You" feed with posts from all channels.
 * Uses hooks for data fetching and state management.
 */

import { h, Fragment } from 'preact';
import { useNavigation } from '@isc/navigation';
import { useFeed, useActiveChannel } from '../hooks/index.js';
import { PostList } from '../components/PostList.js';
import { ComposePost } from '../components/ComposePost.js';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#f5f8fa' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white', position: 'sticky' as const, top: 0, zIndex: 100 } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  composeBtn: { padding: '8px 16px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' as const, cursor: 'pointer' } as const,
  content: { flex: 1, padding: '20px' } as const,
  card: { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  emptyState: { textAlign: 'center' as const, padding: '60px 20px', color: '#657786' } as const,
  loading: { textAlign: 'center' as const, padding: '40px 20px', color: '#657786' } as const,
  error: { textAlign: 'center' as const, padding: '40px 20px', color: '#e0245e', background: '#ffeef0', borderRadius: '12px' } as const,
};

export function NowScreen() {
  const { navigate } = useNavigation();
  const activeChannel = useActiveChannel();
  const { posts, loading, error, refresh } = useFeed('for-you');

  const handleComposeClick = () => {
    navigate({ name: 'compose', path: '/compose' });
  };

  const handleRefresh = () => {
    refresh();
  };

  if (loading) {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <h1 style={styles.title}>🏠 Now</h1>
          <button style={styles.composeBtn} onClick={handleComposeClick}>+ Post</button>
        </div>
        <div style={styles.loading}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <p>Loading your feed...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <h1 style={styles.title}>🏠 Now</h1>
          <button style={styles.composeBtn} onClick={handleComposeClick}>+ Post</button>
        </div>
        <div style={styles.content}>
          <div style={styles.error}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px 0' }}>Failed to load feed</h3>
            <p style={{ margin: 0 }}>{error}</p>
            <button 
              onClick={handleRefresh}
              style={{ marginTop: '16px', padding: '8px 16px', background: '#1da1f2', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.screen} data-testid="now-screen">
      <div style={styles.header}>
        <h1 style={styles.title}>🏠 Now</h1>
        <button style={styles.composeBtn} onClick={handleComposeClick}>+ Post</button>
      </div>

      <div style={styles.content}>
        {posts.length === 0 ? (
          <>
            <div style={styles.emptyState} data-testid="now-empty-state">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>No posts yet</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>
                Create a channel and start posting to see content here.
              </p>
            </div>

            <div style={{ ...styles.card, marginTop: '20px', background: '#e8f4fd' }} data-testid="now-how-it-works">
              <h4 style={{ margin: '0 0 10px 0', color: '#1da1f2' }}>💡 How Now Works</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#657786', lineHeight: 1.8 }}>
                <li>Create channels to define topics of interest</li>
                <li>Posts are semantically matched to your channels</li>
                <li>See content from users with similar interests</li>
                <li>Discover new perspectives and ideas</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <ComposePost channelId={activeChannel?.id} onSuccess={refresh} />
            <PostList posts={posts} onRefresh={refresh} />
          </>
        )}
      </div>
    </div>
  );
}
