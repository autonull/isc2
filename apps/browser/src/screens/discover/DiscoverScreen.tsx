/**
 * Discover Screen - Self-contained
 */

import { h } from 'preact';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#f5f8fa' } as const,
  header: { padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  content: { flex: 1, padding: '20px' } as const,
  card: { background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } as const,
  emptyState: { textAlign: 'center' as const, padding: '60px 20px', color: '#657786' } as const,
};

export function DiscoverScreen() {
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>📡 Discover</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Discover Nearby Peers</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px' }}>
            Find and connect with users who have similar interests.
          </p>
        </div>

        <div style={styles.card}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1da1f2' }}>🎯 How Discovery Works</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#657786', lineHeight: 2 }}>
            <li>Create channels with detailed descriptions</li>
            <li>Semantic matching finds similar channels</li>
            <li>LSH hashing enables efficient peer discovery</li>
            <li>Connect directly via P2P network</li>
          </ul>
        </div>

        <div style={{ ...styles.card, background: '#fff3cd' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚠️ Getting Started</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#856404' }}>
            Create a channel first to start discovering peers.
          </p>
        </div>
      </div>
    </div>
  );
}
