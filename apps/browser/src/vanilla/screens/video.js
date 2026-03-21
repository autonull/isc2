/**
 * Video Screen — P2P video calls via WebRTC
 * Lists discovered peers and provides a dial interface.
 * Full WebRTC call UI is in progress; for now, calling routes to Chats.
 */

import { discoveryService } from '../../services/index.js';
import { escapeHtml } from '../../utils/dom.js';
import { toasts } from '../../utils/toast.js';

export function render() {
  const peers = discoveryService.getMatches();

  return `
    <div class="screen" data-testid="video-screen">
      <div class="screen-header" data-testid="video-header">
        <h1 class="screen-title">📹 Video <span class="screen-subtitle">P2P calls</span></h1>
        <a href="#/discover" class="btn btn-ghost btn-sm" aria-label="Find peers to call">📡 Find Peers</a>
      </div>

      <div class="screen-body" data-testid="video-content">
        <div id="video-peer-section">
          ${peers.length > 0 ? renderPeerList(peers) : renderNoPeers()}
        </div>

        <div class="card mt-4" data-testid="video-join-call">
          <div class="card-title">🔗 Dial by Peer ID</div>
          <p class="form-hint mb-3">Have a peer's ID? Enter it to open a direct chat — video calling coming soon.</p>
          <div style="display:flex;gap:8px">
            <input type="text" class="form-input" id="dial-peer-id"
                   placeholder="Peer ID (12D3KooW…)" autocomplete="off"
                   data-testid="dial-peer-input" aria-label="Peer ID to dial" />
            <button class="btn btn-primary" id="dial-btn" data-testid="dial-btn" disabled
                    aria-label="Dial peer">📞 Dial</button>
          </div>
        </div>

        <div class="card card-blue mt-4" data-testid="video-how-it-works">
          <div class="card-title">📹 How P2P Video Works</div>
          <div class="discovery-explainer">
            <div class="discovery-step">
              <span class="discovery-step-icon">🔍</span>
              <div>
                <strong>Discover a peer</strong>
                <p>Use Discover to find someone with similar ideas — matched by semantic embedding, not social graph.</p>
              </div>
            </div>
            <div class="discovery-step">
              <span class="discovery-step-icon">📹</span>
              <div>
                <strong>Click Call</strong>
                <p>Initiate a direct WebRTC session. Your browser negotiates a peer-to-peer media channel — no server touches your video stream.</p>
              </div>
            </div>
            <div class="discovery-step">
              <span class="discovery-step-icon">🔒</span>
              <div>
                <strong>End-to-end encrypted</strong>
                <p>WebRTC mandates DTLS encryption. No ISC server ever receives your audio or video.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderNoPeers() {
  return `
    <div class="empty-state" data-testid="video-no-peers">
      <div class="empty-state-icon">📡</div>
      <div class="empty-state-title">No peers discovered yet</div>
      <div class="empty-state-description">
        Find peers with similar interests first, then you can initiate a video call with them directly.
      </div>
      <a href="#/discover" class="btn btn-primary" data-testid="video-discover-btn">📡 Discover Peers</a>
    </div>
  `;
}

function renderPeerList(peers) {
  return `
    <div class="card" data-testid="video-peer-list">
      <div class="card-title">🔗 Your Peers (${peers.length})</div>
      <p class="form-hint mb-3">
        Full in-browser video call UI is in progress. Clicking Call opens a chat channel with that peer for now.
      </p>
      ${peers.slice(0, 10).map(p => {
        const name = p.identity?.name ?? 'Anonymous';
        const sim  = p.similarity != null ? Math.round(p.similarity * 100) : null;
        return `
          <div class="toggle-row" style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)"
               data-testid="video-peer-${escapeHtml(p.peerId)}">
            <div style="display:flex;align-items:center;gap:10px">
              <div class="chat-avatar">${(name[0] ?? 'A').toUpperCase()}</div>
              <div>
                <div style="font-size:13px;font-weight:500">${escapeHtml(name)}</div>
                ${sim != null ? `<div class="text-muted" style="font-size:11px">${sim}% semantic match</div>` : ''}
              </div>
            </div>
            <button class="btn btn-primary btn-sm"
                    data-call-peer="${escapeHtml(p.peerId)}"
                    data-peer-name="${escapeHtml(name)}"
                    data-testid="call-btn-${escapeHtml(p.peerId)}"
                    aria-label="Call ${escapeHtml(name)}">
              📹 Call
            </button>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function bind(container) {
  const dialInput = container.querySelector('#dial-peer-id');
  const dialBtn   = container.querySelector('#dial-btn');

  dialInput?.addEventListener('input', () => {
    if (dialBtn) dialBtn.disabled = !dialInput.value.trim();
  });

  dialBtn?.addEventListener('click', () => {
    const peerId = dialInput?.value.trim();
    if (!peerId) return;
    routeToChat(peerId);
  });

  container.addEventListener('click', e => {
    const callBtn = e.target.closest('[data-call-peer]');
    if (!callBtn) return;
    const { callPeer, peerName } = callBtn.dataset;
    toasts.info(`Opening chat with ${peerName ?? 'peer'} — full video UI coming soon`);
    routeToChat(callPeer);
  });
}

export function update(container) {
  const section = container.querySelector('#video-peer-section');
  if (!section) return;
  const peers = discoveryService.getMatches();
  section.innerHTML = peers.length > 0 ? renderPeerList(peers) : renderNoPeers();
}

function routeToChat(peerId) {
  window.location.hash = '#/chats';
  setTimeout(() => {
    document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }));
  }, 100);
}
