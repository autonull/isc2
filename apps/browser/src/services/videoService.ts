/**
 * Video Service
 *
 * Manages video calls, screen sharing, and call history.
 * Integrates with the existing video call handler infrastructure.
 */

import type { VideoService as IVideoService } from '../di/container.js';
import { createVideoCall, getActiveVideoCalls } from '../video/handler.js';
import type { VideoCall } from '../video/types.js';
import { loggers } from '../utils/logger.js';

const logger = loggers.social;

// In-memory call history (would be persisted in production)
const callHistory: VideoCall[] = [];

class VideoServiceImpl implements IVideoService {
  async startCall(targetUserId: string): Promise<VideoCall | null> {
    try {
      const call = await createVideoCall('direct', targetUserId);
      callHistory.push(call);
      logger.info('Video call started', { callId: call.callID, target: targetUserId });
      return call;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to start video call', error, { target: targetUserId });
      return null;
    }
  }

  async endCall(callId: string): Promise<void> {
    try {
      const callIndex = callHistory.findIndex((c) => c.callID === callId);
      if (callIndex >= 0) {
        callHistory[callIndex].endedAt = Date.now();
      }
      logger.info('Video call ended', { callId });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to end video call', error, { callId });
    }
  }

  async getActiveCall(): Promise<VideoCall | null> {
    try {
      const activeCalls = getActiveVideoCalls();
      return activeCalls.length > 0 ? activeCalls[0] : null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to get active call', error);
      return null;
    }
  }

  async getCallHistory(): Promise<VideoCall[]> {
    try {
      return callHistory.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } catch {
      // Return empty array on error - non-critical operation
      return [];
    }
  }
}

let _instance: VideoServiceImpl | null = null;

export function getVideoService(): IVideoService {
  if (!_instance) {
    _instance = new VideoServiceImpl();
  }
  return _instance;
}

export function createVideoService(): IVideoService {
  return getVideoService();
}
