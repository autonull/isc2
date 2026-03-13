/**
 * Audio Stream Utilities
 */

import type { AudioSpace } from '../types/audioSpace.js';

/**
 * Toggle mute state on audio space
 */
export function toggleMuteState(space: AudioSpace): boolean {
  space.isMuted = !space.isMuted;
  
  if (space.localStream) {
    space.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !space.isMuted;
    });
  }
  
  return space.isMuted;
}

/**
 * Stop and cleanup local stream
 */
export function cleanupLocalStream(space: AudioSpace): void {
  if (space.localStream) {
    space.localStream.getTracks().forEach((track) => track.stop());
    space.localStream = null;
  }
}

/**
 * Add remote stream for peer
 */
export function addRemoteStream(
  space: AudioSpace,
  peerID: string,
  stream: MediaStream
): void {
  space.remoteStreams.set(peerID, stream);
}

/**
 * Remove remote stream for peer
 */
export function removeRemoteStream(
  space: AudioSpace,
  peerID: string
): void {
  space.remoteStreams.delete(peerID);
}

/**
 * Get all active remote streams
 */
export function getActiveRemoteStreams(
  space: AudioSpace
): Map<string, MediaStream> {
  return new Map(space.remoteStreams);
}

/**
 * Check if space has active audio
 */
export function hasActiveAudio(space: AudioSpace): boolean {
  return space.localStream !== null && !space.isMuted;
}

/**
 * Get participant count
 */
export function getParticipantCount(space: AudioSpace): number {
  return space.participants.length;
}

/**
 * Check if space is full
 */
export function isSpaceFull(
  space: AudioSpace,
  maxParticipants: number
): boolean {
  return space.participants.length >= maxParticipants;
}
