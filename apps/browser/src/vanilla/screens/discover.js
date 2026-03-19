/**
 * Discover Screen — Find your thought neighbors
 * Runs semantic peer discovery via LSH + DHT, ranked by cosine similarity.
 */

import { discoveryService } from '../../services/index.js';
import { channelService } from '../../services/index.js';
import { networkService } from '../../services/network.js';
import { escapeHtml } from '../../utils/dom.js';
import { toasts } from '../../utils/toast.js';
import { modals } from '../components/modal.js';

export function render() {
  const matches   = discoveryService.getMatches();
  const channels  = channelService.getAll();
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;
  const statusLabel = connected ? 'connected' : (netStatus?.status ?? 'disconnected');

  return `
    <div class="screen discover-screen" data-testid="discover-screen">
      <div class="screen-header" data-testid="discover-header">
        <h1 class="screen-title" data-testid="discover-title">📡 Discover <span class="screen-subtitle">Find thought neighbors</span></h1>
        <div class="header-actions">
          <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="discover-status">
            ${connected ? '● Online' : `○ ${escapeHtml(statusLabel)}`}
          </span>
          <button class="btn btn-primary btn-sm" id="discover-btn"
                  data-testid="discover-peers-btn"
                  ${!connected ? 'disabled title="Connect to network first"' : 'title="Search for semantically similar peers"'}
                  aria-label="Discover peers">
            🔍 Discover
          </button>
        </div>
      </div>

      <div class="screen-body" data-testid="discover-body">
        ${!channels.length ? renderNeedChannels() : ''}
        <div id="discover-content">
          ${matches.length === 0 ? renderEmpty(connected, channels.length > 0) : renderMatches(matches)}
        </div>
      </div>
    </div>
  `;
}

function renderNeedChannels() {
  return `
    <div class="info-banner warning mb-4" data-testid="need-channels-banner">
      ✏️ <strong>Create a channel first</strong> — Discovery uses your channel descriptions to find semantically similar peers.
      <a href="#/compose" class="btn btn-primary btn-sm" style="margin-left:8px">Create Channel</a>
    </div>
  `;
}

