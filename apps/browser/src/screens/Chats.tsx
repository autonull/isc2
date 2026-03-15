/**
 * Chats Screen - Self-contained
 */

import { h } from 'preact';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#f5f8fa' } as const,
  header: { padding: '16px 20px', borderBottom: '1px solid #e1e8ed', background: 'white' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#14171a' } as const,
  content: { flex: 1, display: 'flex', background: 'white', borderTop: '1px solid #e1e8ed' } as const,
  sidebar: { width: '320px', borderRight: '1px solid #e1e8ed', background: 'white' } as const,
  main: { flex: 1, display: 'flex', flexDirection: 'column' as const } as const,
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', color: '#657786', padding: '40px' } as const,
  card: { background: '#f7f9fa', borderRadius: '12px', padding: '20px', marginTop: '20px', maxWidth: '400px' } as const,
};

export function ChatsScreen() {
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>💬 Chats</h1>
      </div>

      <div style={styles.content}>
        <div style={styles.sidebar}>
          <div style={{ padding: '20px', color: '#657786', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>💭</div>
            <p style={{ fontSize: '14px' }}>No conversations yet</p>
          </div>
        </div>

        <div style={styles.main}>
          <div style={styles.emptyState}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>💬</div>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#14171a' }}>Select a Conversation</h2>
            <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>
              Choose a conversation from the sidebar or start a new one from Discover.
            </p>

            <div style={styles.card}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1da1f2', fontSize: '14px' }}>🔐 Encrypted Messaging</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#657786', lineHeight: 1.8 }}>
                <li>End-to-end encrypted messages</li>
                <li>Peer-to-peer via WebRTC</li>
                <li>No central server storage</li>
                <li>Real-time typing indicators</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
