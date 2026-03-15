/**
 * Video Calls Screen - Self-contained
 */

import { h } from 'preact';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#0f0f23' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #333', background: '#1a1a2e' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'white' } as const,
  newCallBtn: { padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, cursor: 'pointer' } as const,
  content: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '40px 20px' } as const,
  emptyState: { textAlign: 'center' as const, color: '#999' } as const,
  card: { background: '#1a1a2e', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', marginTop: '20px', border: '1px solid #333' } as const,
};

export function VideoCallScreen() {
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <h1 style={styles.title}>📹 Video Calls</h1>
        <button style={styles.newCallBtn}>+ New Call</button>
      </div>

      <div style={styles.content}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>📹</div>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', color: 'white' }}>No Active Calls</h2>
          <p style={{ margin: 0, fontSize: '14px' }}>
            Start a new video call to connect with peers.
          </p>
        </div>

        <div style={styles.card}>
          <h3 style={{ margin: '0 0 15px 0', color: '#3498db', fontSize: '16px' }}>🎥 Video Call Features</h3>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#999', lineHeight: 2 }}>
            <li>Peer-to-peer video calls</li>
            <li>End-to-end encrypted</li>
            <li>Group video calls supported</li>
            <li>Screen sharing capability</li>
            <li>Low-latency WebRTC</li>
          </ul>
        </div>

        <div style={{ ...styles.card, background: '#2c1a2e', borderColor: '#5c3390', marginTop: '16px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#bb8fce', fontSize: '16px' }}>🔐 Privacy First</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#999', lineHeight: 1.6 }}>
            All video calls are peer-to-peer and encrypted.
          </p>
        </div>
      </div>
    </div>
  );
}
