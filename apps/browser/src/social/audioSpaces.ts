import { getChannel } from '../channels/manager';
import { queryProximals } from '../delegation/discovery';
import { getPeerID, getKeypair } from '../identity';
import { DelegationClient } from '../delegation/fallback';

const MODEL_HASH = 'default-384';
const MAX_PARTICIPANTS = 10;

export interface AudioSpace {
  spaceID: string;
  channelID: string;
  creator: string;
  participants: string[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  createdAt: number;
}

export interface AudioMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  spaceID: string;
  sender: string;
  data: unknown;
  timestamp: number;
}

const activeSpaces = new Map<string, AudioSpace>();
const peerConnections = new Map<string, RTCPeerConnection>();

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

async function announceData(key: string, data: unknown, ttl: number): Promise<void> {
  const client = DelegationClient.getInstance();
  if (!client) return;
  await client.announce(key, new TextEncoder().encode(JSON.stringify(data)), ttl);
}

async function setupLocalStream(space: AudioSpace): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    space.localStream = stream;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !space.isMuted;
    });
  } catch {
    throw new Error('Unable to access microphone');
  }
}

async function createPeerConnection(
  space: AudioSpace,
  remotePeer: string
): Promise<RTCPeerConnection> {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peerConnections.set(remotePeer, pc);

  if (space.localStream) {
    space.localStream.getTracks().forEach((track) => {
      pc.addTrack(track, space.localStream!);
    });
  }

  pc.ontrack = (event) => {
    space.remoteStreams.set(remotePeer, event.streams[0]);
    activeSpaces.set(space.spaceID, space);
  };

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

  return pc;
}

async function sendAudioMessage(
  spaceID: string,
  recipient: string,
  message: AudioMessage
): Promise<void> {
  await announceData(`/isc/audio/${spaceID}/${recipient}`, message, 60);
}

export async function createAudioSpace(channelID: string): Promise<AudioSpace> {
  const peerID = await getPeerID();

  const channel = await getChannel(channelID);
  if (!channel) throw new Error(`Channel ${channelID} not found`);

  const embedding = channel.distributions?.[0]?.mu ?? [];
  const _matches: string[] = [];

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
  await announceData(`/isc/audio/space/${space.spaceID}`, space, 300);
  return space;
}

export async function joinAudioSpace(spaceID: string): Promise<AudioSpace> {
  const peerID = await getPeerID();

  let space = activeSpaces.get(spaceID);
  if (!space) {
    const fetchedSpace = await fetchSpaceFromDHT(spaceID);
    if (!fetchedSpace) throw new Error(`Audio space ${spaceID} not found`);
    space = fetchedSpace;
  }

  if (space.participants.length >= MAX_PARTICIPANTS) {
    throw new Error('Audio space is full');
  }

  if (!space.participants.includes(peerID)) {
    space.participants.push(peerID);
  }

  await setupLocalStream(space);

  for (const participant of space.participants) {
    if (participant !== peerID) {
      await establishPeerConnection(space, participant);
    }
  }

  activeSpaces.set(spaceID, space);
  return space;
}

export async function leaveAudioSpace(spaceID: string): Promise<void> {
  const peerID = await getPeerID();

  const space = activeSpaces.get(spaceID);
  if (!space) return;

  for (const [id, pc] of peerConnections) {
    pc.close();
    peerConnections.delete(id);
  }

  if (space.localStream) {
    space.localStream.getTracks().forEach((track) => track.stop());
    space.localStream = null;
  }

  space.participants = space.participants.filter((p) => p !== peerID);
  await announceData(`/isc/audio/leave/${spaceID}`, { peerID, timestamp: Date.now() }, 60);

  if (space.participants.length === 0) {
    activeSpaces.delete(spaceID);
  } else {
    activeSpaces.set(spaceID, space);
  }
}

export async function toggleMute(spaceID: string): Promise<boolean> {
  const space = activeSpaces.get(spaceID);
  if (!space) throw new Error('Audio space not found');

  space.isMuted = !space.isMuted;
  space.localStream?.getAudioTracks().forEach((track) => {
    track.enabled = !space.isMuted;
  });

  activeSpaces.set(spaceID, space);
  return space.isMuted;
}

export function getAudioSpace(spaceID: string): AudioSpace | undefined {
  return activeSpaces.get(spaceID);
}

export function getAllActiveSpaces(): AudioSpace[] {
  return Array.from(activeSpaces.values());
}

async function establishPeerConnection(space: AudioSpace, remotePeer: string): Promise<void> {
  const pc = await createPeerConnection(space, remotePeer);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await sendAudioMessage(space.spaceID, remotePeer, {
    type: 'offer',
    spaceID: space.spaceID,
    sender: await getPeerID(),
    data: offer,
    timestamp: Date.now(),
  });
}

export async function handleAudioMessage(message: AudioMessage): Promise<void> {
  const space = activeSpaces.get(message.spaceID);
  if (!space) return;

  const pc = peerConnections.get(message.sender);

  switch (message.type) {
    case 'offer':
      await handleOffer(space, message.sender, message.data as RTCSessionDescriptionInit);
      break;
    case 'answer':
      pc?.setRemoteDescription(message.data as RTCSessionDescriptionInit);
      break;
    case 'ice-candidate':
      pc?.addIceCandidate(message.data as RTCIceCandidateInit);
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

async function handleOffer(
  space: AudioSpace,
  sender: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  let pc = peerConnections.get(sender);
  if (!pc) {
    pc = await createPeerConnection(space, sender);
  }

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

function handleParticipantLeave(space: AudioSpace, peerID: string): void {
  space.participants = space.participants.filter((p) => p !== peerID);

  const pc = peerConnections.get(peerID);
  if (pc) {
    pc.close();
    peerConnections.delete(peerID);
  }

  space.remoteStreams.delete(peerID);
  activeSpaces.set(space.spaceID, space);
}

async function fetchSpaceFromDHT(spaceID: string): Promise<AudioSpace | null> {
  const client = DelegationClient.getInstance();
  if (!client) return null;

  const results = await client.query(`/isc/audio/space/${spaceID}`, 1);
  if (results.length > 0) {
    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(results[0])) as AudioSpace;
  }
  return null;
}
