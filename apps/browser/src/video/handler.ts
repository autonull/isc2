import { sign, encode } from '@isc/core';
import type {
  VideoCall,
  VideoParticipant,
  VideoCallMessage,
  VideoCallSettings,
  ScreenShareState,
  VideoCallStats,
} from './types.js';
import { DEFAULT_VIDEO_SETTINGS, VIDEO_QUALITY_CONSTRAINTS } from './types.js';
import { DelegationClient } from '../delegation/fallback.js';
import { getPeerID, getKeypair } from '../identity/index.js';

const VIDEO_CALL_PROTOCOL = '/isc/video/1.0.0';
const MAX_PARTICIPANTS = 8;

const activeCalls = new Map<string, VideoCall>();
const peerConnections = new Map<string, RTCPeerConnection>();
const localStreams = new Map<string, MediaStream>();
const screenShareStates = new Map<string, ScreenShareState>();

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    // Google STUN servers (free, no auth)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Additional public STUN servers
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.voip.blackberry.com:3478' },
    // TURN servers for NAT traversal (production should use authenticated TURN)
    // OpenRelay (free tier, limited)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

const MEDIA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    'Camera/microphone permission denied. Please enable permissions in browser settings.',
  PermissionDeniedError:
    'Camera/microphone permission denied. Please enable permissions in browser settings.',
  NotFoundError: 'No camera or microphone found. Please connect a device and try again.',
  DevicesNotFoundError: 'No camera or microphone found. Please connect a device and try again.',
  NotReadableError: 'Camera or microphone is already in use by another application.',
  TrackStartError: 'Camera or microphone is already in use by another application.',
  OverconstrainedError:
    'No device found matching specified constraints. Try lowering video quality.',
  AbortError: 'Media request aborted. Please try again.',
  NotSupportedError: 'Media constraints not supported by this browser.',
  TypeError: 'Invalid media constraints specified.',
  SecurityError: 'Security restriction prevented media access.',
};

/**
 * Video call error types
 */
export class VideoCallError extends Error {
  constructor(
    message: string,
    public code:
      | 'PERMISSION_DENIED'
      | 'DEVICE_NOT_FOUND'
      | 'IN_USE'
      | 'CONSTRAINT_ERROR'
      | 'NETWORK_ERROR'
      | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'VideoCallError';
  }

  static fromMediaError(error: Error & { name?: string }): VideoCallError {
    const errorName = error.name || 'UnknownError';

    switch (errorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return new VideoCallError(MEDIA_ERROR_MESSAGES[errorName], 'PERMISSION_DENIED');
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return new VideoCallError(MEDIA_ERROR_MESSAGES[errorName], 'DEVICE_NOT_FOUND');
      case 'NotReadableError':
      case 'TrackStartError':
        return new VideoCallError(MEDIA_ERROR_MESSAGES[errorName], 'IN_USE');
      case 'OverconstrainedError':
        return new VideoCallError(MEDIA_ERROR_MESSAGES[errorName], 'CONSTRAINT_ERROR');
      default:
        return new VideoCallError(`Media access failed: ${error.message}`, 'UNKNOWN');
    }
  }
}

async function signAndSend(message: VideoCallMessage, key: string, ttl: number): Promise<void> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  message.signature = await sign(encode(message), keypair.privateKey);

  const client = DelegationClient.getInstance();
  if (client) {
    await client.announce(key, encode(message), ttl);
  }
}

async function sendCallInvitation(call: VideoCall, recipient: string): Promise<void> {
  await signAndSend(
    {
      type: 'offer',
      callID: call.callID,
      sender: call.initiator,
      recipient,
      data: { type: 'call', callType: call.type },
      timestamp: Date.now(),
    },
    `/isc/video/${recipient}/invitation`,
    300
  );
}

async function announceGroupCall(call: VideoCall, channelID: string): Promise<void> {
  await signAndSend(
    {
      type: 'join',
      callID: call.callID,
      sender: call.initiator,
      timestamp: Date.now(),
    },
    `/isc/video/${channelID}/active`,
    3600
  );
}

