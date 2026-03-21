/**
 * Space Canvas Utility
 *
 * Handles canvas rendering for the Space view mode in Now screen.
 * Extracted from space.js for consolidation.
 */

import { networkService } from '../../services/network.ts';
import { getDemoModeService } from '../../services/demoMode.ts';
import { toasts } from '../../utils/toast.js';
import { escapeHtml } from '../../utils/dom.js';

let UMAP = null;
let canvas = null;
let ctx = null;
let animationId = null;
let hoveredPeer = null;
let selfPosition = { x: 0.5, y: 0.5 };
let projectedPeers = [];
let isInitialized = false;
let embeddingCache = new Map();
let embeddingDebounceTimer = null;
let demoModeService = null;

const PEER_COLORS = {
  self: '#3b82f6',
  real: '#10b981',
  synthetic: '#6b7280',
};

const SIMILARITY_TIERS = [
  { min: 0.85, color: '#ef4444', label: 'Very Close' },
  { min: 0.7, color: '#f59e0b', label: 'Nearby' },
  { min: 0.55, color: '#06b6d4', label: 'Orbiting' },
  { min: 0, color: '#6b7280', label: 'Distant' },
];

export function initSpaceCanvas(canvasEl, { peers, selfPosition: initialSelfPos, onPeerClick }) {
  if (!canvasEl) return;

  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  demoModeService = getDemoModeService();

  if (initialSelfPos) selfPosition = initialSelfPos;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', () => {
    if (hoveredPeer && onPeerClick) {
      onPeerClick(hoveredPeer.peerId);
    }
  });
  canvas.addEventListener('mouseleave', () => hideTooltip());
  canvas.setAttribute('tabindex', '0');

  initCanvas(peers);
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

async function initCanvas(peers) {
  try {
    UMAP = await import('umap-js');
    isInitialized = true;
    await updatePeers(peers);
    renderCanvas();
    startAnimationLoop();
  } catch (err) {
    console.error('[SpaceCanvas] Init failed:', err);
    toasts.error('Space View failed to load');
  }
}

async function updatePeers(peers) {
  const demoStatus = demoModeService?.getStatus?.();
  let allPeers = [...peers];

  if (demoStatus?.isActive && demoStatus?.syntheticPeerCount > 0) {
    const syntheticPeers = generateSyntheticPeerData(demoStatus.syntheticPeerCount);
    allPeers = [...allPeers, ...syntheticPeers];
  }

  if (allPeers.length > 0 && UMAP) {
    await projectPeers(allPeers);
  }
}

function generateSyntheticPeerData(count) {
  const peers = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 0.2 + Math.random() * 0.3;
    peers.push({
      peerId: `synthetic_${i}`,
      identity: { name: `Demo Peer ${i + 1}`, bio: 'Demo mode peer' },
      similarity: 0.3 + Math.random() * 0.5,
      matchedTopics: ['demo'],
      online: true,
      isSynthetic: true,
    });
  }
  return peers;
}

async function projectPeers(peers) {
  if (!UMAP || peers.length < 2) {
    projectedPeers = peers.map((_p, i) => ({
      ..._p,
      x: 0.3 + Math.random() * 0.4,
      y: 0.3 + Math.random() * 0.4,
    }));
    return;
  }

  try {
    const embeddingService = networkService.service?.getEmbeddingService?.();

    const vectors = await Promise.all(
      peers.map(async (p) => {
        if (p.isSynthetic) return buildDeterministicVec(p.peerId, p.similarity);

        const cacheKey = p.peerId;
        if (embeddingCache.has(cacheKey)) return embeddingCache.get(cacheKey);

        const desc = p.identity?.bio || p.identity?.name || '';
        if (!desc || !embeddingService?.isLoaded?.()) {
          return buildDeterministicVec(p.peerId, p.similarity);
        }

        try {
          const vec = await embeddingService.compute(desc);
          embeddingCache.set(cacheKey, vec);
          return vec;
        } catch {
          return buildDeterministicVec(p.peerId, p.similarity);
        }
      })
    );

    const umap = new UMAP.UMAP({
      nNeighbors: Math.min(15, peers.length - 1),
      nComponents: 2,
      minDist: 0.1,
      spread: 1.0,
    });

    const embedding = umap.fit(vectors);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
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
    console.warn('[SpaceCanvas] UMAP projection failed:', err);
    projectedPeers = peers.map((p) => ({
      ...p,
      x: 0.2 + Math.random() * 0.6,
      y: 0.2 + Math.random() * 0.6,
    }));
  }
}

function buildDeterministicVec(peerId, similarity) {
  const seed = hashString(peerId);
  const vec = new Array(384);
  for (let i = 0; i < 384; i++) {
    vec[i] = Math.sin(seed * (i + 1) * 0.01) * 0.5 + Math.cos(seed * (i + 2) * 0.02) * 0.5;
  }
  if (similarity) {
    const simInfluence = similarity * 0.3;
    for (let i = 0; i < 384; i++) {
      vec[i] *= 1 + simInfluence;
    }
  }
  return vec;
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
  let tooltip = document.getElementById('space-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'space-tooltip';
    tooltip.className = 'space-tooltip';
    document.body.appendChild(tooltip);
  }

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

export function destroySpaceCanvas() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  if (canvas) {
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('click', handleMouseMove);
    canvas.removeEventListener('mouseleave', hideTooltip);
  }
  window.removeEventListener('resize', resizeCanvas);
  embeddingCache.clear();
  isInitialized = false;
  canvas = null;
  ctx = null;
  hoveredPeer = null;
  projectedPeers = [];
}

export function updateSpaceData({ peers, selfPosition: newPos }) {
  if (newPos) selfPosition = newPos;
  if (peers) {
    clearTimeout(embeddingDebounceTimer);
    embeddingDebounceTimer = setTimeout(async () => {
      await updatePeers(peers);
      renderCanvas();
    }, 500);
  }
}
