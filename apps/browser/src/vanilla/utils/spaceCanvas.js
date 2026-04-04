/* eslint-disable */
/**
 * Space Canvas Component
 *
 * 2D semantic space visualization for peer discovery.
 * OOP class with self-contained state and lifecycle management.
 */

import { networkService } from '../../services/network.ts';
import { toast as toasts } from '../../utils/toast.ts';
import { escapeHtml } from '../utils/dom.js';

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

class SpaceCanvasComponent {
  #canvas;
  #ctx;
  #onPeerClick;
  #UMAP = null;
  #animationId = null;
  #hoveredPeer = null;
  #selfPosition = { x: 0.5, y: 0.5 };
  #projectedPeers = [];
  #isInitialized = false;
  #embeddingCache = new Map();
  #embeddingDebounceTimer = null;
  #boundHandlers = [];

  constructor(canvasEl, { peers = [], selfPosition, onPeerClick } = {}) {
    this.#canvas = canvasEl;
    this.#onPeerClick = onPeerClick;
    if (selfPosition) this.#selfPosition = selfPosition;

    this.#ctx = this.#canvas.getContext('2d');
    this.#resizeCanvas();
    this.#bind();

    this.#initCanvas(peers);
  }

  #bind() {
    const resizeHandler = () => this.#resizeCanvas();
    window.addEventListener('resize', resizeHandler);
    this.#boundHandlers.push(() => window.removeEventListener('resize', resizeHandler));

    const mouseMoveHandler = (e) => this.#handleMouseMove(e);
    this.#canvas.addEventListener('mousemove', mouseMoveHandler);
    this.#boundHandlers.push(() => this.#canvas.removeEventListener('mousemove', mouseMoveHandler));

    const clickHandler = () => {
      if (this.#hoveredPeer && this.#onPeerClick) {
        this.#onPeerClick(this.#hoveredPeer.peerId);
      }
    };
    this.#canvas.addEventListener('click', clickHandler);
    this.#boundHandlers.push(() => this.#canvas.removeEventListener('click', clickHandler));