async function sendVideoCallMessage(message: VideoCallMessage): Promise<void> {
  const key = message.recipient
    ? `/isc/video/${message.recipient}/${message.callID}`
    : `/isc/video/${message.callID}`;
  await signAndSend(message, key, 60);
}

function createParticipant(
  initiator: string,
  settings: Partial<VideoCallSettings>
): VideoParticipant {
  return {
    peerID: initiator,
    isMuted: !(settings.audioEnabled ?? DEFAULT_VIDEO_SETTINGS.audioEnabled),
    isVideoOff: !(settings.videoEnabled ?? DEFAULT_VIDEO_SETTINGS.videoEnabled),
    isScreenSharing: false,
    joinedAt: Date.now(),
  };
}

function cleanupCall(callID: string): void {
  const stream = localStreams.get(callID);
  if (stream) stream.getTracks().forEach((track) => track.stop());
  localStreams.delete(callID);
  activeCalls.delete(callID);
}

export async function createVideoCall(
  type: 'direct' | 'group',
  recipient?: string,
  channelID?: string,
  settings: Partial<VideoCallSettings> = {}
): Promise<VideoCall> {
  const initiator = await getPeerID();
  const keypair = getKeypair();

  if (!keypair) {
    throw new VideoCallError('Identity not initialized. Please refresh the page.', 'UNKNOWN');
  }

  const call: VideoCall = {
    callID: `call_${crypto.randomUUID()}`,
    type,
    initiator,
    participants: [createParticipant(initiator, settings)],
    channelID,
    createdAt: Date.now(),
    maxParticipants: settings.maxParticipants || MAX_PARTICIPANTS,
  };

  try {
    const stream = await getLocalMediaStream(settings);
    localStreams.set(call.callID, stream);
    activeCalls.set(call.callID, call);
  } catch (err) {
    if (err instanceof VideoCallError) throw err;
    throw new VideoCallError(`Failed to initialize media: ${(err as Error).message}`, 'UNKNOWN');
  }

  try {
    if (type === 'direct' && recipient) {
      await sendCallInvitation(call, recipient);
    } else if (type === 'group' && channelID) {
      await announceGroupCall(call, channelID);
    }
  } catch (err) {
    cleanupCall(call.callID);
    const action = type === 'direct' ? 'send call invitation' : 'announce group call';
    throw new VideoCallError(
      `Failed to ${action}. Check your network connection.`,
      'NETWORK_ERROR'
    );
  }

  return call;
}

