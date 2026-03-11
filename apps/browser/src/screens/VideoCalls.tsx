/**
 * Video Call Screen
 * 
 * Main screen for video calls with participant management.
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { VideoCallUI } from '../components/VideoCallUI.js';
import {
  createVideoCall,
  joinVideoCall,
  getVideoCall,
  getActiveVideoCalls,
  handleVideoCallMessage,
} from '../video/handler.js';
import type { VideoCall } from '../video/types.js';
import { getPeerID } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    background: '#0f0f23',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    background: '#1a1a2e',
    borderBottom: '1px solid #333',
  },
  title: {
    color: 'white',
    fontSize: '20px',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  callList: {
    width: '100%',
    maxWidth: '600px',
  },
  callCard: {
    background: '#1a1a2e',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  callInfo: {
    flex: 1,
  },
  callType: {
    color: '#3498db',
    fontSize: '14px',
    fontWeight: 500,
    textTransform: 'uppercase' as const,
  },
  callParticipants: {
    color: '#999',
    fontSize: '14px',
    marginTop: '4px',
  },
  joinButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  newCallButton: {
    background: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 500,
    marginTop: '16px',
  },
  modal: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1001,
  },
  modalContent: {
    background: '#1a1a2e',
    borderRadius: '12px',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
  },
  modalTitle: {
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#16213e',
    color: 'white',
    fontSize: '14px',
    marginBottom: '16px',
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    background: 'transparent',
    color: '#999',
    border: '1px solid #333',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  createButton: {
    background: '#27ae60',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};

export function VideoCallScreen() {
  const [activeCalls, setActiveCalls] = useState<VideoCall[]>([]);
  const [currentCall, setCurrentCall] = useState<VideoCall | null>(null);
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [callType, setCallType] = useState<'direct' | 'group'>('direct');
  const [recipient, setRecipient] = useState('');
  const [channelID, setChannelID] = useState('');

  useEffect(() => {
    // Load active calls
    setActiveCalls(getActiveVideoCalls());

    // Listen for incoming call messages
    const client = DelegationClient.getInstance();
    if (client) {
      // In a real implementation, we'd subscribe to video call messages
      // For now, just poll for active calls
      const interval = setInterval(() => {
        setActiveCalls(getActiveVideoCalls());
      }, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleNewCall = async () => {
    try {
      const call = await createVideoCall(
        callType,
        callType === 'direct' ? recipient : undefined,
        callType === 'group' ? channelID : undefined
      );
      setCurrentCall(call);
      setShowNewCallModal(false);
    } catch (err) {
      console.error('Failed to create call:', err);
      alert('Failed to create call: ' + (err as Error).message);
    }
  };

  const handleJoinCall = async (callID: string) => {
    try {
      const call = await joinVideoCall(callID);
      setCurrentCall(call);
    } catch (err) {
      console.error('Failed to join call:', err);
      alert('Failed to join call: ' + (err as Error).message);
    }
  };

  const handleEndCall = () => {
    setCurrentCall(null);
    setActiveCalls(getActiveVideoCalls());
  };

  if (currentCall) {
    return <VideoCallUI call={currentCall} onEnd={handleEndCall} />;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Video Calls</h1>
        <button style={styles.newCallButton} onClick={() => setShowNewCallModal(true)}>
          + New Call
        </button>
      </header>

      <div style={styles.content}>
        <div style={styles.callList}>
          {activeCalls.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#666', padding: '48px' }}>
              <p style={{ fontSize: '18px', marginBottom: '8px' }}>No active calls</p>
              <p style={{ fontSize: '14px' }}>Start a new call or join an existing one</p>
            </div>
          ) : (
            activeCalls.map((call) => (
              <div
                key={call.callID}
                style={styles.callCard}
                onClick={() => handleJoinCall(call.callID)}
              >
                <div style={styles.callInfo}>
                  <div style={styles.callType}>{call.type} Call</div>
                  <div style={styles.callParticipants}>
                    {call.participants.length} participant{call.participants.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <button style={styles.joinButton}>Join</button>
              </div>
            ))
          )}
        </div>
      </div>

      {showNewCallModal && (
        <div style={styles.modal} onClick={() => setShowNewCallModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>New Video Call</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#999', display: 'block', marginBottom: '8px' }}>
                Call Type
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  style={{
                    ...styles.joinButton,
                    background: callType === 'direct' ? '#3498db' : '#333',
                  }}
                  onClick={() => setCallType('direct')}
                >
                  Direct
                </button>
                <button
                  style={{
                    ...styles.joinButton,
                    background: callType === 'group' ? '#3498db' : '#333',
                  }}
                  onClick={() => setCallType('group')}
                >
                  Group
                </button>
              </div>
            </div>

            {callType === 'direct' ? (
              <div>
                <label style={{ color: '#999', display: 'block', marginBottom: '8px' }}>
                  Recipient Peer ID
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={recipient}
                  onChange={(e) => setRecipient((e.target as HTMLInputElement).value)}
                  placeholder="Enter peer ID..."
                />
              </div>
            ) : (
              <div>
                <label style={{ color: '#999', display: 'block', marginBottom: '8px' }}>
                  Channel ID
                </label>
                <input
                  type="text"
                  style={styles.input}
                  value={channelID}
                  onChange={(e) => setChannelID((e.target as HTMLInputElement).value)}
                  placeholder="Enter channel ID..."
                />
              </div>
            )}

            <div style={styles.modalButtons}>
              <button style={styles.cancelButton} onClick={() => setShowNewCallModal(false)}>
                Cancel
              </button>
              <button style={styles.createButton} onClick={handleNewCall}>
                {callType === 'direct' ? 'Call' : 'Start Group Call'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
