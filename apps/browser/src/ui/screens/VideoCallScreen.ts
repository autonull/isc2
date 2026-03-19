import { UIComponent } from '../Component.js';

interface VideoCallState {
  inCall: boolean;
  peerId: string;
}

export class VideoCallScreen extends UIComponent<any, VideoCallState> {
  private localStream: MediaStream | null = null;
  private callSub: any = null;

  constructor(props: any) {
    super('div', props, { inCall: false, peerId: '' });
    this.element.className = 'screen video-call-screen';
  }

  protected async onMount() {
    const { video } = this.props.dependencies || {};
    if (video && video.onCallEvent) {
      this.callSub = video.onCallEvent((event: any) => {
        if (event.type === 'incoming') {
          if (confirm(`Incoming call from ${event.peerId}. Accept?`)) {
            this.acceptCall(event.peerId);
          } else {
            video.rejectCall(event.peerId);
          }
        } else if (event.type === 'ended') {
          this.endCall();
        } else if (event.type === 'stream') {
          const remoteVideo = this.element.querySelector('#remoteVideo') as HTMLVideoElement;
          if (remoteVideo) remoteVideo.srcObject = event.stream;
        }
      });
    }
  }

  protected onUnmount() {
    if (this.callSub) this.callSub();
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
    }
  }

  private async acceptCall(peerId: string) {
    await this.startLocalVideo();
    const { video } = this.props.dependencies || {};
    if (video) {
      video.acceptCall(peerId, this.localStream);
      this.setState({ inCall: true, peerId });
    }
  }

  private endCall() {
    const { video } = this.props.dependencies || {};
    if (video) video.endCall(this.state.peerId);
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    const localVideo = this.element.querySelector('#localVideo') as HTMLVideoElement;
    const remoteVideo = this.element.querySelector('#remoteVideo') as HTMLVideoElement;
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    this.setState({ inCall: false, peerId: '' });
  }

  private async startLocalVideo() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const localVideo = this.element.querySelector('#localVideo') as HTMLVideoElement;
      if (localVideo) localVideo.srcObject = this.localStream;
    } catch (e) {
      console.error('Failed to get local media', e);
      alert('Could not access camera/microphone.');
    }
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header" style="padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">🎥 Video Calls</h2>
          <p style="font-size: 14px; color: #657786; margin: 4px 0 0 0;">Secure P2P WebRTC calls.</p>
        </div>
      </div>

      <div id="setup-view" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; background: #f5f8fa;">
        <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); text-align: center; max-width: 400px; width: 100%;">
          <div style="font-size: 48px; margin-bottom: 20px;">📞</div>
          <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #14171a;">Start a Call</h3>
          <input type="text" id="target-peer" placeholder="Enter Peer ID..." style="width: 100%; padding: 12px; border: 1px solid #e1e8ed; border-radius: 8px; margin-bottom: 16px; font-size: 14px; box-sizing: border-box;" />
          <button id="call-btn" style="width: 100%; padding: 12px; background: #1da1f2; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 16px; cursor: pointer;">Call Peer</button>
        </div>
      </div>

      <div id="call-view" style="display: none; flex: 1; flex-direction: column; background: #14171a; position: relative;">
        <!-- Similarity Badge Placeholder -->
        <div style="position: absolute; top: 20px; right: 20px; background: rgba(0,0,0,0.6); color: white; padding: 6px 12px; border-radius: 16px; font-size: 13px; font-weight: bold; z-index: 10; display: flex; align-items: center; gap: 6px;">
          <span style="color: #17bf63;">●</span> 85% Match
        </div>

        <div style="flex: 1; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          <video id="remoteVideo" autoplay style="width: 100%; height: 100%; object-fit: cover; background: #000;"></video>

          <!-- Local PIP -->
          <div style="position: absolute; bottom: 20px; right: 20px; width: 160px; height: 120px; background: #000; border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2); box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <video id="localVideo" autoplay muted style="width: 100%; height: 100%; object-fit: cover;"></video>
          </div>
        </div>

        <!-- Bottom Controls -->
        <div style="padding: 20px; background: rgba(0,0,0,0.8); display: flex; justify-content: center; gap: 20px;">
          <button id="mute-btn" style="width: 50px; height: 50px; border-radius: 25px; border: none; background: rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center;">🎤</button>
          <button id="camera-btn" style="width: 50px; height: 50px; border-radius: 25px; border: none; background: rgba(255,255,255,0.2); color: white; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center;">📹</button>
          <button id="end-btn" style="width: 60px; height: 50px; border-radius: 25px; border: none; background: #e0245e; color: white; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(224,36,94,0.4);">✖</button>
        </div>
      </div>
    `;

    const callBtn = this.element.querySelector('#call-btn');
    const endBtn = this.element.querySelector('#end-btn');
    const input = this.element.querySelector('#target-peer') as HTMLInputElement;
    const muteBtn = this.element.querySelector('#mute-btn');
    const cameraBtn = this.element.querySelector('#camera-btn');

    callBtn?.addEventListener('click', async () => {
      const peerId = input.value.trim();
      if (!peerId) return;

      await this.startLocalVideo();
      const { video } = this.props.dependencies || {};
      if (video) {
        video.initiateCall(peerId, this.localStream);
        this.setState({ inCall: true, peerId });
      }
    });

    endBtn?.addEventListener('click', () => this.endCall());

    // Basic local state toggles for mic/camera visual feedback (Phase 3 spec)
    let micMuted = false;
    muteBtn?.addEventListener('click', () => {
      if (!this.localStream) return;
      micMuted = !micMuted;
      this.localStream.getAudioTracks().forEach(t => t.enabled = !micMuted);
      (muteBtn as HTMLElement).style.background = micMuted ? 'rgba(255,0,0,0.5)' : 'rgba(255,255,255,0.2)';
    });

    let cameraOff = false;
    cameraBtn?.addEventListener('click', () => {
      if (!this.localStream) return;
      cameraOff = !cameraOff;
      this.localStream.getVideoTracks().forEach(t => t.enabled = !cameraOff);
      (cameraBtn as HTMLElement).style.background = cameraOff ? 'rgba(255,0,0,0.5)' : 'rgba(255,255,255,0.2)';
    });
  }

  protected update(prevState: VideoCallState) {
    const setupView = this.element.querySelector('#setup-view') as HTMLElement;
    const callView = this.element.querySelector('#call-view') as HTMLElement;

    if (!setupView || !callView) return;

    if (this.state.inCall) {
      setupView.style.display = 'none';
      callView.style.display = 'flex';
    } else {
      setupView.style.display = 'flex';
      callView.style.display = 'none';
    }
  }
}