export async function joinVideoCall(callID: string): Promise<VideoCall> {
  const call = activeCalls.get(callID);
  if (!call) throw new Error('Call not found');

  const peerID = await getPeerID();
  if (call.participants.some((p) => p.peerID === peerID)) return call;
  if (call.participants.length >= call.maxParticipants) throw new Error('Call is full');

  call.participants.push({
    peerID,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    joinedAt: Date.now(),
  });

  const stream = await getLocalMediaStream();
  localStreams.set(callID, stream);

  await sendVideoCallMessage({
    type: 'join',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  for (const p of call.participants) {
    if (p.peerID !== peerID) {
      await createPeerConnection(callID, p.peerID, stream);
    }
  }

  return call;
}

export async function leaveVideoCall(callID: string): Promise<void> {
  const call = activeCalls.get(callID);
  if (!call) return;

  const peerID = await getPeerID();
  const stream = localStreams.get(callID);
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    localStreams.delete(callID);
  }

  const screenShare = screenShareStates.get(callID);
  if (screenShare?.isSharing) await stopScreenShare(callID);

  for (const [id, pc] of peerConnections) {
    if (id.startsWith(callID)) {
      pc.close();
      peerConnections.delete(id);
    }
  }

  await sendVideoCallMessage({
    type: 'leave',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  call.participants = call.participants.filter((p) => p.peerID !== peerID);

  if (call.participants.length === 0) {
    call.endedAt = Date.now();
    activeCalls.delete(callID);
  } else {
    activeCalls.set(callID, call);
  }
}

export async function toggleMute(callID: string): Promise<boolean> {
  const call = activeCalls.get(callID);
  if (!call) throw new Error('Call not found');

  const peerID = await getPeerID();
  const participant = call.participants.find((p) => p.peerID === peerID);
  if (!participant) throw new Error('Not in call');

  participant.isMuted = !participant.isMuted;

  localStreams
    .get(callID)
    ?.getAudioTracks()
    .forEach((track) => {
      track.enabled = !participant.isMuted;
    });

  await sendVideoCallMessage({
    type: participant.isMuted ? 'mute' : 'unmute',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  return participant.isMuted;
}

export async function toggleVideo(callID: string): Promise<boolean> {
  const call = activeCalls.get(callID);
  if (!call) throw new Error('Call not found');

  const peerID = await getPeerID();
  const participant = call.participants.find((p) => p.peerID === peerID);
  if (!participant) throw new Error('Not in call');

  participant.isVideoOff = !participant.isVideoOff;

  localStreams
    .get(callID)
    ?.getVideoTracks()
    .forEach((track) => {
      track.enabled = !participant.isVideoOff;
    });

  await sendVideoCallMessage({
    type: participant.isVideoOff ? 'video-off' : 'video-on',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  return participant.isVideoOff;
}

export async function startScreenShare(callID: string): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: 'monitor' } as MediaTrackConstraints,
    audio: false,
  });

  screenShareStates.set(callID, { isSharing: true, stream, startedAt: Date.now() });

  const call = activeCalls.get(callID);
  if (call) {
    const peerID = await getPeerID();
    const participant = call.participants.find((p) => p.peerID === peerID);
    if (participant) participant.isScreenSharing = true;

    for (const [connId, pc] of peerConnections) {
      if (connId.startsWith(callID)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(stream.getVideoTracks()[0]);
      }
    }

    await sendVideoCallMessage({
      type: 'screen-share',
      callID,
      sender: peerID,
      timestamp: Date.now(),
    });
  }

  stream.getVideoTracks()[0].onended = async () => {
    await stopScreenShare(callID);
  };

  return stream;
}

export async function stopScreenShare(callID: string): Promise<void> {
  const screenShare = screenShareStates.get(callID);
  if (!screenShare?.isSharing) return;

  screenShare.stream?.getTracks().forEach((track) => track.stop());
  screenShareStates.set(callID, { isSharing: false });

  const call = activeCalls.get(callID);
  if (call) {
    const peerID = await getPeerID();
    const participant = call.participants.find((p) => p.peerID === peerID);
    if (participant) participant.isScreenSharing = false;

    const localStream = localStreams.get(callID);
    if (localStream) {
      for (const [connId, pc] of peerConnections) {
        if (connId.startsWith(callID)) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender && localStream.getVideoTracks()[0]) {
            await sender.replaceTrack(localStream.getVideoTracks()[0]);
          }
        }
      }
    }

    await sendVideoCallMessage({
      type: 'screen-share-end',
      callID,
      sender: peerID,
      timestamp: Date.now(),
    });
  }
}

export async function getLocalMediaStream(
  settings: Partial<VideoCallSettings> = {}
): Promise<MediaStream> {
  const finalSettings = { ...DEFAULT_VIDEO_SETTINGS, ...settings };

  const constraints: MediaStreamConstraints = {
    audio: finalSettings.audioEnabled
      ? {
          echoCancellation: finalSettings.echoCancellation,
          noiseSuppression: finalSettings.noiseSuppression,
          autoGainControl: finalSettings.autoGainControl,
        }
      : false,
    video: finalSettings.videoEnabled
      ? VIDEO_QUALITY_CONSTRAINTS[finalSettings.videoQuality]
      : false,
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const error = err as Error & { name?: string };
    throw VideoCallError.fromMediaError(error);
  }
}

async function createPeerConnection(
  callID: string,
  peerID: string,
  stream: MediaStream
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const connId = `${callID}_${peerID}`;

  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendVideoCallMessage({
        type: 'ice-candidate',
        callID,
        sender: await getPeerID(),
        recipient: peerID,
        data: event.candidate,
        timestamp: Date.now(),
      });
    }
  };

  pc.ontrack = (event) => {
    const call = activeCalls.get(callID);
    if (call) {
      const participant = call.participants.find((p) => p.peerID === peerID);
      if (participant) {
        participant.stream ??= new MediaStream();
        participant.stream.addTrack(event.track);
      }
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await sendVideoCallMessage({
    type: 'offer',
    callID,
    sender: await getPeerID(),
    recipient: peerID,
    data: offer,
    timestamp: Date.now(),
  });

  peerConnections.set(connId, pc);
  return pc;
}

export async function handleVideoCallMessage(message: VideoCallMessage): Promise<void> {
  const peerID = await getPeerID();

  switch (message.type) {
    case 'offer': {
      const call = activeCalls.get(message.callID);
      if (!call) return;

      const pc = await createPeerConnection(
        message.callID,
        message.sender,
        localStreams.get(message.callID)!
      );

      await pc.setRemoteDescription(
        new RTCSessionDescription(message.data as RTCSessionDescriptionInit)
      );
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await sendVideoCallMessage({
        type: 'answer',
        callID: message.callID,
        sender: peerID,
        recipient: message.sender,
        data: answer,
        timestamp: Date.now(),
      });
      break;
    }

    case 'answer': {
      const pc = peerConnections.get(`${message.callID}_${message.sender}`);
      if (pc && message.data) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(message.data as RTCSessionDescriptionInit)
        );
      }
      break;
    }

    case 'ice-candidate': {
      const pc = peerConnections.get(`${message.callID}_${message.sender}`);
      if (pc && message.data) {
        await pc.addIceCandidate(new RTCIceCandidate(message.data as RTCIceCandidateInit));
      }
      break;
    }

    case 'join':
    case 'leave':
    case 'mute':
    case 'unmute':
    case 'video-off':
    case 'video-on':
    case 'screen-share':
    case 'screen-share-end':
      updateCallState(message);
      break;
  }
}

