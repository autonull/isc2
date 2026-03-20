/**
 * Space View Screen
 *
 * 2D semantic map showing peers in thought space.
 * Closer = more semantically similar.
 */

import { networkService } from '../../services/network.ts';
import { getDemoModeService } from '../../services/demoMode.ts';
import { toasts } from '../../utils/toast.js';
import { escapeHtml } from '../utils/dom.js';
import { getState, subscribe } from '../../state.js';
import {
  shouldShowThoughtTwinNotification,
  acknowledgeThoughtTwin,
  dismissThoughtTwin,
} from '../../services/thoughtTwin.ts';

let demoModeService = null;
let UMAP = null;
let canvas = null;
let ctx = null;
let animationId = null;
let hoveredPeer = null;
let selfPosition = { x: 0.5, y: 0.5 };
let projectedPeers = [];
let isInitialized = false;
let unsubscribe = null;

const PEER_COLORS = {
  self: '#3b82f6',
  real: '#10b981',
  synthetic: '#6b7280',
  ghost: '#8b5cf6',
};

const SIMILARITY_TIERS = [
  { min: 0.85, color: '#ef4444', label: 'Very Close' },
  { min: 0.7, color: '#f59e0b', label: 'Nearby' },
  { min: 0.55, color: '#06b6d4', label: 'Orbiting' },
  { min: 0, color: '#6b7280', label: 'Distant' },
];

export function render() {
  const netStatus = networkService?.getStatus();
  const connected = netStatus?.connected ?? false;

  return `
    <div class="screen space-screen" data-testid="space-screen">
      <div class="screen-header" data-testid="space-header">
        <h1 class="screen-title" data-testid="space-title">
          🗺️ Space <span class="screen-subtitle">Semantic thought map</span>
        </h1>
        <div class="header-actions">
          <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="space-status">
            ${connected ? '● Online' : '○ Offline'}
          </span>
        </div>
      </div>
      
      <div id="thought-twin-container"></div>
      
      <div class="space-container" data-testid="space-container">
        <canvas id="space-canvas" class="space-canvas"></canvas>
        <div class="space-tooltip" id="space-tooltip"></div>
        <div class="space-legend">
          <div class="legend-item"><span class="legend-dot" style="background:${PEER_COLORS.self}"></span> You</div>
          <div class="legend-item"><span class="legend-dot" style="background:${PEER_COLORS.real}"></span> Real Peers</div>
          <div class="legend-item"><span class="legend-dot" style="background:${PEER_COLORS.synthetic}"></span> Demo</div>
        </div>
        <div class="space-model-progress" id="model-progress" style="display:none">
          <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
          <span class="progress-text" id="progress-text">Loading AI model...</span>
        </div>
      </div>

      <div class="space-info-panel" id="space-info">
        <div class="info-text">
          <span class="peer-count" id="peer-count">0 peers</span>
          <span class="similarity-hint">Click a peer to connect</span>
        </div>
      </div>
    </div>
  `;
}

function renderThoughtTwinBanner(twin) {
  const days = twin.days;
  const avgSim = Math.round(twin.avgCosine * 100);

  return `
    <div class="thought-twin-banner" id="thought-twin-banner">
      <div class="thought-twin-content">
        <span class="twin-icon">👯</span>
        <div class="thought-twin-text">
          <strong>Your Thought Twin this week</strong>
          <span class="text-muted">${days} days · ${avgSim}% average · <span class="twin-anonymous">anonymous until you connect</span></span>
        </div>
      </div>
      <div class="thought-twin-actions">
        <button class="btn btn-primary btn-sm" id="twin-connect">Connect</button>
        <button class="btn btn-ghost btn-sm" id="twin-acknowledge">Acknowledge</button>
      </div>
    </div>
  `;
}

