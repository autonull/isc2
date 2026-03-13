/**
 * Audio Space Configuration
 */

import type { WebRTCConfig } from '../types/audioSpace.js';

export const AUDIO_CONFIG: WebRTCConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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
