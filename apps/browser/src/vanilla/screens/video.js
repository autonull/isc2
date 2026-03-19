/**
 * Video Screen — Placeholder for video call functionality
 */

export function render() {
  return `
    <div class="screen" data-testid="video-screen">
      <div class="screen-header" data-testid="video-header">
        <h1 class="screen-title">📹 Video</h1>
      </div>
      <div class="video-screen" data-testid="video-content">
        <div class="empty-state">
          <div class="empty-state-icon">📹</div>
          <div class="empty-state-title">Video Calls</div>
          <div class="empty-state-description">
            Peer-to-peer video calls via WebRTC. Coming soon — connect with discovered peers to initiate a call.
          </div>
          <a href="#/discover" class="btn btn-primary">📡 Discover Peers</a>
        </div>
      </div>
    </div>
  `;
}

export function bind(_container) {
  // Placeholder — video call UI will go here
}

export function update(_container) {}