async function loadThoughtTwin(container) {
  const containerEl = container.querySelector('#thought-twin-container');
  if (!containerEl) return;

  try {
    const { twin, shouldShow } = await shouldShowThoughtTwinNotification();

    if (shouldShow && twin) {
      containerEl.innerHTML = renderThoughtTwinBanner(twin);

      containerEl.querySelector('#twin-connect')?.addEventListener('click', async () => {
        await acknowledgeThoughtTwin();
        document.dispatchEvent(
          new CustomEvent('isc:open-chat', {
            detail: { peerId: twin.peerId, name: 'Thought Twin' },
          })
        );
        containerEl.innerHTML = '';
      });

      containerEl.querySelector('#twin-acknowledge')?.addEventListener('click', async () => {
        await dismissThoughtTwin();
        containerEl.innerHTML = '';
      });
    } else {
      containerEl.innerHTML = '';
    }
  } catch (err) {
    containerEl.innerHTML = '';
  }
}

export function bind(container) {
  canvas = container.querySelector('#space-canvas');
  if (!canvas) return;

  ctx = canvas.getContext('2d');

  demoModeService = getDemoModeService();

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('mouseleave', () => hideTooltip());

  initSpaceView();
  loadThoughtTwin(container);
}

function resizeCanvas() {
  if (!canvas) return;
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  ctx?.scale(dpr, dpr);

  if (isInitialized) {
    renderCanvas();
  }
}

async function initSpaceView() {
  try {
    UMAP = await import('umap-js');
    isInitialized = true;

    const state = getState();
    updateFromState(state);

    unsubscribe = subscribe((state) => {
      updateFromState(state);
    });

    renderCanvas();
    startAnimationLoop();

    console.log('[Space] Initialized');
  } catch (err) {
    console.error('[Space] Init failed:', err);
    toasts.error('Space View failed to load');
  }
}

function updateFromState(state) {
  const matches = state.matches || [];
  const demoStatus = demoModeService?.getStatus?.();

  let allPeers = [...matches];

  if (demoStatus?.isActive && demoStatus?.syntheticPeerCount > 0) {
    const syntheticPeers = generateSyntheticPeerData(demoStatus.syntheticPeerCount);
    allPeers = [...allPeers, ...syntheticPeers];
  }

  if (state.identity) {
    selfPosition = { x: 0.5, y: 0.5 };
  }

  if (allPeers.length > 0 && UMAP) {
    projectPeers(allPeers);
  }

  updatePeerCount(allPeers.length);
}

function generateSyntheticPeerData(count) {
  const peers = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 0.2 + Math.random() * 0.3;
    peers.push({
      peerId: `synthetic_${i}`,
      identity: {
        name: `Demo Peer ${i + 1}`,
        bio: 'Demo mode peer',
      },
      similarity: 0.3 + Math.random() * 0.5,
      matchedTopics: ['demo'],
      online: true,
      isSynthetic: true,
    });
  }
  return peers;
}