function renderEmpty(connected, hasChannels) {
  return `
    <div class="empty-state" data-testid="empty-state">
      <div class="empty-state-icon">🔭</div>
      <div class="empty-state-title">No peers found yet</div>
      <div class="empty-state-description">
        ${!connected
          ? 'Connect to the P2P network to start finding thought neighbors.'
          : !hasChannels
          ? 'Create a channel first — your channel description is your semantic fingerprint.'
          : 'Click Discover to query the DHT for peers with similar embeddings.'}
      </div>
      ${connected && hasChannels
        ? `<button class="btn btn-primary" id="discover-btn-empty" data-testid="empty-discover-btn" aria-label="Start peer discovery">🔍 Start Discovery</button>`
        : !connected
        ? `<p class="text-muted" style="font-size:12px;margin-top:12px">Check your connection in the status bar below</p>`
        : ''}
    </div>

    <div class="card card-blue mt-4">
      <div class="card-title">🎯 How Semantic Discovery Works</div>
      <div class="discovery-explainer">
        <div class="discovery-step">
          <span class="discovery-step-icon">🧠</span>
          <div>
            <strong>Local embedding</strong>
            <p>Your browser runs a tiny LLM to convert your channel description into a 384-dimensional vector. Your text stays on your device.</p>
          </div>
        </div>
        <div class="discovery-step">
          <span class="discovery-step-icon">🗺️</span>
          <div>
            <strong>LSH + DHT lookup</strong>
            <p>Locality-sensitive hashing maps your vector to DHT keys. Peers near you in semantic space have similar hashes.</p>
          </div>
        </div>
        <div class="discovery-step">
          <span class="discovery-step-icon">📐</span>
          <div>
            <strong>Cosine similarity ranking</strong>
            <p>Candidates are ranked by cosine similarity to your vector. 85%+ = very close thinkers. 55-70% = adjacent ideas.</p>
          </div>
        </div>
        <div class="discovery-step">
          <span class="discovery-step-icon">🔒</span>
          <div>
            <strong>Direct P2P connection</strong>
            <p>Click Connect to open an E2E encrypted WebRTC channel. No server sees your messages.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMatches(matches) {
  const sorted = [...matches].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  // Group by similarity tier
  const veryClose = sorted.filter(m => (m.similarity ?? 0) >= 0.85);
  const nearby    = sorted.filter(m => (m.similarity ?? 0) >= 0.70 && (m.similarity ?? 0) < 0.85);
  const orbiting  = sorted.filter(m => (m.similarity ?? 0) >= 0.55 && (m.similarity ?? 0) < 0.70);
  const distant   = sorted.filter(m => (m.similarity ?? 0) < 0.55);

  const sections = [
    { label: '🔥 Very Close',  desc: '85%+',  peers: veryClose, key: 'very-close' },
    { label: '✨ Nearby',       desc: '70–85%', peers: nearby,   key: 'nearby' },
    { label: '🌀 Orbiting',     desc: '55–70%', peers: orbiting, key: 'orbiting' },
    { label: '🌌 Distant',      desc: '<55%',   peers: distant,  key: 'distant' },
  ].filter(s => s.peers.length > 0);

  return `
    <div class="match-stats" data-testid="match-list">
      <span class="text-muted" style="font-size:12px">
        Found <strong>${sorted.length}</strong> peer${sorted.length !== 1 ? 's' : ''}
        in semantic proximity
      </span>
      <button class="btn btn-ghost btn-sm" id="discover-btn-refresh" aria-label="Refresh peer discovery">↻ Refresh</button>
    </div>

    ${sections.map(section => `
      <div class="match-section" data-section="${section.key}">
        <div class="match-section-header">
          <span>${section.label}</span>
          <span class="match-section-range text-muted">${section.desc} similarity</span>
        </div>
        ${section.peers.map(m => renderMatchCard(m)).join('')}
      </div>
    `).join('')}
  `;
}

function renderMatchCard(match) {
  const id       = match.peerId ?? match.peer?.id ?? '';
  const name     = match.identity?.name ?? match.peer?.name ?? 'Anonymous';
  const bio      = match.identity?.bio ?? match.peer?.description ?? '';
  const topics   = match.matchedTopics ?? [];
  const sim      = match.similarity ?? 0;
  const pct      = Math.round(sim * 100);
  const simClass = sim >= 0.85 ? 'very-high' : sim >= 0.70 ? 'high' : sim >= 0.55 ? 'medium' : 'low';
  const simLabel = sim >= 0.85 ? '🔥' : sim >= 0.70 ? '✨' : sim >= 0.55 ? '~' : '';

  return `
    <div class="match-card" data-peer-id="${escapeHtml(id)}" data-component="match-card"
         data-similarity="${pct}" data-testid="match-card-${escapeHtml(id)}">
      <div class="match-header">
        <div class="match-avatar">${(name[0] ?? 'A').toUpperCase()}</div>
        <div class="match-info">
          <div class="match-name" data-testid="match-name">${escapeHtml(name)}</div>
          <div class="match-id text-muted" title="${escapeHtml(id)}">${escapeHtml(id.slice(0, 16))}…</div>
        </div>
        <div class="match-sim-block ${simClass}" data-testid="match-similarity">
          <span class="match-sim-pct">${simLabel} ${pct}%</span>
          <div class="sim-bar-track">
            <div class="sim-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="match-sim-label">match</span>
        </div>
      </div>

      ${bio ? `<p class="match-bio" data-testid="match-bio">${escapeHtml(bio)}</p>` : ''}

      ${topics.length ? `
        <div class="match-topics">
          ${topics.slice(0, 6).map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="match-actions">
        <button class="btn btn-success btn-sm" data-connect-btn data-peer-id="${escapeHtml(id)}" data-peer-name="${escapeHtml(name)}"
                data-testid="connect-btn-${escapeHtml(id)}" aria-label="Connect with ${escapeHtml(name)}">
          🔗 Connect
        </button>
        <button class="btn btn-secondary btn-sm" data-message-btn data-peer-id="${escapeHtml(id)}"
                data-testid="message-btn-${escapeHtml(id)}" aria-label="Message ${escapeHtml(name)}">
          💬 Message
        </button>
      </div>
    </div>
  `;
}

export function bind(container) {
  const doDiscover = async () => {
    const btns = container.querySelectorAll('#discover-btn, #discover-btn-empty, #discover-btn-refresh');
    btns.forEach(b => { b.disabled = true; });
    const mainBtn = container.querySelector('#discover-btn');
    if (mainBtn) mainBtn.innerHTML = '⏳ Searching…';

    try {
      toasts.info('Querying DHT for semantic matches…');
      await discoveryService.discoverPeers();
      const matches = discoveryService.getMatches();
      if (matches.length > 0) {
        toasts.success(`Found ${matches.length} peer${matches.length !== 1 ? 's' : ''} in your semantic neighborhood!`);
      } else {
        toasts.info('No matches found yet — try updating your channel description in Settings.');
      }
      update(container);
    } catch (err) {
      toasts.error(`Discovery failed: ${err.message}`);
    } finally {
      btns.forEach(b => { b.disabled = false; });
      if (mainBtn) mainBtn.innerHTML = '🔍 Discover';
    }
  };

  container.querySelector('#discover-btn')?.addEventListener('click', doDiscover);
  container.querySelector('#discover-btn-empty')?.addEventListener('click', doDiscover);
  container.querySelector('#discover-btn-refresh')?.addEventListener('click', doDiscover);

  container.addEventListener('click', async e => {
    const connectBtn = e.target.closest('[data-connect-btn]');
    const messageBtn = e.target.closest('[data-message-btn]');

    if (connectBtn) {
      const { peerId, peerName } = connectBtn.dataset;
      const ok = await modals.confirm(
        `Connect with ${peerName || 'this peer'}?\n\nThis opens a direct E2E encrypted WebRTC channel. No server is involved.`,
        { title: '🔗 Connect', confirmText: 'Connect', cancelText: 'Cancel' }
      );
      if (ok) {
        connectBtn.disabled = true;
        connectBtn.textContent = '⏳ Connecting…';
        try {
          await discoveryService.connect(peerId);
          toasts.success(`Connected with ${peerName || 'peer'}!`);
          connectBtn.textContent = '✓ Connected';
          connectBtn.classList.add('btn-secondary');
          connectBtn.classList.remove('btn-success');
        } catch (err) {
          toasts.error(`Connection failed: ${err.message}`);
          connectBtn.disabled = false;
          connectBtn.textContent = '🔗 Connect';
        }
      }
    }

    if (messageBtn) {
      window.location.hash = '#/chats';
      // Small delay to let the route render before firing the event
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId: messageBtn.dataset.peerId } }));
      }, 100);
    }
  });
}

export function update(container) {
  const content = container.querySelector('#discover-content');
  if (!content) return;
  const matches   = discoveryService.getMatches();
  const channels  = channelService.getAll();
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;
  content.innerHTML = matches.length === 0
    ? renderEmpty(connected, channels.length > 0)
    : renderMatches(matches);

  // Re-bind the empty-state button
  content.querySelector('#discover-btn-empty')?.addEventListener('click', () =>
    container.querySelector('#discover-btn')?.click()
  );
  content.querySelector('#discover-btn-refresh')?.addEventListener('click', () =>
    container.querySelector('#discover-btn')?.click()
  );
}
