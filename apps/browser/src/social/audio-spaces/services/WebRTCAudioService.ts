/**
 * WebRTC Audio Service
 *
 * Manages peer connections and audio streams.
 */

import { AUDIO_CONFIG } from '../config/audioConfig.js';
import { AudioSpaceModel } from '../models/AudioSpace.js';
import { getPeerID } from '../../../identity/index.js';
import type { AudioMessage } from '../types/audioSpace.js';

type PeerConnectionMap = Map<string, RTCPeerConnection>;

export class WebRTCAudioService {
  private peerConnections: PeerConnectionMap = new Map();
  private static instance: WebRTCAudioService;

  private constructor() {}

  static getInstance(): WebRTCAudioService {
    if (!WebRTCAudioService.instance) {
      WebRTCAudioService.instance = new WebRTCAudioService();
    }
    return WebRTCAudioService.instance;
  }

  async setupLocalStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONFIG.audioConstraints,
        video: false,
      });
      return stream;
    } catch {
      throw new Error('Unable to access microphone');
    }
  }

  async createPeerConnection(
    space: AudioSpaceModel,
    remotePeer: string,
    onIceCandidate: (candidate: RTCIceCandidate) => Promise<void>,
    onRemoteStream: (stream: MediaStream) => void
  ): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({ iceServers: AUDIO_CONFIG.iceServers });
    this.peerConnections.set(remotePeer, pc);

    if (space.localStream) {
      space.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, space.localStream!);
      });
    }

    pc.ontrack = (event) => {
      onRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await onIceCandidate(event.candidate);
      }
    };

    return pc;
  }

  async establishPeerConnection(
    space: AudioSpaceModel,
    remotePeer: string,
    sendMessage: (message: AudioMessage) => Promise<void>
  ): Promise<void> {
    const pc = await this.createPeerConnection(
      space,
      remotePeer,
      async (candidate) => {
        await sendMessage({
          type: 'ice-candidate',
          spaceID: space.spaceID,
          sender: await getPeerID(),
          data: candidate,
          timestamp: Date.now(),
        });
      },
      (stream) => {
        space.addRemoteStream(remotePeer, stream);
      }
    );

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await sendMessage({
      type: 'offer',
      spaceID: space.spaceID,
      sender: await getPeerID(),
      data: offer,
      timestamp: Date.now(),
    });
  }

  async handleOffer(
    space: AudioSpaceModel,
    sender: string,
    offer: RTCSessionDescriptionInit,
    sendMessage: (message: AudioMessage) => Promise<void>
  ): Promise<void> {
    let pc = this.peerConnections.get(sender);
    if (!pc) {
      pc = await this.createPeerConnection(
        space,
        sender,
        async (candidate) => {
          await sendMessage({
            type: 'ice-candidate',
            spaceID: space.spaceID,
            sender: await getPeerID(),
            data: candidate,
            timestamp: Date.now(),
          });
        },
        (stream) => {
          space.addRemoteStream(sender, stream);
        }
      );
    }

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendMessage({
      type: 'answer',
      spaceID: space.spaceID,
      sender: await getPeerID(),
      data: answer,
      timestamp: Date.now(),
    });
  }

  async handleAnswer(
    sender: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    const pc = this.peerConnections.get(sender);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  }

  async handleIceCandidate(
    sender: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const pc = this.peerConnections.get(sender);
    if (pc) {
      await pc.addIceCandidate(candidate);
    }
  }

  closePeerConnection(peerID: string): void {
    const pc = this.peerConnections.get(peerID);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerID);
    }
  }

  closeAllConnections(): void {
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
  }

  getPeerConnection(peerID: string): RTCPeerConnection | undefined {
    return this.peerConnections.get(peerID);
  }

  clear(): void {
    this.peerConnections.clear();
  }
}
