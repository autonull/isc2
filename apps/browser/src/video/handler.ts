/**
 * WebRTC Video Call Handler
 * 
 * Handles WebRTC peer connections, signaling, and media streams.
 */

import type { VideoCall, VideoParticipant, VideoCallMessage, VideoCallSettings, ScreenShareState, VideoCallStats } from './types.js';
import { DEFAULT_VIDEO_SETTINGS, VIDEO_QUALITY_CONSTRAINTS } from './types.js';
import { getPeerID, getKeypair } from '../identity/index.js';
import { DelegationClient } from '../delegation/fallback.js';
import { sign, encode } from '@isc/core';

const VIDEO_CALL_PROTOCOL = '/isc/video/1.0';
const MAX_PARTICIPANTS = 8;

/**
 * Active video calls map
 */
const activeCalls = new Map<string, VideoCall>();
const peerConnections = new Map<string, RTCPeerConnection>();
const localStreams = new Map<string, MediaStream>();
const screenShareStates = new Map<string, ScreenShareState>();

/**
 * WebRTC configuration
 */
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

/**
 * Create a new video call
 */
export async function createVideoCall(
  type: 'direct' | 'group',
  recipient?: string,
  channelID?: string,
  settings: Partial<VideoCallSettings> = {}
): Promise<VideoCall> {
  const initiator = await getPeerID();
  const keypair = getKeypair();
  
  if (!keypair) {
    throw new Error('Identity not initialized');
  }

  const call: VideoCall = {
    callID: `call_${crypto.randomUUID()}`,
    type,
    initiator,
    participants: [
      {
        peerID: initiator,
        isMuted: settings.audioEnabled !== undefined ? !settings.audioEnabled : !DEFAULT_VIDEO_SETTINGS.audioEnabled,
        isVideoOff: settings.videoEnabled !== undefined ? !settings.videoEnabled : !DEFAULT_VIDEO_SETTINGS.videoEnabled,
        isScreenSharing: false,
        joinedAt: Date.now(),
      },
    ],
    channelID,
    createdAt: Date.now(),
    maxParticipants: settings.maxParticipants || MAX_PARTICIPANTS,
  };

  // Get local media stream
  const stream = await getLocalMediaStream(settings);
  localStreams.set(call.callID, stream);

  activeCalls.set(call.callID, call);

  // Send call invitation
  if (type === 'direct' && recipient) {
    await sendCallInvitation(call, recipient);
  } else if (type === 'group' && channelID) {
    await announceGroupCall(call, channelID);
  }

  return call;
}

/**
 * Join an existing video call
 */
