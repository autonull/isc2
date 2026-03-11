/**
 * Audio Spaces Service
 * 
 * Handles WebRTC audio mesh for real-time voice in dense channel clusters.
 * References: SOCIAL.md#audio-spaces
 */

import { getChannel } from '../channels/manager';
import { queryProximals } from '../delegation/discovery';
import { getPeerID } from '../identity';

/** Default model hash for proximity queries */
const MODEL_HASH = 'default-384';

/** Maximum participants in an audio space */
const MAX_PARTICIPANTS = 10;

/** Audio space state */
export interface AudioSpace {
  spaceID: string;
  channelID: string;
  creator: string;
  participants: string[]; // peerIDs
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  createdAt: number;
}

/** Audio message for signaling */
export interface AudioMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  spaceID: string;
  sender: string;
  data: unknown;
  timestamp: number;
}

/** Active audio spaces map */
const activeSpaces = new Map<string, AudioSpace>();
const peerConnections = new Map<string, RTCPeerConnection>();

/**
 * Create a new audio space in a channel
 */
export async function createAudioSpace(
  channelID: string
): Promise<AudioSpace> {
  const { getPeerID } = await import('../identity');
  const peerID = await getPeerID();
  
  const channel = await getChannel(channelID);
  if (!channel) {
    throw new Error(`Channel ${channelID} not found`);
  }

  // Query for proximal peers to form mesh (placeholder - would use DHT in production)
  const embedding = channel.distributions?.[0]?.mu ?? [];
  const matches: string[] = []; // Placeholder for actual DHT query

  const spaceID = `audio-${Date.now()}-${peerID.slice(0, 8)}`;
  
  const space: AudioSpace = {
    spaceID,
    channelID,
    creator: peerID,
    participants: [peerID],
    localStream: null,
    remoteStreams: new Map(),
    isMuted: false,
    createdAt: Date.now(),
  };

  activeSpaces.set(spaceID, space);
  
  // Announce space creation
  await announceSpace(space);

  return space;
}

/**
 * Join an existing audio space
 */
export async function joinAudioSpace(
  spaceID: string
): Promise<AudioSpace> {
  const { getPeerID, getKeypair } = await import('../identity');
  const peerID = await getPeerID();
  
  let space = activeSpaces.get(spaceID);
  if (!space) {
    // Fetch from DHT
    const fetchedSpace = await fetchSpaceFromDHT(spaceID);
    if (!fetchedSpace) {
      throw new Error(`Audio space ${spaceID} not found`);
    }
    space = fetchedSpace;
  }

  if (space.participants.length >= MAX_PARTICIPANTS) {
    throw new Error('Audio space is full');
  }

  // Add participant
  if (!space.participants.includes(peerID)) {
    space.participants.push(peerID);
  }

  // Setup local audio stream
  await setupLocalStream(space);

  // Connect to existing participants
  for (const participant of space.participants) {
    if (participant !== peerID) {
      await establishPeerConnection(space, participant);
    }
  }

  activeSpaces.set(spaceID, space);
  return space;
}

/**
 * Leave an audio space
 */
export async function leaveAudioSpace(spaceID: string): Promise<void> {
  const { getPeerID } = await import('../identity');
  const peerID = await getPeerID();
  
  const space = activeSpaces.get(spaceID);
  if (!space) return;

  // Close all peer connections
  for (const [peerID, pc] of peerConnections) {
    pc.close();
    peerConnections.delete(peerID);
  }

  // Stop local stream
  if (space.localStream) {
    space.localStream.getTracks().forEach(track => track.stop());
    space.localStream = null;
  }

  // Remove participant
  space.participants = space.participants.filter(p => p !== peerID);
  
  // Announce departure
  await announceParticipantLeave(spaceID, peerID);

  // Clean up if empty
  if (space.participants.length === 0) {
    activeSpaces.delete(spaceID);
  } else {
    activeSpaces.set(spaceID, space);
  }
}

/**
 * Toggle mute state
 */
export async function toggleMute(spaceID: string): Promise<boolean> {
  const space = activeSpaces.get(spaceID);
  if (!space) throw new Error('Audio space not found');

  space.isMuted = !space.isMuted;
  
  if (space.localStream) {
    space.localStream.getAudioTracks().forEach(track => {
      track.enabled = !space.isMuted;
    });
  }

  activeSpaces.set(spaceID, space);
  return space.isMuted;
}

/**
 * Get current audio space
 */
export function getAudioSpace(spaceID: string): AudioSpace | undefined {
  return activeSpaces.get(spaceID);
}

/**
 * Get all active audio spaces
 */
export function getAllActiveSpaces(): AudioSpace[] {
  return Array.from(activeSpaces.values());
}

/**
 * Setup local audio stream
 */
async function setupLocalStream(space: AudioSpace): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    
    space.localStream = stream;
    
    // Mute by default
    stream.getAudioTracks().forEach(track => {
      track.enabled = !space.isMuted;
    });
  } catch (error) {
    console.error('Failed to get audio stream:', error);
    throw new Error('Unable to access microphone');
  }
}

/**
 * Establish peer connection with another participant
 */
