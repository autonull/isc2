/**
 * Audio Space Configuration
 */

import type { WebRTCConfig } from '../types/audioSpace.js';

export const AUDIO_CONFIG: WebRTCConfig = {
  iceServers: [
    // Google STUN servers (free, no auth)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    // TURN servers for NAT traversal
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
  ],
  maxParticipants: 10,
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  messageTTL: 60,
  spaceAnnounceTTL: 300,
} as const;

export const AUDIO_CONSTANTS = {
  MAX_PARTICIPANTS: 10,
  MESSAGE_TTL_SECONDS: 60,
  SPACE_ANNOUNCE_TTL_SECONDS: 300,
  MODEL_HASH: 'default-384',
} as const;
