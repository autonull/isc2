/**
 * Audio Space Type Definitions
 */

export interface AudioParticipant {
  peerID: string;
  joinedAt: number;
  isMuted: boolean;
  hasAudio: boolean;
}

export interface AudioRoom {
  roomID: string;
  channelID: string;
  creator: string;
  participants: Map<string, AudioParticipant>;
  createdAt: number;
  isActive: boolean;
}

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

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  maxParticipants: number;
  audioConstraints: MediaStreamConstraints['audio'];
  messageTTL: number;
  spaceAnnounceTTL: number;
}
