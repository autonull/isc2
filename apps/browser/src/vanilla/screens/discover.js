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
import { renderEmpty, bindDelegate, renderLoading } from '../utils/screen.js';
import { getBridgeMomentCandidates, markPeerContacted } from '../../services/peerProximity.ts';
import { convergenceService } from '../../services/convergence.ts';

let bridgeCandidates = [];
let convergenceEvent = null;
let noMatchesBannerEl = null;
let autoDiscovered = false;
let activeCallout = null;

const CALLOUT_PRIORITY = ['need-channels', 'no-matches', 'convergence', 'bridge'];

const SIMILARITY_TIERS = [
  { key: 'strong', label: '🔥 Strong match', desc: '85%+', min: 0.85 },
  { key: 'good', label: '✨ Good match', desc: '70–85%', min: 0.70, max: 0.85 },
  { key: 'partial', label: '🌀 Partial match', desc: '55–70%', min: 0.55, max: 0.70 },
  { key: 'weak', label: '🌌 Weak match', desc: '<55%', max: 0.55 },
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
        <div id="bridge-moment-container"></div>
        <div id="convergence-container"></div>
        <div id="discover-content">
          ${matches.length === 0 ? renderEmptyState(connected, channels) : renderMatches(matches)}
        </div>
      </div>
    </div>
  `;
}

function showNoMatchesBanner(container) {
  dismissNoMatchesBanner();
  noMatchesBannerEl = document.createElement('div');
  noMatchesBannerEl.className = 'info-banner warning';
  noMatchesBannerEl.setAttribute('data-testid', 'no-matches-banner');
  noMatchesBannerEl.innerHTML =
    "🌀 You're the first one here with this thought. Try broadening your channel description or wait for more peers to discover you.";
  container.querySelector('#discover-content')?.prepend(noMatchesBannerEl);
}

function dismissNoMatchesBanner() {
  noMatchesBannerEl?.remove();
  noMatchesBannerEl = null;
}

function showCallout(container, type, content) {
  const currentPrio = CALLOUT_PRIORITY.indexOf(activeCallout);
  const newPrio = CALLOUT_PRIORITY.indexOf(type);
  if (activeCallout && newPrio > currentPrio) return;

  dismissCallout(container);
  activeCallout = type;

  const el = document.createElement('div');
  el.className = 'discover-callout';
  el.setAttribute('data-callout-type', type);
  el.innerHTML = content;
  container.querySelector('#discover-content')?.before(el);
}

function dismissCallout(container) {
  container.querySelector('.discover-callout')?.remove();
  activeCallout = null;
}

async function loadBridgeMomentBanner(container) {
  const containerEl = container.querySelector('#bridge-moment-container');
  if (!containerEl) return;

  try {
    const candidates = await getBridgeMomentCandidates();
    if (candidates.length > 0) {
      containerEl.innerHTML = renderBridgeMomentBanner(candidates[0]);

      containerEl.querySelector('#bridge-say-hello')?.addEventListener('click', async (e) => {
        const peerId = e.target.dataset.peerId;
        if (peerId) {
          await markPeerContacted(peerId);
          window.location.hash = '#/chats';
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }));
          }, 100);
          loadBridgeMomentBanner(container);
        }
      });

      containerEl.querySelector('#bridge-dismiss')?.addEventListener('click', async (e) => {
        const peerId = e.target.dataset.peerId;
        if (peerId) {
          await markPeerContacted(peerId);
          loadBridgeMomentBanner(container);
        }
      });
    } else {
      containerEl.innerHTML = '';
    }
  } catch (err) {
    containerEl.innerHTML = '';
  }
}

function renderBridgeMomentBanner(candidate) {
  return `
    <div class="bridge-moment-banner" id="bridge-moment-banner" data-testid="bridge-moment-banner">
      <div class="bridge-moment-content">
        <span class="bridge-icon">🌀</span>
        <div class="bridge-moment-text">
          <strong>You've been near this peer for ${candidate.daysSinceFirstSeen} days</strong>
          <span class="text-muted">Your channels are ~${Math.round(candidate.avgCosine * 100)}% similar · ${candidate.sessionCount} sessions</span>
        </div>
      </div>
      <div class="bridge-moment-actions">
        <button class="btn btn-primary btn-sm" id="bridge-say-hello" data-peer-id="${candidate.peerId}">Say hello</button>
        <button class="btn btn-ghost btn-sm" id="bridge-dismiss" data-peer-id="${candidate.peerId}">Dismiss</button>
      </div>
    </div>
  `;
}

function renderConvergenceBanner(event) {
  const minutes = Math.round(event.duration / 60000);

  return `
    <div class="convergence-banner" id="convergence-banner" data-testid="convergence-banner">
      <div class="convergence-content">
        <span class="convergence-icon">💫</span>
        <div class="convergence-text">
          <strong>${event.peerCount} people arrived at the same thought</strong>
          <span class="text-muted">in the last ${minutes} minutes · No algorithm selected this</span>
        </div>
      </div>
      <div class="convergence-actions">
        <button class="btn btn-primary btn-sm" id="convergence-view">View</button>
        <button class="btn btn-ghost btn-sm" id="convergence-share">Share</button>
      </div>
    </div>
  `;
}

async function loadConvergenceBanner(container) {
  const containerEl = container.querySelector('#convergence-container');
  if (!containerEl) return;

  try {
    const events = convergenceService.getActiveConvergences();

    if (events.length > 0) {
      const event = events[0];
      convergenceEvent = event;
      containerEl.innerHTML = renderConvergenceBanner(event);

      containerEl.querySelector('#convergence-view')?.addEventListener('click', () => {
        // Open Space View focused on convergence region
        window.location.hash = '#/space';
      });

      containerEl.querySelector('#convergence-share')?.addEventListener('click', () => {
        generateConvergenceCard(event);
      });
    } else {
      containerEl.innerHTML = '';
      convergenceEvent = null;
    }
  } catch (err) {
    containerEl.innerHTML = '';
  }
}

function generateConvergenceCard(event) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1d26';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Gradient overlay
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.2)');
  gradient.addColorStop(1, 'rgba(236, 72, 153, 0.1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Title
  ctx.fillStyle = '#d8dce6';
  ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${event.peerCount} people converged on the same idea`, canvas.width / 2, 200);

  // Subtitle
  ctx.fillStyle = '#9099ad';
  ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Discovered in ISC · isc2.example', canvas.width / 2, 260);

  // Decorative circles
  const colors = ['#4a90d9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
  for (let i = 0; i < event.peerCount && i < 12; i++) {
    const x = 200 + (i % 6) * 150 + Math.random() * 40;
    const y = 350 + Math.floor(i / 6) * 120 + Math.random() * 40;
    const r = 20 + Math.random() * 30;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = colors[i % colors.length] + '80';
    ctx.fill();
  }

  // Download
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isc-convergence-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
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
      ✏️ <strong>You need a channel before discovering peers.</strong> Your channel describes what you're thinking about — ISC finds others thinking similarly.
      <a href="#/compose" class="btn btn-primary btn-sm" style="margin-left:8px">Create Channel</a>
    </div>
  `;
}

function renderEmptyState(connected, channels) {
  const description = !connected
    ? 'Connect to the P2P network to start finding thought neighbors.'
    : !channels.length
      ? 'You need a channel before discovering peers — your channel description is your semantic fingerprint.'
      : 'Click Discover to query the DHT for peers with similar embeddings.';

  const action =
    connected && channels.length
      ? [{ label: '🔍 Start Discovery', action: 'discover', variant: 'primary' }]
      : [];

  return `
    ${renderEmpty({
      icon: '🔭',
      title: 'No peers found yet',
      description,
      actions: action,
    })}

    <details class="explainer-details mt-4">
      <summary class="explainer-summary">How does semantic discovery work?</summary>
      <div class="card card-blue mt-2">
        <div class="card-title">🎯 How Semantic Discovery Works</div>
        <div class="discovery-explainer">
          ${renderExplainerStep('🧠', 'Local embedding', 'Your browser runs a tiny LLM to convert your channel description into a 384-dimensional vector. Your text stays on your device.')}
          ${renderExplainerStep('🗺️', 'LSH + DHT lookup', 'Locality-sensitive hashing maps your vector to DHT keys. Peers near you in semantic space have similar hashes.')}
          ${renderExplainerStep('📐', 'Cosine similarity ranking', 'Candidates are ranked by cosine similarity to your vector. 85%+ = very close thinkers. 55-70% = adjacent ideas.')}
          ${renderExplainerStep('🔒', 'Direct P2P connection', 'Click Chat to open an E2E encrypted WebRTC channel. No server sees your messages.')}
        </div>
      </div>
    </details>
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

  const sections = SIMILARITY_TIERS.map((tier) => ({
    ...tier,
    peers: sorted.filter((m) => {
      const sim = m.similarity ?? 0;
      return sim >= (tier.min ?? 0) && sim < (tier.max ?? 1);
    }),
  })).filter((s) => s.peers.length > 0);

  return `
    <div class="match-stats" data-testid="match-list">
      <span class="text-muted" style="font-size:12px">
        Found <strong>${sorted.length}</strong> peer${sorted.length !== 1 ? 's' : ''} in semantic proximity
      </span>
      <button class="btn btn-ghost btn-sm" id="discover-btn-refresh" aria-label="Refresh peer discovery">↻ Refresh</button>
    </div>

    ${sections
      .map(
        (section) => `
      <div class="match-section" data-section="${section.key}">
        <div class="match-section-header">
          <span>${section.label}</span>
          <span class="match-section-range text-muted">${section.desc} similarity</span>
        </div>
        ${section.peers.map((m) => renderMatchCard(m)).join('')}
      </div>
    `
      )
      .join('')}
  `;
}

