/* eslint-disable */
/**
 * Video Call Type Definitions
 */

import type { Signature } from '@isc/core';

/**
 * Video call participant
 */
export interface VideoParticipant {
  peerID: string;
  name?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  joinedAt: number;
  stream?: MediaStream;
}

/**
 * Video call state
 */
export interface VideoCall {
  callID: string;
  type: 'direct' | 'group';
  initiator: string;
  participants: VideoParticipant[];
  channelID?: string; // For group calls in a channel
  createdAt: number;
  endedAt?: number;
  maxParticipants: number;
}

/**
 * Video call message for signaling
 */
export interface VideoCallMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'mute' | 'unmute' | 'video-off' | 'video-on' | 'screen-share' | 'screen-share-end';
  callID: string;
  sender: string;
  recipient?: string; // For direct calls
  data?: unknown;
  timestamp: number;
  signature?: Signature;
}

/**
 * Video call settings
 */
export interface VideoCallSettings {
  videoEnabled: boolean;
  audioEnabled: boolean;
  videoQuality: 'low' | 'medium' | 'high';
  maxParticipants: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

/**
 * Screen share state
 */
export interface ScreenShareState {
  isSharing: boolean;
  stream?: MediaStream;
  startedAt?: number;
}

/**
 * Video call stats
 */
export interface VideoCallStats {
  duration: number;
  bytesSent: number;
  bytesReceived: number;
  packetsLost: number;
  jitter: number;
  rtt: number;
  frameRate?: number;
  resolution?: { width: number; height: number };
}

/**
 * Default video call settings
 */
export const DEFAULT_VIDEO_SETTINGS: VideoCallSettings = {
  videoEnabled: true,
  audioEnabled: true,
  videoQuality: 'medium',
  maxParticipants: 8,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/**
 * Video quality constraints
 */
export const VIDEO_QUALITY_CONSTRAINTS: Record<'low' | 'medium' | 'high', MediaStreamConstraints['video']> = {
  low: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 15 },
  },
  medium: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  },
  high: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
};
