/**
 * Discover Screen
 *
 * Find semantic peer matches via LSH + DHT, ranked by cosine similarity.
 */

import { discoveryService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { toasts } from '../../utils/toast.js';
import { modals } from '../components/modal.js';
import { escapeHtml } from '../utils/dom.js';
import { renderEmpty, bindDelegate } from '../utils/screen.js';

const SIMILARITY_TIERS = [
  { key: 'very-close', label: '🔥 Very Close', desc: '85%+', min: 0.85 },
  { key: 'nearby', label: '✨ Nearby', desc: '70–85%', min: 0.70, max: 0.85 },
  { key: 'orbiting', label: '🌀 Orbiting', desc: '55–70%', min: 0.55, max: 0.70 },
  { key: 'distant', label: '🌌 Distant', desc: '<55%', max: 0.55 },
];

export function render() {
  const matches = discoveryService.getMatches();
  const channels = channelService.getAll();
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;
  const statusLabel = connected ? 'connected' : (netStatus?.status ?? 'disconnected');

  return `
    <div class="screen discover-screen" data-testid="discover-screen">
      ${renderHeader(connected, statusLabel)}
      <div class="screen-body" data-testid="discover-body">
        ${!channels.length ? renderNeedChannels() : ''}
        <div id="discover-content">
          ${matches.length === 0 ? renderEmptyState(connected, channels) : renderMatches(matches)}
        </div>
      </div>
    </div>
  `;
}

function renderHeader(connected, statusLabel) {
  return `
    <div class="screen-header" data-testid="discover-header">
      <h1 class="screen-title" data-testid="discover-title">
        📡 Discover <span class="screen-subtitle">Find thought neighbors</span>
      </h1>
      <div class="header-actions">
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="discover-status">
          ${connected ? '● Online' : `○ ${escapeHtml(statusLabel)}`}
        </span>
        <button class="btn btn-primary btn-sm" id="discover-btn"
                data-testid="discover-peers-btn"
                ${!connected ? 'disabled title="Connect to network first"' : ''}
                aria-label="Discover peers">
          🔍 Discover
        </button>
      </div>
    </div>
  `;
}

function renderNeedChannels() {
  return `
    <div class="info-banner warning mb-4" data-testid="need-channels-banner">
      ✏️ <strong>Create a channel first</strong> — Discovery uses your channel descriptions to find similar peers.
      <a href="#/compose" class="btn btn-primary btn-sm" style="margin-left:8px">Create Channel</a>
    </div>
  `;
}

function renderEmptyState(connected, channels) {
  const description = !connected
    ? 'Connect to the P2P network to start finding thought neighbors.'
    : !channels.length
      ? 'Create a channel first — your channel description is your semantic fingerprint.'
      : 'Click Discover to query the DHT for peers with similar embeddings.';

  const action = connected && channels.length
    ? [{ label: '🔍 Start Discovery', action: 'discover', variant: 'primary' }]
    : [];

  return `
    ${renderEmpty({
      icon: '🔭',
      title: 'No peers found yet',
      description,
      actions: action,
    })}

    <div class="card card-blue mt-4">
      <div class="card-title">🎯 How Semantic Discovery Works</div>
      <div class="discovery-explainer">
        ${renderExplainerStep('🧠', 'Local embedding', 'Your browser runs a tiny LLM to convert your channel description into a 384-dimensional vector. Your text stays on your device.')}
        ${renderExplainerStep('🗺️', 'LSH + DHT lookup', 'Locality-sensitive hashing maps your vector to DHT keys. Peers near you in semantic space have similar hashes.')}
        ${renderExplainerStep('📐', 'Cosine similarity ranking', 'Candidates are ranked by cosine similarity to your vector. 85%+ = very close thinkers. 55-70% = adjacent ideas.')}
        ${renderExplainerStep('🔒', 'Direct P2P connection', 'Click Connect to open an E2E encrypted WebRTC channel. No server sees your messages.')}
      </div>
    </div>
  `;
}

function renderExplainerStep(icon, title, desc) {
  return `
    <div class="discovery-step">
      <span class="discovery-step-icon">${icon}</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(desc)}</p>
      </div>
    </div>
  `;
}

function renderMatches(matches) {
  const sorted = [...matches].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  const sections = SIMILARITY_TIERS
    .map(tier => ({
      ...tier,
      peers: sorted.filter(m => {
        const sim = m.similarity ?? 0;
        return sim >= (tier.min ?? 0) && sim < (tier.max ?? 1);
      }),
    }))
    .filter(s => s.peers.length > 0);

  return `
    <div class="match-stats" data-testid="match-list">
      <span class="text-muted" style="font-size:12px">
        Found <strong>${sorted.length}</strong> peer${sorted.length !== 1 ? 's' : ''} in semantic proximity
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
  const id = match.peerId ?? match.peer?.id ?? '';
  const name = match.identity?.name ?? match.peer?.name ?? 'Anonymous';
  const bio = match.identity?.bio ?? match.peer?.description ?? '';
  const topics = match.matchedTopics ?? [];
  const sim = match.similarity ?? 0;
  const pct = Math.round(sim * 100);
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
      ${topics.length ? `<div class="match-topics">${topics.slice(0, 6).map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}

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
    const mainBtn = container.querySelector('#discover-btn');

    btns.forEach(b => b.disabled = true);
    if (mainBtn) mainBtn.innerHTML = '⏳ Searching…';

    try {
      toasts.info('Querying DHT for semantic matches…');
      await discoveryService.discoverPeers();
      const matches = discoveryService.getMatches();
      toasts.success(matches.length ? `Found ${matches.length} peer${matches.length !== 1 ? 's' : ''}!` : 'No matches found');
      update(container);
    } catch (err) {
      toasts.error(`Discovery failed: ${err.message}`);
    } finally {
      btns.forEach(b => b.disabled = false);
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
      const ok = await modals.confirm(`Connect with ${peerName || 'this peer'}?`, {
        title: '🔗 Connect',
        confirmText: 'Connect',
      });
      if (ok) {
        connectBtn.disabled = true;
        connectBtn.textContent = '⏳ Connecting…';
        try {
          await discoveryService.connect(peerId);
          toasts.success(`Connected with ${peerName || 'peer'}!`);
          connectBtn.textContent = '✓ Connected';
          connectBtn.className = 'btn btn-secondary btn-sm';
        } catch (err) {
          toasts.error(`Connection failed: ${err.message}`);
          connectBtn.disabled = false;
          connectBtn.textContent = '🔗 Connect';
          connectBtn.className = 'btn btn-success btn-sm';
        }
      }
    }

    if (messageBtn) {
      window.location.hash = '#/chats';
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId: messageBtn.dataset.peerId } }));
      }, 100);
    }
  });
}

export function update(container) {
  const content = container.querySelector('#discover-content');
  if (!content) return;

  const matches = discoveryService.getMatches();
  const channels = channelService.getAll();
  const connected = networkService.getStatus()?.connected ?? false;

  content.innerHTML = matches.length === 0
    ? renderEmptyState(connected, channels)
    : renderMatches(matches);

  // Re-bind buttons in refreshed content
  content.querySelector('#discover-btn-empty')?.addEventListener('click', () => {
    container.querySelector('#discover-btn')?.click();
  });
  content.querySelector('#discover-btn-refresh')?.addEventListener('click', () => {
    container.querySelector('#discover-btn')?.click();
  });
}
