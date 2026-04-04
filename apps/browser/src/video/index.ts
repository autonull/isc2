/* eslint-disable */
/**
 * Video Module
 * 
 * WebRTC video calling with screen sharing and group calls.
 */

export type {
  VideoCall,
  VideoParticipant,
  VideoCallMessage,
  VideoCallSettings,
  ScreenShareState,
  VideoCallStats,
} from './types.ts';

export {
  createVideoCall,
  joinVideoCall,
  leaveVideoCall,
  toggleMute,
  toggleVideo,
  startScreenShare,
  stopScreenShare,
  getLocalMediaStream,
  handleVideoCallMessage,
  getVideoCall,
  getActiveVideoCalls,
  getCallStats,
} from './handler.ts';

export { DEFAULT_VIDEO_SETTINGS, VIDEO_QUALITY_CONSTRAINTS } from './types.ts';