function updateCallState(message: VideoCallMessage): void {
  const call = activeCalls.get(message.callID);
  if (!call) return;

  const participant = call.participants.find((p) => p.peerID === message.sender);
  if (!participant) return;

  const stateUpdates: Record<VideoCallMessage['type'], () => void> = {
    mute: () => {
      participant.isMuted = true;
    },
    unmute: () => {
      participant.isMuted = false;
    },
    'video-off': () => {
      participant.isVideoOff = true;
    },
    'video-on': () => {
      participant.isVideoOff = false;
    },
    'screen-share': () => {
      participant.isScreenSharing = true;
    },
    'screen-share-end': () => {
      participant.isScreenSharing = false;
    },
    leave: () => {
      call.participants = call.participants.filter((p) => p.peerID !== message.sender);
    },
    join: () => {},
    offer: () => {},
    answer: () => {},
    'ice-candidate': () => {},
  };

  stateUpdates[message.type]?.();
}

export function getVideoCall(callID: string): VideoCall | undefined {
  return activeCalls.get(callID);
}

export function getActiveVideoCalls(): VideoCall[] {
  return Array.from(activeCalls.values());
}

export async function getCallStats(callID: string): Promise<VideoCallStats | null> {
  const call = activeCalls.get(callID);
  if (!call) return null;

  const stats: VideoCallStats = {
    duration: Date.now() - call.createdAt,
    bytesSent: 0,
    bytesReceived: 0,
    packetsLost: 0,
    jitter: 0,
    rtt: 0,
  };

  for (const [id, pc] of peerConnections) {
    if (!id.startsWith(callID)) continue;

    try {
      const report = await pc.getStats();
      report.forEach((value) => {
        switch (value.type) {
          case 'outbound-rtp':
            stats.bytesSent += value.bytesSent || 0;
            break;
          case 'inbound-rtp':
            stats.bytesReceived += value.bytesReceived || 0;
            stats.packetsLost += value.packetsLost || 0;
            break;
          case 'candidate-pair':
            stats.rtt = value.currentRoundTripTime || 0;
            break;
        }
      });
    } catch (err) {
      console.warn('Failed to get stats:', err);
    }
  }

  return stats;
}
