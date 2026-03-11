/**
 * Video Call UI Component
 */

import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { VideoCall, VideoParticipant, VideoCallStats } from '../video/types.js';
import {
  leaveVideoCall,
  toggleMute,
  toggleVideo,
  startScreenShare,
  stopScreenShare,
  getCallStats,
} from '../video/handler.js';

const styles = {
  container: {
    position: 'fixed' as const,
    inset: 0,
    background: '#1a1a2e',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  videoGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '8px',
    padding: '16px',
    overflow: 'auto',
  },
  videoTile: {
    position: 'relative' as const,
    background: '#16213e',
    borderRadius: '12px',
    overflow: 'hidden',
    aspectRatio: '16/9',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  participantName: {
    position: 'absolute' as const,
    bottom: '8px',
    left: '8px',
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
    background: 'rgba(0,0,0,0.6)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  statusIcons: {
    position: 'absolute' as const,
    top: '8px',
    right: '8px',
    display: 'flex',
    gap: '4px',
  },
  statusIcon: {
    background: 'rgba(0,0,0,0.6)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
  },
  controls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: 'rgba(0,0,0,0.8)',
  },
  controlButton: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    transition: 'transform 0.2s',
  },
  controlButtonActive: {
    background: '#e74c3c',
    color: 'white',
  },
  controlButtonInactive: {
    background: '#34495e',
    color: 'white',
  },
  endCallButton: {
    background: '#e74c3c',
    color: 'white',
  },
  screenShareButton: {
    background: '#3498db',
    color: 'white',
  },
  participantCount: {
    position: 'absolute' as const,
    top: '16px',
    left: '16px',
    color: 'white',
    fontSize: '14px',
    background: 'rgba(0,0,0,0.6)',
    padding: '8px 12px',
    borderRadius: '8px',
  },
  callDuration: {
    position: 'absolute' as const,
    top: '16px',
    right: '16px',
    color: 'white',
    fontSize: '14px',
    background: 'rgba(0,0,0,0.6)',
    padding: '8px 12px',
    borderRadius: '8px',
  },
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
  const [stats, setStats] = useState<VideoCallStats | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    // Update duration every second
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - call.createdAt) / 1000));
    }, 1000);

    // Get stats periodically
    const statsInterval = setInterval(async () => {
      const callStats = await getCallStats(call.callID);
      setStats(callStats);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(statsInterval);
    };
  }, [call.callID, call.createdAt]);

  useEffect(() => {
    // Update participant streams
    setParticipants(call.participants);
  }, [call.participants]);

  const handleMute = async () => {
    const muted = await toggleMute(call.callID);
    setIsMuted(muted);
  };

  const handleVideo = async () => {
    const off = await toggleVideo(call.callID);
    setIsVideoOff(off);
  };

  const handleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare(call.callID);
      setIsScreenSharing(false);
    } else {
      await startScreenShare(call.callID);
      setIsScreenSharing(true);
    }
  };

  const handleEnd = async () => {
    await leaveVideoCall(call.callID);
    onEnd?.();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.participantCount}>
        {participants.length} / {call.maxParticipants} participants
      </div>
      <div style={styles.callDuration}>{formatDuration(duration)}</div>

      <div style={styles.videoGrid}>
        {participants.map((participant) => (
          <div key={participant.peerID} style={styles.videoTile}>
            <VideoElement
              stream={participant.stream}
              isLocal={participant.peerID === call.initiator}
            />
            <div style={styles.participantName}>
              {participant.peerID.slice(0, 8)}...
            </div>
            <div style={styles.statusIcons}>
              {participant.isMuted && (
                <span style={styles.statusIcon}>🔇</span>
              )}
              {participant.isVideoOff && (
                <span style={styles.statusIcon}>📷</span>
              )}
              {participant.isScreenSharing && (
                <span style={styles.statusIcon}>🖥️</span>
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
        >
          {isVideoOff ? '📷' : '🎥'}
        </button>
        <button
          style={{
            ...styles.controlButton,
            ...styles.screenShareButton,
          }}
          onClick={handleScreenShare}
          aria-label={isScreenSharing ? 'Stop screen share' : 'Share screen'}
        >
          🖥️
        </button>
        <button
          style={{
            ...styles.controlButton,
            ...styles.endCallButton,
          }}
          onClick={handleEnd}
          aria-label="End call"
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
}

function VideoElement({ stream, isLocal }: VideoElementProps) {
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
    />
  );
}
