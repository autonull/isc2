/**
 * Audio Spaces - Legacy Compatibility Layer
 *
 * @deprecated Use the modular audio-spaces module instead:
 * - AudioSpaceService for space management
 * - WebRTCAudioService for WebRTC connections
 * - AudioParticipantService for participant handling
 */

import { AudioSpaceService } from './audio-spaces/services/AudioSpaceService.js';
import { AudioParticipantService } from './audio-spaces/services/AudioParticipantService.js';
import type { AudioSpace, AudioMessage } from './audio-spaces/types/audioSpace.js';

const spaceService = AudioSpaceService.getInstance();
const participantService = AudioParticipantService.getInstance();

export type { AudioSpace, AudioMessage };

export async function createAudioSpace(channelID: string): Promise<AudioSpace> {
  const space = await spaceService.createSpace(channelID);
  return space;
}

export async function joinAudioSpace(spaceID: string): Promise<AudioSpace> {
  const space = await spaceService.joinSpace(spaceID);
  
  await participantService.join(space, async (message) => {
    await participantService.sendAudioMessage(space.spaceID, space.creator, message);
  });
  
  return space;
}

export async function leaveAudioSpace(spaceID: string): Promise<void> {
  await participantService.leave(spaceID);
  await spaceService.leaveSpace(spaceID);
}

export async function toggleMute(spaceID: string): Promise<boolean> {
  return spaceService.toggleMute(spaceID);
}

export function getAudioSpace(spaceID: string): AudioSpace | undefined {
  return spaceService.getSpace(spaceID);
}

export function getAllActiveSpaces(): AudioSpace[] {
  return spaceService.getAllSpaces();
}

export async function handleAudioMessage(message: AudioMessage): Promise<void> {
  const space = spaceService.getSpace(message.spaceID);
  if (!space) return;

  await participantService.handleAudioMessage(
    message,
    space,
    async (msg) => {
      await participantService.sendAudioMessage(msg.spaceID, msg.sender, msg);
    }
  );
}
