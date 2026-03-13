/**
 * Audio Spaces Module
 *
 * Peer-to-peer audio communication using WebRTC.
 */

export { AudioSpaceModel } from './models/AudioSpace.js';
export { AudioSpaceService } from './services/AudioSpaceService.js';
export { WebRTCAudioService } from './services/WebRTCAudioService.js';
export { AudioParticipantService } from './services/AudioParticipantService.js';
export { AUDIO_CONFIG, AUDIO_CONSTANTS } from './config/audioConfig.js';

export type {
  AudioSpace,
  AudioMessage,
  AudioParticipant,
  AudioRoom,
  WebRTCConfig,
} from './types/audioSpace.js';