export async function joinVideoCall(callID: string): Promise<VideoCall> {
  const call = activeCalls.get(callID);
  if (!call) {
    throw new Error('Call not found');
  }

  const peerID = await getPeerID();
  
  // Check if already a participant
  if (call.participants.some((p) => p.peerID === peerID)) {
    return call;
  }

  // Check max participants
  if (call.participants.length >= call.maxParticipants) {
    throw new Error('Call is full');
  }

  // Add participant
  const participant: VideoParticipant = {
    peerID,
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    joinedAt: Date.now(),
  };
  call.participants.push(participant);

  // Get local media stream
  const stream = await getLocalMediaStream();
  localStreams.set(callID, stream);

  // Send join message
  await sendVideoCallMessage({
    type: 'join',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  // Create peer connections with existing participants
  for (const p of call.participants) {
    if (p.peerID !== peerID) {
      await createPeerConnection(callID, p.peerID, stream);
    }
  }

  return call;
}

/**
 * Leave a video call
 */
export async function leaveVideoCall(callID: string): Promise<void> {
  const call = activeCalls.get(callID);
  if (!call) return;

  const peerID = await getPeerID();

  // Stop local stream
  const stream = localStreams.get(callID);
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    localStreams.delete(callID);
  }

  // Stop screen sharing
  const screenShare = screenShareStates.get(callID);
  if (screenShare?.isSharing) {
    await stopScreenShare(callID);
  }

  // Close peer connections
  for (const [id, pc] of peerConnections) {
    if (id.startsWith(callID)) {
      pc.close();
      peerConnections.delete(id);
    }
  }

  // Send leave message
  await sendVideoCallMessage({
    type: 'leave',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  // Remove participant from call
  call.participants = call.participants.filter((p) => p.peerID !== peerID);

  // End call if no participants left
  if (call.participants.length === 0) {
    call.endedAt = Date.now();
    activeCalls.delete(callID);
  } else {
    activeCalls.set(callID, call);
  }
}

/**
 * Toggle mute state
 */
export async function toggleMute(callID: string): Promise<boolean> {
  const call = activeCalls.get(callID);
  if (!call) throw new Error('Call not found');

  const peerID = await getPeerID();
  const participant = call.participants.find((p) => p.peerID === peerID);
  if (!participant) throw new Error('Not in call');

  participant.isMuted = !participant.isMuted;

  const stream = localStreams.get(callID);
  if (stream) {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !participant!.isMuted;
    });
  }

  await sendVideoCallMessage({
    type: participant.isMuted ? 'mute' : 'unmute',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  return participant.isMuted;
}

/**
 * Toggle video state
 */
export async function toggleVideo(callID: string): Promise<boolean> {
  const call = activeCalls.get(callID);
  if (!call) throw new Error('Call not found');

  const peerID = await getPeerID();
  const participant = call.participants.find((p) => p.peerID === peerID);
  if (!participant) throw new Error('Not in call');

  participant.isVideoOff = !participant.isVideoOff;

  const stream = localStreams.get(callID);
  if (stream) {
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !participant!.isVideoOff;
    });
  }

  await sendVideoCallMessage({
    type: participant.isVideoOff ? 'video-off' : 'video-on',
    callID,
    sender: peerID,
    timestamp: Date.now(),
  });

  return participant.isVideoOff;
}

/**
 * Start screen sharing
 */
export async function startScreenShare(callID: string): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor',
    } as MediaTrackConstraints,
    audio: false,
  });

  screenShareStates.set(callID, {
    isSharing: true,
    stream,
    startedAt: Date.now(),
  });

  const call = activeCalls.get(callID);
  if (call) {
    const peerID = await getPeerID();
    const participant = call.participants.find((p) => p.peerID === peerID);
    if (participant) {
      participant.isScreenSharing = true;
    }

    // Send screen share track to all peers
    for (const [connId, pc] of peerConnections) {
      if (connId.startsWith(callID)) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(stream.getVideoTracks()[0]);
        }
      }
    }

    await sendVideoCallMessage({
      type: 'screen-share',
      callID,
      sender: peerID,
      timestamp: Date.now(),
    });
  }

  // Handle screen share stop
  stream.getVideoTracks()[0].onended = async () => {
    await stopScreenShare(callID);
  };

  return stream;
}

/**
 * Stop screen sharing
 */
export async function stopScreenShare(callID: string): Promise<void> {
  const screenShare = screenShareStates.get(callID);
  if (!screenShare?.isSharing) return;

  if (screenShare.stream) {
    screenShare.stream.getTracks().forEach((track) => track.stop());
  }

  screenShareStates.set(callID, { isSharing: false });

  const call = activeCalls.get(callID);
  if (call) {
    const peerID = await getPeerID();
    const participant = call.participants.find((p) => p.peerID === peerID);
    if (participant) {
      participant.isScreenSharing = false;
    }

    // Restore camera track
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

/**
 * Get local media stream with specified constraints
 */
export async function getLocalMediaStream(
  settings: Partial<VideoCallSettings> = {}
): Promise<MediaStream> {
  const finalSettings = { ...DEFAULT_VIDEO_SETTINGS, ...settings };

  const constraints: MediaStreamConstraints = {
    audio: finalSettings.audioEnabled ? {
      echoCancellation: finalSettings.echoCancellation,
      noiseSuppression: finalSettings.noiseSuppression,
      autoGainControl: finalSettings.autoGainControl,
    } : false,
    video: finalSettings.videoEnabled ? VIDEO_QUALITY_CONSTRAINTS[finalSettings.videoQuality] : false,
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    const error = err as Error & { name?: string };
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Camera/microphone permission denied. Please enable permissions in browser settings.');
    }
    
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      throw new Error('No camera or microphone found. Please connect a device and try again.');
    }
    
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      throw new Error('Camera or microphone is already in use by another application.');
    }
    
    if (error.name === 'OverconstrainedError') {
      throw new Error('No device found matching specified constraints. Try lowering video quality.');
    }
    
    throw new Error('Failed to access media devices: ' + error.message);
  }
}

/**
 * Create peer connection with another participant
 */
