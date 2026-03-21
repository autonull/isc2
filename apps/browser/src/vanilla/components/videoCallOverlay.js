/**
 * Video Call Overlay Component
 *
 * Full-screen video call overlay for WebRTC video calls within chats.
 * Covers the entire app viewport over the active chat.
 */

import { escapeHtml } from '../../utils/dom.js';
import { networkService } from '../../services/network.ts';

let overlayEl = null;
let localStream = null;
let peerConnection = null;

const VIDEO_SIGNAL_TYPE = 'video-signal';

export async function openVideoCall(peerId, peerName) {
  if (overlayEl) return; // call already active

  overlayEl = document.createElement('div');
  overlayEl.className = 'video-overlay';
  overlayEl.setAttribute('data-testid', 'video-overlay');
  overlayEl.innerHTML = `
    <video class="video-remote" autoplay playsinline data-testid="video-remote"></video>
    <video class="video-local" autoplay playsinline muted data-testid="video-local"></video>
    <div class="video-controls">
      <button class="video-ctrl-btn" id="vc-mute" aria-label="Mute">🎤</button>
      <button class="video-ctrl-btn" id="vc-cam" aria-label="Camera off">📷</button>
      <button class="video-ctrl-btn video-ctrl-end" id="vc-hang" aria-label="Hang up">✕</button>
    </div>
    <div class="video-peer-name">${escapeHtml(peerName)}</div>
  `;
  document.body.appendChild(overlayEl);

  overlayEl.querySelector('#vc-hang')?.addEventListener('click', () => closeVideoCall());
  overlayEl.querySelector('#vc-mute')?.addEventListener('click', toggleMute);
  overlayEl.querySelector('#vc-cam')?.addEventListener('click', toggleCamera);

  try {
    await initVideoCall(peerId);
  } catch (err) {
    console.error('Video call init failed:', err);
    closeVideoCall();
  }
}

export function closeVideoCall() {
  stopLocalStream();
  closePeerConnection();
  overlayEl?.remove();
  overlayEl = null;
}

async function initVideoCall(peerId) {
  const localVideo = overlayEl?.querySelector('.video-local');
  const remoteVideo = overlayEl?.querySelector('.video-remote');

  // Get local media
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    });
    if (localVideo) localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Failed to get media:', err);
    throw err;
  }

  // Create peer connection
  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };
  peerConnection = new RTCPeerConnection(config);

  // Add local tracks
  localStream.getTracks().forEach((track) => {
    peerConnection?.addTrack(track, localStream);
  });

  // Handle remote tracks
  peerConnection.ontrack = (event) => {
    if (remoteVideo && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    }
  };

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      sendVideoSignal(peerId, { action: 'ice', candidate: event.candidate });
    }
  };

  // Create and send offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  sendVideoSignal(peerId, { action: 'offer', sdp: peerConnection.localDescription });

  // Listen for incoming video signals
  setupVideoSignalHandler(peerId);
}

function setupVideoSignalHandler(peerId) {
  const handleVideoSignal = async (e) => {
    const { detail } = e;
    if (!detail || detail.type !== VIDEO_SIGNAL_TYPE) return;

    const { action, sdp, candidate } = detail.payload || {};

    try {
      switch (action) {
        case 'offer':
          await peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await peerConnection?.createAnswer();
          await peerConnection?.setLocalDescription(answer);
          sendVideoSignal(peerId, { action: 'answer', sdp: peerConnection?.localDescription });
          break;

        case 'answer':
          await peerConnection?.setRemoteDescription(new RTCSessionDescription(sdp));
          break;

        case 'ice':
          if (candidate) {
            await peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
          }
          break;

        case 'hang-up':
          closeVideoCall();
          break;
      }
    } catch (err) {
      console.error('Video signal handling failed:', err);
    }
  };

  document.addEventListener('isc:video-signal', handleVideoSignal);

  // Cleanup on close
  const originalClose = closeVideoCall;
  closeVideoCall = function () {
    document.removeEventListener('isc:video-signal', handleVideoSignal);
    sendVideoSignal(peerId, { action: 'hang-up' });
    originalClose();
  };
}

function sendVideoSignal(peerId, payload) {
  // Dispatch custom event for the network layer to handle
  document.dispatchEvent(
    new CustomEvent('isc:send-video-signal', {
      detail: { peerId, payload },
    })
  );
}

function stopLocalStream() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
}

function closePeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
}

function toggleMute() {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    const btn = overlayEl?.querySelector('#vc-mute');
    if (btn) btn.textContent = audioTrack.enabled ? '🎤' : '🔇';
  }
}

function toggleCamera() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    const btn = overlayEl?.querySelector('#vc-cam');
    if (btn) btn.textContent = videoTrack.enabled ? '📷' : '📷‍❌';
  }
}
