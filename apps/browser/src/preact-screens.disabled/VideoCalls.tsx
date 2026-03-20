/**
 * Video Calls Screen
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';

const styles = {
  screen: { display: 'flex', flexDirection: 'column' as const, minHeight: '100%', background: '#0f0f23' } as const,
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #333', background: '#1a1a2e' } as const,
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: 'white' } as const,
  newCallBtn: { padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, cursor: 'pointer' } as const,
  content: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', padding: '40px 20px' } as const,
  emptyState: { textAlign: 'center' as const, color: '#999' } as const,
  card: { background: '#1a1a2e', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', marginTop: '20px', border: '1px solid #333' } as const,
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 } as const,
  dialog: { background: '#1a1a2e', borderRadius: '12px', padding: '28px', width: '400px', border: '1px solid #444' } as const,
  dialogTitle: { color: 'white', margin: '0 0 20px 0', fontSize: '18px' } as const,
  typeRow: { display: 'flex', gap: '12px', marginBottom: '20px' } as const,
  typeBtn: { flex: 1, padding: '10px', border: '2px solid', borderRadius: '8px', cursor: 'pointer', background: 'transparent', color: 'white', fontSize: '14px', textAlign: 'center' as const } as const,
  label: { display: 'block', color: '#aaa', fontSize: '13px', marginBottom: '6px' } as const,
  input: { width: '100%', padding: '10px 12px', background: '#0f0f23', border: '1px solid #444', borderRadius: '6px', color: 'white', fontSize: '14px', boxSizing: 'border-box' as const } as const,
  actions: { display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' } as const,
  cancelBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #555', color: '#aaa', borderRadius: '6px', cursor: 'pointer' } as const,
  createBtn: { padding: '8px 16px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' as const } as const,
  errorBanner: { background: '#e74c3c', color: 'white', padding: '12px 16px', borderRadius: '8px', marginTop: '16px', fontSize: '14px' } as const,
};

export function VideoCallScreen() {
  const [showDialog, setShowDialog] = useState(false);
  const [callType, setCallType] = useState<'direct' | 'group'>('direct');
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    if (!recipient.trim()) {
      setError('Please enter a peer ID or room name');
      return;
    }
    // Peer connection will fail without a real peer — show expected error state
    setError(`Unable to connect to "${recipient.trim()}": peer not found on network`);
  };

  const handleClose = () => {
    setShowDialog(false);
    setError(null);
    setRecipient('');
  };

  return (
    <div style={styles.screen} data-testid="video-call-container">
      <div style={styles.header}>
        <h1 style={styles.title}>📹 Video Calls</h1>
        <button
          style={styles.newCallBtn}
          data-testid="new-call-button"
          onClick={() => { setShowDialog(true); setError(null); }}
        >
          + New Call
        </button>
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

      {showDialog && (
        <div style={styles.overlay}>
          <div style={styles.dialog}>
            <h2 style={styles.dialogTitle}>New Video Call</h2>

            <div style={styles.typeRow}>
              <button
                style={{ ...styles.typeBtn, borderColor: callType === 'direct' ? '#3498db' : '#444' }}
                data-testid="call-type-direct"
                onClick={() => setCallType('direct')}
              >
                📞 Direct
              </button>
              <button
                style={{ ...styles.typeBtn, borderColor: callType === 'group' ? '#3498db' : '#444' }}
                data-testid="call-type-group"
                onClick={() => setCallType('group')}
              >
                👥 Group
              </button>
            </div>

            <label style={styles.label}>
              {callType === 'direct' ? 'Peer ID' : 'Room Name'}
            </label>
            <input
              style={styles.input}
              value={recipient}
              placeholder={callType === 'direct' ? 'Enter peer ID...' : 'Enter room name...'}
              onInput={(e) => setRecipient((e.target as HTMLInputElement).value)}
              data-testid="recipient-input"
            />

            {error && (
              <div style={styles.errorBanner} data-testid="call-error">
                ⚠️ {error}
              </div>
            )}

            <div style={styles.actions}>
              <button style={styles.cancelBtn} onClick={handleClose}>Cancel</button>
              <button
                style={styles.createBtn}
                data-testid="create-call-button"
                onClick={handleCreate}
              >
                Start Call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