async function establishPeerConnection(
  space: AudioSpace,
  remotePeer: string
): Promise<void> {
  const { getKeypair } = await import('../identity');
  const keypair = await getKeypair();
  
  const configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const pc = new RTCPeerConnection(configuration);
  peerConnections.set(remotePeer, pc);

  // Add local tracks
  if (space.localStream) {
    space.localStream.getTracks().forEach(track => {
      pc.addTrack(track, space.localStream!);
    });
  }

  // Handle remote tracks
  pc.ontrack = (event) => {
    space.remoteStreams.set(remotePeer, event.streams[0]);
    activeSpaces.set(space.spaceID, space);
  };

  // Handle ICE candidates
  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await sendAudioMessage(space.spaceID, remotePeer, {
        type: 'ice-candidate',
        spaceID: space.spaceID,
        sender: await getPeerID(),
        data: event.candidate,
        timestamp: Date.now(),
      });
    }
  };

  // Create offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Send offer
  await sendAudioMessage(space.spaceID, remotePeer, {
    type: 'offer',
    spaceID: space.spaceID,
    sender: await getPeerID(),
    data: offer,
    timestamp: Date.now(),
  });
}

/**
 * Handle incoming audio message
 */
export async function handleAudioMessage(message: AudioMessage): Promise<void> {
  const space = activeSpaces.get(message.spaceID);
  if (!space) return;

  const pc = peerConnections.get(message.sender);

  switch (message.type) {
    case 'offer':
      await handleOffer(space, message.sender, message.data as RTCSessionDescriptionInit);
      break;
    case 'answer':
      if (pc) {
        await pc.setRemoteDescription(message.data as RTCSessionDescriptionInit);
      }
      break;
    case 'ice-candidate':
      if (pc && message.data) {
        await pc.addIceCandidate(message.data as RTCIceCandidateInit);
      }
      break;
    case 'join':
      if (!space.participants.includes(message.sender)) {
        space.participants.push(message.sender);
        activeSpaces.set(message.spaceID, space);
      }
      break;
    case 'leave':
      handleParticipantLeave(space, message.sender);
      break;
  }
}

/**
 * Handle incoming offer
 */
async function handleOffer(
  space: AudioSpace,
  sender: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  const { getPeerID, getKeypair } = await import('../identity');
  
  let pc = peerConnections.get(sender);
  if (!pc) {
    const configuration: RTCConfiguration = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    };
    pc = new RTCPeerConnection(configuration);
    peerConnections.set(sender, pc);

    // Add local tracks
    if (space.localStream && pc) {
      const stream = space.localStream;
      stream.getTracks().forEach(track => {
        pc!.addTrack(track, stream);
      });
    }

    // Handle remote tracks
    if (pc) {
      pc.ontrack = (event) => {
        space.remoteStreams.set(sender, event.streams[0]);
        activeSpaces.set(space.spaceID, space);
      };
    }

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await sendAudioMessage(space.spaceID, sender, {
          type: 'ice-candidate',
          spaceID: space.spaceID,
          sender: await getPeerID(),
          data: event.candidate,
          timestamp: Date.now(),
        });
      }
    };
  }

  if (!pc) return;
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await sendAudioMessage(space.spaceID, sender, {
    type: 'answer',
    spaceID: space.spaceID,
    sender: await getPeerID(),
    data: answer,
    timestamp: Date.now(),
  });
}

/**
 * Send audio message to a participant
 */
async function sendAudioMessage(
  spaceID: string,
  recipient: string,
  message: AudioMessage
): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  if (!client) return;

  const key = `/isc/audio/${spaceID}/${recipient}`;
  const data = new TextEncoder().encode(JSON.stringify(message));
  await client.announce(key, data, 60);
}

/**
 * Announce space creation
 */
async function announceSpace(space: AudioSpace): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  if (!client) return;

  const key = `/isc/audio/space/${space.spaceID}`;
  const data = new TextEncoder().encode(JSON.stringify(space));
  await client.announce(key, data, 300);
}

/**
 * Announce participant leave
 */
async function announceParticipantLeave(spaceID: string, peerID: string): Promise<void> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  if (!client) return;

  const key = `/isc/audio/leave/${spaceID}`;
  const data = new TextEncoder().encode(JSON.stringify({ peerID, timestamp: Date.now() }));
  await client.announce(key, data, 60);
}

/**
 * Handle participant leave
 */
function handleParticipantLeave(space: AudioSpace, peerID: string): void {
  // Remove from participants
  space.participants = space.participants.filter(p => p !== peerID);
  
  // Close connection
  const pc = peerConnections.get(peerID);
  if (pc) {
    pc.close();
    peerConnections.delete(peerID);
  }
  
  // Remove remote stream
  space.remoteStreams.delete(peerID);
  
  activeSpaces.set(space.spaceID, space);
}

/**
 * Fetch space from DHT
 */
async function fetchSpaceFromDHT(spaceID: string): Promise<AudioSpace | null> {
  const { DelegationClient } = await import('../delegation/fallback');
  const client = DelegationClient.getInstance();
  if (!client) return null;

  const key = `/isc/audio/space/${spaceID}`;
  const results = await client.query(key, 1);

  if (results.length > 0) {
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(results[0])) as AudioSpace;
  }
  return null;
}
