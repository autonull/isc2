/* eslint-disable */
/**
 * Audio Spaces Module
 *
 * Peer-to-peer audio communication using WebRTC.
 */

export { AudioSpaceModel } from './models/AudioSpace.ts';
export { AudioSpaceService } from './services/AudioSpaceService.ts';
export { WebRTCAudioService } from './services/WebRTCAudioService.ts';
export { AudioParticipantService } from './services/AudioParticipantService.ts';
export { AUDIO_CONFIG, AUDIO_CONSTANTS } from './config/audioConfig.ts';

export type {
  AudioSpace,
  AudioMessage,
  AudioParticipant,
  AudioRoom,
  WebRTCConfig,
} from './types/audioSpace.ts';