    const mouseleaveHandler = () => this.#hideTooltip();
    this.#canvas.addEventListener('mouseleave', mouseleaveHandler);
    this.#boundHandlers.push(() =>
      this.#canvas.removeEventListener('mouseleave', mouseleaveHandler)
    );

    this.#canvas.setAttribute('tabindex', '0');
  }

  #resizeCanvas() {
    if (!this.#canvas) return;
    const container = this.#canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.#canvas.width = rect.width * dpr;
    this.#canvas.height = rect.height * dpr;
    this.#canvas.style.width = `${rect.width}px`;
    this.#canvas.style.height = `${rect.height}px`;

    this.#ctx?.scale(dpr, dpr);

    if (this.#isInitialized) {
      this.#renderCanvas();
    }
  }

  async #initCanvas(peers) {
    try {
      this.#UMAP = await import('umap-js');
      this.#isInitialized = true;
      await this.#updatePeers(peers);
      this.#renderCanvas();
      this.#startAnimationLoop();
    } catch (err) {
      console.error('[SpaceCanvas] Init failed:', err);
      toasts.error('Space View failed to load');
    }
  }

  async #updatePeers(peers) {
    if (peers.length > 0 && this.#UMAP) {
      await this.#projectPeers(peers);
    }
  }

  async #projectPeers(peers) {
    if (!this.#UMAP || peers.length < 2) {
      this.#projectedPeers = peers.map((p, i) => ({
        ...p,
        x: 0.3 + Math.random() * 0.4,
        y: 0.3 + Math.random() * 0.4,
      }));
      return;
    }

    try {
      const embeddingService = networkService.service?.getEmbeddingService?.();

      const vectors = await Promise.all(
        peers.map(async (p) => {
          if (p.isSynthetic) return this.#buildDeterministicVec(p.peerId, p.similarity);

          const cacheKey = p.peerId;
          if (this.#embeddingCache.has(cacheKey)) return this.#embeddingCache.get(cacheKey);

          const desc = p.identity?.bio || p.identity?.name || '';
          if (!desc || !embeddingService?.isLoaded?.()) {
            return this.#buildDeterministicVec(p.peerId, p.similarity);
          }

          try {
            const vec = await embeddingService.compute(desc);
            this.#embeddingCache.set(cacheKey, vec);
            return vec;
          } catch {
            return this.#buildDeterministicVec(p.peerId, p.similarity);
          }
        })
      );

      const umap = new this.#UMAP.UMAP({
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

      this.#projectedPeers = peers.map((p, i) => ({
        ...p,
        x: padding + ((embedding[i][0] - minX) / rangeX) * (1 - 2 * padding),
        y: padding + ((embedding[i][1] - minY) / rangeY) * (1 - 2 * padding),
      }));
    } catch (err) {
      console.warn('[SpaceCanvas] UMAP projection failed:', err);
      this.#projectedPeers = peers.map((p) => ({
        ...p,
        x: 0.2 + Math.random() * 0.6,
        y: 0.2 + Math.random() * 0.6,
      }));
    }
  }

  #buildDeterministicVec(peerId, similarity) {
    const seed = this.#hashString(peerId);
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

  #hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  #startAnimationLoop() {
    if (this.#animationId) return;
    const loop = () => {
      this.#renderCanvas();
      this.#animationId = requestAnimationFrame(loop);
    };
    loop();
  }

  #renderCanvas() {
    if (!this.#ctx || !this.#canvas) return;

    const w = this.#canvas.width / (window.devicePixelRatio || 1);
    const h = this.#canvas.height / (window.devicePixelRatio || 1);

    this.#ctx.clearRect(0, 0, w, h);
    this.#ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
    this.#ctx.fillRect(0, 0, w, h);

    this.#drawGrid(w, h);

    this.#projectedPeers.forEach((peer) => {
      const x = peer.x * w;
      const y = peer.y * h;
      const isHovered = this.#hoveredPeer?.peerId === peer.peerId;
      const radius = peer.isSynthetic ? 6 : isHovered ? 12 : 8;
      const color = peer.isSynthetic ? PEER_COLORS.synthetic : PEER_COLORS.real;

      this.#ctx.beginPath();
      this.#ctx.arc(x, y, radius + (isHovered ? 4 : 0), 0, Math.PI * 2);
      this.#ctx.fillStyle = color;
      this.#ctx.globalAlpha = peer.isSynthetic ? 0.6 : 0.8;
      this.#ctx.fill();

      if (peer.isSynthetic) {
        this.#ctx.setLineDash([2, 2]);
        this.#ctx.strokeStyle = color;
        this.#ctx.lineWidth = 1;
        this.#ctx.stroke();
        this.#ctx.setLineDash([]);
      }
      this.#ctx.globalAlpha = 1;
    });

    const sx = this.#selfPosition.x * w;
    const sy = this.#selfPosition.y * h;

    this.#ctx.beginPath();
    this.#ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    this.#ctx.fillStyle = PEER_COLORS.self;
    this.#ctx.shadowColor = PEER_COLORS.self;
    this.#ctx.shadowBlur = 15;
    this.#ctx.fill();
    this.#ctx.shadowBlur = 0;

    this.#ctx.fillStyle = '#fff';
    this.#ctx.font = 'bold 10px system-ui';
    this.#ctx.textAlign = 'center';
    this.#ctx.textBaseline = 'middle';
    this.#ctx.fillText('You', sx, sy);
  }

  #drawGrid(w, h) {
    this.#ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
    this.#ctx.lineWidth = 1;
    const spacing = 50;
    for (let x = spacing; x < w; x += spacing) {
      this.#ctx.beginPath();
      this.#ctx.moveTo(x, 0);
      this.#ctx.lineTo(x, h);
      this.#ctx.stroke();
    }
    for (let y = spacing; y < h; y += spacing) {
      this.#ctx.beginPath();
      this.#ctx.moveTo(0, y);
      this.#ctx.lineTo(w, y);
      this.#ctx.stroke();
    }
  }

  #handleMouseMove(e) {
    const rect = this.#canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    this.#hoveredPeer = null;

    for (const peer of this.#projectedPeers) {
      const px = peer.x * w;
      const py = peer.y * h;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < 20) {
        this.#hoveredPeer = peer;
        this.#showTooltip(peer, e.clientX, e.clientY);
        this.#canvas.style.cursor = 'pointer';
        break;
      }
    }

    if (!this.#hoveredPeer) {
      this.#hideTooltip();
      this.#canvas.style.cursor = 'default';
    }

    this.#renderCanvas();
  }

  #showTooltip(peer, mouseX, mouseY) {
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

  #hideTooltip() {
    const tooltip = document.getElementById('space-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  update({ peers, selfPosition }) {
    if (selfPosition) this.#selfPosition = selfPosition;
    if (peers) {
      clearTimeout(this.#embeddingDebounceTimer);
      this.#embeddingDebounceTimer = setTimeout(async () => {
        await this.#updatePeers(peers);
        this.#renderCanvas();
      }, 500);
    }
  }

  destroy() {
    if (this.#animationId) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }

    if (this.#embeddingDebounceTimer) {
      clearTimeout(this.#embeddingDebounceTimer);
      this.#embeddingDebounceTimer = null;
    }

    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];

    this.#embeddingCache.clear();
    this.#isInitialized = false;
    this.#hoveredPeer = null;
    this.#projectedPeers = [];
  }
}

let activeCanvas = null;

export function initSpaceCanvas(canvasEl, options) {
  if (activeCanvas) {
    activeCanvas.destroy();
  }
  activeCanvas = new SpaceCanvasComponent(canvasEl, options);
  return activeCanvas;
}

export function destroySpaceCanvas() {
  if (activeCanvas) {
    activeCanvas.destroy();
    activeCanvas = null;
  }
}

export function updateSpaceData(options) {
  if (activeCanvas) {
    activeCanvas.update(options);
  }
}