async function createPeerConnection(
  callID: string,
  peerID: string,
  stream: MediaStream
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const connId = `${callID}_${peerID}`;

  // Add local tracks
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  // Handle ICE candidates
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

  // Handle incoming tracks
  pc.ontrack = (event) => {
    const call = activeCalls.get(callID);
    if (call) {
      const participant = call.participants.find((p) => p.peerID === peerID);
      if (participant) {
        if (!participant.stream) {
          participant.stream = new MediaStream();
        }
        participant.stream.addTrack(event.track);
      }
    }
  };

  // Create and send offer
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

/**
 * Handle incoming video call message
 */
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

      await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));
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
      const connId = `${message.callID}_${message.sender}`;
      const pc = peerConnections.get(connId);
      if (pc && message.data) {
        await pc.setRemoteDescription(new RTCSessionDescription(message.data as RTCSessionDescriptionInit));
      }
      break;
    }

    case 'ice-candidate': {
      const connId = `${message.callID}_${message.sender}`;
      const pc = peerConnections.get(connId);
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
      // Update call state based on message
      updateCallState(message);
      break;
  }
}

/**
 * Update call state from message
 */
function updateCallState(message: VideoCallMessage): void {
  const call = activeCalls.get(message.callID);
  if (!call) return;

  const participant = call.participants.find((p) => p.peerID === message.sender);
  if (!participant) return;

  switch (message.type) {
    case 'mute':
      participant.isMuted = true;
      break;
    case 'unmute':
      participant.isMuted = false;
      break;
    case 'video-off':
      participant.isVideoOff = true;
      break;
    case 'video-on':
      participant.isVideoOff = false;
      break;
    case 'screen-share':
      participant.isScreenSharing = true;
      break;
    case 'screen-share-end':
      participant.isScreenSharing = false;
      break;
    case 'leave':
      call.participants = call.participants.filter((p) => p.peerID !== message.sender);
      break;
  }
}

/**
 * Send video call invitation
 */
async function sendCallInvitation(call: VideoCall, recipient: string): Promise<void> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const message: VideoCallMessage = {
    type: 'offer',
    callID: call.callID,
    sender: call.initiator,
    recipient,
    data: { type: 'call', callType: call.type },
    timestamp: Date.now(),
  };

  const payload = encode(message);
  message.signature = await sign(payload, keypair.privateKey);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/video/${recipient}/invitation`;
    await client.announce(key, encode(message), 300); // 5 min TTL
  }
}

/**
 * Announce group call to channel
 */
async function announceGroupCall(call: VideoCall, channelID: string): Promise<void> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const message: VideoCallMessage = {
    type: 'join',
    callID: call.callID,
    sender: call.initiator,
    timestamp: Date.now(),
  };

  const payload = encode(message);
  message.signature = await sign(payload, keypair.privateKey);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = `/isc/video/${channelID}/active`;
    await client.announce(key, encode(message), 3600); // 1 hour TTL
  }
}

/**
 * Send video call message
 */
async function sendVideoCallMessage(message: VideoCallMessage): Promise<void> {
  const keypair = getKeypair();
  if (!keypair) throw new Error('Identity not initialized');

  const payload = encode(message);
  message.signature = await sign(payload, keypair.privateKey);

  const client = DelegationClient.getInstance();
  if (client) {
    const key = message.recipient
      ? `/isc/video/${message.recipient}/${message.callID}`
      : `/isc/video/${message.callID}`;
    await client.announce(key, encode(message), 60); // 1 min TTL for signaling
  }
}

/**
 * Get active video call
 */
export function getVideoCall(callID: string): VideoCall | undefined {
  return activeCalls.get(callID);
}

/**
 * Get all active video calls
 */
export function getActiveVideoCalls(): VideoCall[] {
  return Array.from(activeCalls.values());
}

/**
 * Get call stats
 */
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

  // Collect stats from all peer connections
  for (const [id, pc] of peerConnections) {
    if (id.startsWith(callID)) {
      try {
        const report = await pc.getStats();
        report.forEach((value) => {
          if (value.type === 'outbound-rtp') {
            stats.bytesSent += value.bytesSent || 0;
          } else if (value.type === 'inbound-rtp') {
            stats.bytesReceived += value.bytesReceived || 0;
            stats.packetsLost += value.packetsLost || 0;
          } else if (value.type === 'candidate-pair') {
            stats.rtt = value.currentRoundTripTime || 0;
          }
        });
      } catch (err) {
        console.warn('Failed to get stats:', err);
      }
    }
  }

  return stats;
}
