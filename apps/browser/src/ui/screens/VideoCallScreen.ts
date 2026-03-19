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
      <div class="channel-header">
        <h2>📹 Video Calls</h2>
        <p>Start a secure WebRTC video call.</p>
      </div>
      <div id="call-controls" style="margin-bottom: 20px;">
        <input type="text" id="target-peer" placeholder="Peer ID to call" />
        <button id="call-btn">Call</button>
        <button id="end-btn" style="display: none; background: red; color: white;">End Call</button>
      </div>
      <div class="video-container" style="display: flex; gap: 10px;">
        <video id="localVideo" autoplay muted style="width: 300px; background: #000;"></video>
        <video id="remoteVideo" autoplay style="width: 300px; background: #000;"></video>
      </div>
    `;

    const callBtn = this.element.querySelector('#call-btn');
    const endBtn = this.element.querySelector('#end-btn');
    const input = this.element.querySelector('#target-peer') as HTMLInputElement;

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
  }

  protected update(prevState: VideoCallState) {
    const callBtn = this.element.querySelector('#call-btn') as HTMLElement;
    const endBtn = this.element.querySelector('#end-btn') as HTMLElement;
    const input = this.element.querySelector('#target-peer') as HTMLInputElement;

    if (this.state.inCall) {
      callBtn.style.display = 'none';
      input.style.display = 'none';
      endBtn.style.display = 'inline-block';
    } else {
      callBtn.style.display = 'inline-block';
      input.style.display = 'inline-block';
      endBtn.style.display = 'none';
    }
  }
}