function projectPeers(peers) {
  if (!UMAP || peers.length < 2) {
    projectedPeers = peers.map((p, i) => ({
      ...p,
      x: 0.3 + Math.random() * 0.4,
      y: 0.3 + Math.random() * 0.4,
    }));
    return;
  }

  try {
    const vectors = peers.map((p) => {
      const seed = hashString(p.peerId);
      const vec = new Array(384);
      for (let i = 0; i < 384; i++) {
        vec[i] = Math.sin(seed * (i + 1) * 0.01) * 0.5 + Math.cos(seed * (i + 2) * 0.02) * 0.5;
      }
      if (p.similarity) {
        const simInfluence = p.similarity * 0.3;
        for (let i = 0; i < Math.min(384, vec.length); i++) {
          vec[i] *= 1 + simInfluence;
        }
      }
      return vec;
    });

    const umap = new UMAP.UMAP({
      nNeighbors: Math.min(15, peers.length - 1),
      nComponents: 2,
      minDist: 0.1,
      spread: 1.0,
    });

    const embedding = umap.fit(vectors);

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    embedding.forEach((p) => {
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    });

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 0.1;

    projectedPeers = peers.map((p, i) => ({
      ...p,
      x: padding + ((embedding[i][0] - minX) / rangeX) * (1 - 2 * padding),
      y: padding + ((embedding[i][1] - minY) / rangeY) * (1 - 2 * padding),
    }));
  } catch (err) {
    console.warn('[Space] UMAP projection failed:', err);
    projectedPeers = peers.map((p, i) => ({
      ...p,
      x: 0.2 + Math.random() * 0.6,
      y: 0.2 + Math.random() * 0.6,
    }));
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function startAnimationLoop() {
  if (animationId) return;

  function loop() {
    renderCanvas();
    animationId = requestAnimationFrame(loop);
  }
  loop();
}

function renderCanvas() {
  if (!ctx || !canvas) return;

  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
  ctx.fillRect(0, 0, w, h);

  drawGrid(w, h);

  projectedPeers.forEach((peer) => {
    const x = peer.x * w;
    const y = peer.y * h;
    const isHovered = hoveredPeer?.peerId === peer.peerId;
    const radius = peer.isSynthetic ? 6 : isHovered ? 12 : 8;
    const color = peer.isSynthetic ? PEER_COLORS.synthetic : PEER_COLORS.real;

    ctx.beginPath();
    ctx.arc(x, y, radius + (isHovered ? 4 : 0), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = peer.isSynthetic ? 0.6 : 0.8;
    ctx.fill();

    if (peer.isSynthetic) {
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
  });

  const sx = selfPosition.x * w;
  const sy = selfPosition.y * h;

  ctx.beginPath();
  ctx.arc(sx, sy, 14, 0, Math.PI * 2);
  ctx.fillStyle = PEER_COLORS.self;
  ctx.shadowColor = PEER_COLORS.self;
  ctx.shadowBlur = 15;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('You', sx, sy);
}

function drawGrid(w, h) {
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
  ctx.lineWidth = 1;

  const spacing = 50;
  for (let x = spacing; x < w; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = spacing; y < h; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = rect.width;
  const h = rect.height;

  hoveredPeer = null;

  for (const peer of projectedPeers) {
    const px = peer.x * w;
    const py = peer.y * h;
    const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);

    if (dist < 20) {
      hoveredPeer = peer;
      showTooltip(peer, e.clientX, e.clientY);
      canvas.style.cursor = 'pointer';
      break;
    }
  }

  if (!hoveredPeer) {
    hideTooltip();
    canvas.style.cursor = 'default';
  }

  renderCanvas();
}

function showTooltip(peer, mouseX, mouseY) {
  const tooltip = document.getElementById('space-tooltip');
  if (!tooltip) return;

  const tier = SIMILARITY_TIERS.find((t) => peer.similarity >= t.min);
  const name = peer.identity?.name || peer.peerId?.slice(0, 8) || 'Anonymous';
  const sim = peer.similarity ? `${Math.round(peer.similarity * 100)}%` : 'N/A';

  tooltip.innerHTML = `
    <div class="tooltip-name">${escapeHtml(name)}</div>
    <div class="tooltip-sim" style="color:${tier?.color || '#6b7280'}">${sim} match</div>
    <div class="tooltip-tier">${tier?.label || 'Unknown'}</div>
    ${
      peer.matchedTopics?.length
        ? `<div class="tooltip-topics">${peer.matchedTopics
            .slice(0, 3)
            .map((t) => `<span class="topic">${escapeHtml(t)}</span>`)
            .join('')}</div>`
        : ''
    }
  `;

  tooltip.style.display = 'block';
  tooltip.style.left = `${mouseX + 15}px`;
  tooltip.style.top = `${mouseY + 15}px`;
}

function hideTooltip() {
  const tooltip = document.getElementById('space-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

function handleClick(e) {
  if (!hoveredPeer) return;

  const peerId = hoveredPeer.peerId;
  const name = hoveredPeer.identity?.name || 'Anonymous';

  document.dispatchEvent(
    new CustomEvent('isc:open-chat', {
      detail: { peerId, name },
    })
  );
}

function updatePeerCount(count) {
  const el = document.getElementById('peer-count');
  if (el) {
    el.textContent = `${count} peer${count !== 1 ? 's' : ''} in space`;
  }
}

export function update(container) {
  if (!isInitialized) return;

  const state = getState();
  updateFromState(state);
  renderCanvas();
}

export function destroy() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  window.removeEventListener('resize', resizeCanvas);
  canvas?.removeEventListener('mousemove', handleMouseMove);
  canvas?.removeEventListener('click', handleClick);
  canvas?.removeEventListener('mouseleave', () => hideTooltip());
}
