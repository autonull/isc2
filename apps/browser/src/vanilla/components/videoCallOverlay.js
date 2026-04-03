/**
 * Video Call Overlay Component
 *
 * Full-screen video call overlay for WebRTC video calls within chats.
 * OOP class with self-contained state and scoped event handling.
 */

import { escapeHtml } from '../utils/dom.js';
import { networkService } from '../../services/network.ts';

const VIDEO_SIGNAL_TYPE = 'video-signal';

class VideoCallComponent {
  #peerId;
  #peerName;
  #overlayEl = null;
  #localStream = null;
  #peerConnection = null;
  #boundHandlers = [];

  constructor(peerId, peerName) {
    this.#peerId = peerId;
    this.#peerName = peerName;
  }

  async start() {
    if (this.#overlayEl) return;

    this.#overlayEl = document.createElement('div');
    this.#overlayEl.className = 'video-overlay';
    this.#overlayEl.setAttribute('data-testid', 'video-overlay');
    this.#overlayEl.innerHTML = `
      <video class="video-remote" autoplay playsinline data-testid="video-remote"></video>
      <video class="video-local" autoplay playsinline muted data-testid="video-local"></video>
      <div class="video-controls">
        <button class="video-ctrl-btn" data-action="mute" aria-label="Mute">🎤</button>
        <button class="video-ctrl-btn" data-action="cam" aria-label="Camera off">📷</button>
        <button class="video-ctrl-btn video-ctrl-end" data-action="hang" aria-label="Hang up">✕</button>
      </div>
      <div class="video-peer-name">${escapeHtml(this.#peerName)}</div>
    `;
    document.body.appendChild(this.#overlayEl);

    this.#bind();

    try {
      await this.#initVideoCall();
    } catch (err) {
      console.error('Video call init failed:', err);
      this.destroy();
    }
  }

  #bind() {
    this.#overlayEl
      .querySelector('[data-action="mute"]')
      ?.addEventListener('click', () => this.#toggleMute());
    this.#overlayEl
      .querySelector('[data-action="cam"]')
      ?.addEventListener('click', () => this.#toggleCamera());
    this.#overlayEl
      .querySelector('[data-action="hang"]')
      ?.addEventListener('click', () => this.destroy());

    const handleVideoSignal = async (e) => {
      const { detail } = e;
      if (!detail || detail.type !== VIDEO_SIGNAL_TYPE) return;

      const { action, sdp, candidate } = detail.payload || {};

      try {
        switch (action) {
          case 'offer':
            await this.#peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await this.#peerConnection?.createAnswer();
            await this.#peerConnection?.setLocalDescription(answer);
            this.#sendSignal({ action: 'answer', sdp: this.#peerConnection?.localDescription });
            break;
          case 'answer':
            await this.#peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp));
            break;
          case 'ice':
            if (candidate) {
              await this.#peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
            }
            break;
          case 'hang-up':
            this.destroy();
            break;
        }
      } catch (err) {
        console.error('Video signal handling failed:', err);
      }
    };

    document.addEventListener('isc:video-signal', handleVideoSignal);
    this.#boundHandlers.push(() =>
      document.removeEventListener('isc:video-signal', handleVideoSignal)
    );
  }

  async #initVideoCall() {
    const localVideo = this.#overlayEl?.querySelector('.video-local');
    const remoteVideo = this.#overlayEl?.querySelector('.video-remote');

    this.#localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    if (localVideo) localVideo.srcObject = this.#localStream;

    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.#peerConnection = new RTCPeerConnection(config);

    this.#localStream.getTracks().forEach((track) => {
      this.#peerConnection?.addTrack(track, this.#localStream);
    });

    this.#peerConnection.ontrack = (event) => {
      if (remoteVideo && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    this.#peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.#sendSignal({ action: 'ice', candidate: event.candidate });
      }
    };

    const offer = await this.#peerConnection.createOffer();
    await this.#peerConnection.setLocalDescription(offer);
    this.#sendSignal({ action: 'offer', sdp: this.#peerConnection.localDescription });
  }

  #sendSignal(payload) {
    document.dispatchEvent(
      new CustomEvent('isc:send-video-signal', {
        detail: { peerId: this.#peerId, payload },
      })
    );
  }

  #toggleMute() {
    if (!this.#localStream) return;
    const audioTrack = this.#localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const btn = this.#overlayEl?.querySelector('[data-action="mute"]');
      if (btn) btn.textContent = audioTrack.enabled ? '🎤' : '🔇';
    }
  }

  #toggleCamera() {
    if (!this.#localStream) return;
    const videoTrack = this.#localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const btn = this.#overlayEl?.querySelector('[data-action="cam"]');
      if (btn) btn.textContent = videoTrack.enabled ? '📷' : '📷‍❌';
    }
  }

  destroy() {
    this.#sendSignal({ action: 'hang-up' });

    if (this.#localStream) {
      this.#localStream.getTracks().forEach((track) => track.stop());
      this.#localStream = null;
    }

    if (this.#peerConnection) {
      this.#peerConnection.close();
      this.#peerConnection = null;
    }

    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];

    if (this.#overlayEl) {
      this.#overlayEl.remove();
      this.#overlayEl = null;
    }
  }
}

let activeCall = null;

export async function openVideoCall(peerId, peerName) {
  if (activeCall) return;
  activeCall = new VideoCallComponent(peerId, peerName);
  await activeCall.start();
}

export function closeVideoCall() {
  if (activeCall) {
    activeCall.destroy();
    activeCall = null;
  }
}
