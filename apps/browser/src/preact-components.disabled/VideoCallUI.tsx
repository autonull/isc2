import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { VideoCall, VideoParticipant, VideoCallStats } from '../video/types.js';
import { leaveVideoCall, toggleMute, toggleVideo, startScreenShare, stopScreenShare, getCallStats } from '../video/handler.js';
import type { VideoCallError } from '../video/handler.js';

const styles = {
  container: { position: 'fixed' as const, inset: 0, background: '#1a1a2e', zIndex: 1000, display: 'flex', flexDirection: 'column' as const } as const,
  videoGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px', padding: '16px', overflow: 'auto' } as const,
  videoTile: { position: 'relative' as const, background: '#16213e', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9' } as const,
  video: { width: '100%', height: '100%', objectFit: 'cover' as const } as const,
  participantName: { position: 'absolute' as const, bottom: '8px', left: '8px', color: 'white', fontSize: '14px', fontWeight: 500, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px' } as const,
  statusIcons: { position: 'absolute' as const, top: '8px', right: '8px', display: 'flex', gap: '4px' } as const,
  statusIcon: { background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' } as const,
  controls: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '16px', background: 'rgba(0,0,0,0.8)' } as const,
  controlButton: { width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', transition: 'transform 0.2s' } as const,
  controlButtonActive: { background: '#e74c3c', color: 'white' } as const,
  controlButtonInactive: { background: '#34495e', color: 'white' } as const,
  endCallButton: { background: '#e74c3c', color: 'white' } as const,
  screenShareButton: { background: '#3498db', color: 'white' } as const,
  participantCount: { position: 'absolute' as const, top: '16px', left: '16px', color: 'white', fontSize: '14px', background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: '8px' } as const,
  callDuration: { position: 'absolute' as const, top: '16px', right: '16px', color: 'white', fontSize: '14px', background: 'rgba(0,0,0,0.6)', padding: '8px 12px', borderRadius: '8px' } as const,
  errorBanner: { background: '#e74c3c', color: 'white', padding: '12px 16px', textAlign: 'center' as const, fontSize: '14px' } as const,
  connectionWarning: { background: '#f39c12', color: 'white', padding: '8px 16px', textAlign: 'center' as const, fontSize: '12px' } as const,
};

interface VideoCallUIProps {
  call: VideoCall;
  onEnd?: () => void;
}

export function VideoCallUI({ call, onEnd }: VideoCallUIProps) {
  const [participants, setParticipants] = useState<VideoParticipant[]>(call.participants);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => setDuration(Math.floor((Date.now() - call.createdAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [call.createdAt]);

  useEffect(() => { setParticipants(call.participants); }, [call.participants]);

  // Monitor connection quality
  useEffect(() => {
    const updateConnectionQuality = () => {
      if (!navigator.onLine) {
        setConnectionQuality('offline');
      } else {
        setConnectionQuality('good');
      }
    };

    updateConnectionQuality();
    window.addEventListener('online', updateConnectionQuality);
    window.addEventListener('offline', updateConnectionQuality);

    return () => {
      window.removeEventListener('online', updateConnectionQuality);
      window.removeEventListener('offline', updateConnectionQuality);
    };
  }, []);

  const handleMute = async () => {
    try {
      const muted = await toggleMute(call.callID);
      setIsMuted(muted);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleVideo = async () => {
    try {
      const off = await toggleVideo(call.callID);
      setIsVideoOff(off);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await stopScreenShare(call.callID);
        setIsScreenSharing(false);
      } else {
        await startScreenShare(call.callID);
        setIsScreenSharing(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start screen sharing';
      setError(errorMessage);
    }
  };

  const handleEnd = async () => {
    try {
      await leaveVideoCall(call.callID);
      onEnd?.();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const dismissError = () => setError(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container} data-testid="video-call-container">
      {error && (
        <div style={styles.errorBanner} data-testid="call-error">
          ⚠️ {error}
          <button
            onClick={dismissError}
            style={{ marginLeft: '12px', background: 'transparent', border: '1px solid white', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {connectionQuality === 'offline' && (
        <div style={styles.connectionWarning}>
          📡 You're offline. Call controls will work locally but won't reach other participants.
        </div>
      )}

      <div style={styles.participantCount} data-testid="participant-count">
        {participants.length} / {call.maxParticipants} participants
      </div>
      <div style={styles.callDuration} data-testid="call-duration">
        {formatDuration(duration)}
      </div>

      <div style={styles.videoGrid}>
        {participants.map((participant) => (
          <div
            key={participant.peerID}
            style={styles.videoTile}
            data-testid="video-tile"
          >
            <VideoElement
              stream={participant.stream}
              isLocal={participant.peerID === call.initiator}
              dataTestId={participant.peerID === call.initiator ? 'local-video' : 'remote-video'}
            />
            <div style={styles.participantName}>
              {participant.peerID.slice(0, 8)}...
            </div>
            <div style={styles.statusIcons}>
              {participant.isMuted && (
                <span style={styles.statusIcon} title="Muted">🔇</span>
              )}
              {participant.isVideoOff && (
                <span style={styles.statusIcon} title="Video off">📷</span>
              )}
              {participant.isScreenSharing && (
                <span style={styles.statusIcon} title="Screen sharing">🖥️</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.controls}>
        <button
          style={{
            ...styles.controlButton,
            ...(isMuted ? styles.controlButtonActive : styles.controlButtonInactive),
          }}
          onClick={handleMute}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
          data-testid="mute-button"
        >
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button
          style={{
            ...styles.controlButton,
            ...(isVideoOff ? styles.controlButtonActive : styles.controlButtonInactive),
          }}
          onClick={handleVideo}
          aria-label={isVideoOff ? 'Turn on video' : 'Turn off video'}
          data-testid="video-button"
        >
          {isVideoOff ? '📷' : '🎥'}
        </button>
        <button
          style={{ ...styles.controlButton, ...styles.screenShareButton }}
          onClick={handleScreenShare}
          aria-label={isScreenSharing ? 'Stop screen share' : 'Share screen'}
          data-testid="screen-share-button"
        >
          🖥️
        </button>
        <button
          style={{ ...styles.controlButton, ...styles.endCallButton }}
          onClick={handleEnd}
          aria-label="End call"
          data-testid="end-call-button"
        >
          📞
        </button>
      </div>
    </div>
  );
}

interface VideoElementProps {
  stream?: MediaStream;
  isLocal?: boolean;
  dataTestId?: string;
}

function VideoElement({ stream, isLocal, dataTestId = 'video-element' }: VideoElementProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      style={styles.video}
      autoPlay
      playsInline
      muted={isLocal}
      data-testid={dataTestId}
    />
  );
}