function renderMatchCard(match) {
  const id = match.peerId ?? match.peer?.id ?? '';
  const name = match.identity?.name ?? match.peer?.name ?? 'Anonymous';
  const bio = match.identity?.bio ?? match.peer?.description ?? '';
  const topics = match.matchedTopics ?? [];
  const sim = match.similarity ?? 0;
  const pct = Math.round(sim * 100);
  const simClass = sim >= 0.85 ? 'very-high' : sim >= 0.7 ? 'high' : sim >= 0.55 ? 'medium' : 'low';
  const simLabel = sim >= 0.85 ? '🔥' : sim >= 0.7 ? '✨' : sim >= 0.55 ? '~' : '';

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
      ${
        topics.length
          ? `<div class="match-topics">${topics
              .slice(0, 6)
              .map((t) => `<span class="topic-tag">${escapeHtml(t)}</span>`)
              .join('')}</div>`
          : ''
      }

      <div class="match-actions">
        <button class="btn btn-primary btn-sm" data-chat-btn
                data-peer-id="${escapeHtml(id)}" data-peer-name="${escapeHtml(name)}"
                data-testid="chat-btn-${escapeHtml(id)}"
                aria-label="Chat with ${escapeHtml(name)}">
          💬 Chat
        </button>
      </div>
    </div>
  `;
}

export function bind(container) {
  // Load and render Bridge Moment candidates
  loadBridgeMomentBanner(container);
  loadConvergenceBanner(container);

  // G1: Auto-discover once per session if conditions are met
  const { channels } = channelService.getAll();
  const connected = networkService.getStatus()?.connected ?? false;
  const matches = discoveryService.getMatches();

  if (!autoDiscovered && connected && channels.length > 0 && matches.length === 0) {
    autoDiscovered = true;
    const content = container.querySelector('#discover-content');
    if (content) content.innerHTML = renderLoading('Searching for thought neighbors…');
    doDiscover();
  }

  const doDiscover = async () => {
    const btns = container.querySelectorAll(
      '#discover-btn, #discover-btn-empty, #discover-btn-refresh'
    );
    const mainBtn = container.querySelector('#discover-btn');

    btns.forEach((b) => (b.disabled = true));
    if (mainBtn) mainBtn.innerHTML = '⏳ Searching…';

    try {
      toasts.info('Querying DHT for semantic matches…');
      await discoveryService.discoverPeers();
      const matches = discoveryService.getMatches();
      if (matches.length === 0) {
        toasts.warning('No matches found — try broadening your channel description');
        showNoMatchesBanner(container);
      } else {
        toasts.success(`Found ${matches.length} peer${matches.length !== 1 ? 's' : ''}!`);
        dismissNoMatchesBanner();
      }
      update(container);
    } catch (err) {
      if (err.message?.includes('relay') || err.message?.includes('bootstrap')) {
        toasts.error('Cannot reach bootstrap relay — check your connection');
      } else {
        toasts.error(`Discovery failed: ${err.message}`);
      }
    } finally {
      btns.forEach((b) => (b.disabled = false));
      if (mainBtn) mainBtn.innerHTML = '🔍 Discover';
    }
  };

  container.querySelector('#discover-btn')?.addEventListener('click', doDiscover);
  container.querySelector('#discover-btn-empty')?.addEventListener('click', doDiscover);
  container.querySelector('#discover-btn-refresh')?.addEventListener('click', doDiscover);

  container.addEventListener('click', async (e) => {
    const chatBtn = e.target.closest('[data-chat-btn]');

    if (chatBtn) {
      const { peerId, peerName } = chatBtn.dataset;
      chatBtn.disabled = true;
      chatBtn.textContent = 'Connecting…';

      try {
        await discoveryService.connect(peerId);
        await markPeerContacted(peerId).catch(() => {});
        window.location.hash = '#/chats';
        setTimeout(() =>
          document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }))
        , 100);
      } catch (err) {
        toasts.error(`Could not connect: ${err.message}`);
        chatBtn.disabled = false;
        chatBtn.textContent = '💬 Chat';
      }
    }
  });

  return [
    () => {
      bridgeCandidates = [];
      convergenceEvent = null;
      noMatchesBannerEl = null;
      activeCallout = null;
      autoDiscovered = false;
      dismissNoMatchesBanner();
      dismissCallout(container);
    },
  ];
}

export function update(container) {
  const content = container.querySelector('#discover-content');
  if (!content) return;

  const matches = discoveryService.getMatches();
  const channels = channelService.getAll();
  const connected = networkService.getStatus()?.connected ?? false;

  content.innerHTML =
    matches.length === 0 ? renderEmptyState(connected, channels) : renderMatches(matches);

  // Re-bind buttons in refreshed content
  content.querySelector('#discover-btn-empty')?.addEventListener('click', () => {
    container.querySelector('#discover-btn')?.click();
  });
  content.querySelector('#discover-btn-refresh')?.addEventListener('click', () => {
    container.querySelector('#discover-btn')?.click();
  });
}
