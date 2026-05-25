/* eslint-disable */
export class AudioSpaceModel {
  spaceID: string;
  channelID: string;
  creator: string;
  participants: string[];
  localStream: MediaStream | null = null;
  remoteStreams: Map<string, MediaStream> = new Map();
  isMuted: boolean = false;
  createdAt: number;

  constructor(data: {
    spaceID: string;
    channelID: string;
    creator: string;
    participants: string[];
    createdAt?: number;
  }) {
    this.spaceID = data.spaceID;
    this.channelID = data.channelID;
    this.creator = data.creator;
    this.participants = [...data.participants];
    this.createdAt = data.createdAt ?? Date.now();
  }

  get participantCount(): number {
    return this.participants.length;
  }

  hasParticipant(peerID: string): boolean {
    return this.participants.includes(peerID);
  }

  addParticipant(peerID: string): void {
    if (!this.hasParticipant(peerID)) {
      this.participants.push(peerID);
    }
  }

  removeParticipant(peerID: string): void {
    this.participants = this.participants.filter((p) => p !== peerID);
    this.remoteStreams.delete(peerID);
  }

  addRemoteStream(peerID: string, stream: MediaStream): void {
    this.remoteStreams.set(peerID, stream);
  }

  isEmpty(): boolean {
    return this.participants.length === 0;
  }

  setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
  }

  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  toggleMute(): boolean {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.isMuted = !this.isMuted;
        audioTracks.forEach((track) => {
          track.enabled = !this.isMuted;
        });
        return this.isMuted;
      }
    }
    return false;
  }
}
