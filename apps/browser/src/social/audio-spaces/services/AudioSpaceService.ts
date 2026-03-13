/**
 * AudioSpace Service
 *
 * Manages audio space lifecycle and state.
 */

import { AudioSpaceModel } from '../models/AudioSpace.js';
import { AUDIO_CONFIG } from '../config/audioConfig.js';
import { getPeerID } from '../../../identity/index.js';
import { getChannel } from '../../../channels/manager.js';
import { DelegationClient } from '../../../delegation/fallback.js';
import type { AudioSpace } from '../types/audioSpace.js';

export class AudioSpaceService {
  private spaces: Map<string, AudioSpaceModel> = new Map();
  private static instance: AudioSpaceService;

  private constructor() {}

  static getInstance(): AudioSpaceService {
    if (!AudioSpaceService.instance) {
      AudioSpaceService.instance = new AudioSpaceService();
    }
    return AudioSpaceService.instance;
  }

  async createSpace(channelID: string): Promise<AudioSpaceModel> {
    const peerID = await getPeerID();

    const channel = await getChannel(channelID);
    if (!channel) {
      throw new Error(`Channel ${channelID} not found`);
    }

    const spaceID = `audio-${Date.now()}-${peerID.slice(0, 8)}`;

    const space = new AudioSpaceModel({
      spaceID,
      channelID,
      creator: peerID,
      participants: [peerID],
    });

    this.spaces.set(spaceID, space);
    await this.announceSpace(space);

    return space;
  }

  async joinSpace(spaceID: string): Promise<AudioSpaceModel> {
    const peerID = await getPeerID();

    let space = this.spaces.get(spaceID);
    if (!space) {
      const fetchedSpace = await this.fetchSpaceFromDHT(spaceID);
      if (!fetchedSpace) {
        throw new Error(`Audio space ${spaceID} not found`);
      }
      space = fetchedSpace;
    }

    if (space.participantCount >= AUDIO_CONFIG.maxParticipants) {
      throw new Error('Audio space is full');
    }

    space.addParticipant(peerID);
    this.spaces.set(spaceID, space);

    return space;
  }

  async leaveSpace(spaceID: string): Promise<void> {
    const peerID = await getPeerID();
    const space = this.spaces.get(spaceID);
    if (!space) return;

    space.removeParticipant(peerID);
    space.stopLocalStream();

    await this.announceLeave(spaceID, peerID);

    if (space.isEmpty()) {
      this.spaces.delete(spaceID);
    } else {
      this.spaces.set(spaceID, space);
    }
  }

  getSpace(spaceID: string): AudioSpaceModel | undefined {
    return this.spaces.get(spaceID);
  }

  getAllSpaces(): AudioSpaceModel[] {
    return Array.from(this.spaces.values());
  }

  toggleMute(spaceID: string): boolean {
    const space = this.spaces.get(spaceID);
    if (!space) {
      throw new Error('Audio space not found');
    }
    return space.toggleMute();
  }

  private async announceSpace(space: AudioSpaceModel): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    const spaceData: AudioSpace = {
      spaceID: space.spaceID,
      channelID: space.channelID,
      creator: space.creator,
      participants: space.participants,
      localStream: space.localStream,
      remoteStreams: space.remoteStreams,
      isMuted: space.isMuted,
      createdAt: space.createdAt,
    };

    await client.announce(
      `/isc/audio/space/${space.spaceID}`,
      new TextEncoder().encode(JSON.stringify(spaceData)),
      AUDIO_CONFIG.spaceAnnounceTTL
    );
  }

  private async announceLeave(spaceID: string, peerID: string): Promise<void> {
    const client = DelegationClient.getInstance();
    if (!client) return;

    await client.announce(
      `/isc/audio/leave/${spaceID}`,
      new TextEncoder().encode(JSON.stringify({ peerID, timestamp: Date.now() })),
      AUDIO_CONFIG.messageTTL
    );
  }

  private async fetchSpaceFromDHT(spaceID: string): Promise<AudioSpaceModel | null> {
    const client = DelegationClient.getInstance();
    if (!client) return null;

    const results = await client.query(`/isc/audio/space/${spaceID}`, 1);
    if (results.length > 0) {
      const decoder = new TextDecoder();
      const data = JSON.parse(decoder.decode(results[0])) as AudioSpace;
      
      const space = new AudioSpaceModel({
        spaceID: data.spaceID,
        channelID: data.channelID,
        creator: data.creator,
        participants: data.participants,
        createdAt: data.createdAt,
      });
      
      space.isMuted = data.isMuted;
      return space;
    }
    return null;
  }

  clear(): void {
    this.spaces.forEach((space) => space.stopLocalStream());
    this.spaces.clear();
  }
}
