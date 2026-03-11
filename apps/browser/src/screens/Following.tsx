/**
 * Following Screen
 * 
 * Shows posts from followed users.
 */

import { h } from 'preact';
import { Feed } from '../components/Feed.js';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%' } as const,
  header: { padding: '16px', borderBottom: '1px solid #e1e8ed', position: 'sticky' as const, top: 0, background: 'white', zIndex: 100 } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0 } as const,
};

export function FollowingScreen() {
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>Following</h1>
      </div>
      
      <Feed type="following" />
    </div>
  );
}
