/**
 * Audio Participant Service
 *
 * Manages participant join/leave/mute operations.
 */

import { AudioSpaceModel } from '../models/AudioSpace.js';
import { WebRTCAudioService } from './WebRTCAudioService.js';
import { AudioSpaceService } from './AudioSpaceService.js';
import { AUDIO_CONFIG } from '../config/audioConfig.js';
import { getPeerID } from '../../../identity/index.js';
import { DelegationClient } from '@isc/delegation';
import type { AudioMessage } from '../types/audioSpace.js';

export class AudioParticipantService {
  private static instance: AudioParticipantService;

  private constructor() {}

  static getInstance(): AudioParticipantService {
    if (!AudioParticipantService.instance) {
      AudioParticipantService.instance = new AudioParticipantService();
    }
    return AudioParticipantService.instance;
  }

  async join(
    space: AudioSpaceModel,
    onMessageSent: (message: AudioMessage) => Promise<void>
  ): Promise<void> {
    const webRTCService = WebRTCAudioService.getInstance();
    const localStream = await webRTCService.setupLocalStream();
    space.setLocalStream(localStream);

    const peerID = await getPeerID();
    for (const participant of space.participants) {
      if (participant !== peerID) {
        await webRTCService.establishPeerConnection(space, participant, onMessageSent);
      }
    }
  }

  async leave(spaceID: string): Promise<void> {
    const spaceService = AudioSpaceService.getInstance();
    const webRTCService = WebRTCAudioService.getInstance();
    const peerID = await getPeerID();

    const space = spaceService.getSpace(spaceID);
    if (!space) return;

    webRTCService.closeAllConnections();
    space.stopLocalStream();
    space.removeParticipant(peerID);

    if (space.isEmpty()) {
      spaceService.getSpace(spaceID);
    }
  }

  async handleJoin(space: AudioSpaceModel, sender: string): Promise<void> {
    if (!space.hasParticipant(sender)) {
      space.addParticipant(sender);
    }
  }

  async handleLeave(space: AudioSpaceModel, sender: string): Promise<void> {
    const webRTCService = WebRTCAudioService.getInstance();
    space.removeParticipant(sender);
    webRTCService.closePeerConnection(sender);
  }

  async announceJoin(spaceID: string): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    const peerID = await getPeerID();
    await client.announce(
      `/isc/audio/join/${spaceID}`,
      new TextEncoder().encode(JSON.stringify({ peerID, timestamp: Date.now() })),
      AUDIO_CONFIG.messageTTL
    );
  }

  async announceLeave(spaceID: string): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    const peerID = await getPeerID();
    await client.announce(
      `/isc/audio/leave/${spaceID}`,
      new TextEncoder().encode(JSON.stringify({ peerID, timestamp: Date.now() })),
      AUDIO_CONFIG.messageTTL
    );
  }

  async handleAudioMessage(
    message: AudioMessage,
    space: AudioSpaceModel,
    onMessageSent: (message: AudioMessage) => Promise<void>
  ): Promise<void> {
    const webRTCService = WebRTCAudioService.getInstance();

    switch (message.type) {
      case 'offer':
        await webRTCService.handleOffer(
          space,
          message.sender,
          message.data as RTCSessionDescriptionInit,
          onMessageSent
        );
        break;
      case 'answer':
        await webRTCService.handleAnswer(
          message.sender,
          message.data as RTCSessionDescriptionInit
        );
        break;
      case 'ice-candidate':
        await webRTCService.handleIceCandidate(
          message.sender,
          message.data as RTCIceCandidateInit
        );
        break;
      case 'join':
        await this.handleJoin(space, message.sender);
        break;
      case 'leave':
        await this.handleLeave(space, message.sender);
        break;
    }
  }

  async sendAudioMessage(
    spaceID: string,
    recipient: string,
    message: AudioMessage
  ): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    await client.announce(
      `/isc/audio/${spaceID}/${recipient}`,
      new TextEncoder().encode(JSON.stringify(message)),
      AUDIO_CONFIG.messageTTL
    );
  }
}
