/* eslint-disable */
/**
 * Neighbors Component - Displays semantic neighbors in list or space view.
 */

import { discoveryService } from '../../services/index.js';
import { channelSettingsService } from '../../services/index.js';
import { escapeHtml } from '../utils/dom.js';
import { getProximityTier, formatProximity } from '../../utils/proximity.ts';

const DEFAULT_PARAMS = {
  channelId: null,
  threshold: 0.5,
  limit: 10,
  sortBy: 'similarity',
  viewMode: 'list',
  showDetails: true,
};

class NeighborsComponent {
  #container;
  #params;
  #neighbors = [];
  #boundHandlers = [];

  constructor(container, params = {}) {
    this.#container = container;
    this.#params = { ...DEFAULT_PARAMS, ...params };
    this.#render();
    this.#bind();
  }

  #render() {
    this.#neighbors = this.#computeNeighbors();
    const html =
      this.#params.viewMode === 'space' ? this.#renderSpaceView() : this.#renderListView();
    this.#container.innerHTML = html;
  }

  #computeNeighbors() {
    const opts = this.#params;
    let matches = discoveryService.getMatches();

    if (opts.channelId) {
      const channelSettings = channelSettingsService.getSettings(opts.channelId);
      const channelSpecificity = (channelSettings?.specificity ?? 50) / 100;
      const effectiveThreshold = Math.max(opts.threshold, channelSpecificity);

      // Score each match based on channel-specific relevance
      matches = matches
        .map((m) => ({
          ...m,
          // Use matched topics to compute channel-specific score
          channelScore: this.#computeChannelScore(m, opts.channelId),
        }))
        .filter((m) => (m.channelScore ?? m.similarity ?? 0) >= effectiveThreshold);

      // Sort by channel-specific score when in a channel
      matches.sort((a, b) => (b.channelScore ?? 0) - (a.channelScore ?? 0));
    } else {
      matches = matches.filter((m) => (m.similarity ?? 0) >= opts.threshold);
    }

    // When in channel mode, already sorted by channelScore
    // Only apply additional sorting when not in channel mode or when explicitly requested
    const isChannelMode = !!opts.channelId;

    if (!isChannelMode) {
      switch (opts.sortBy) {
        case 'recency':
          matches = matches.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
          break;
        case 'name':
          matches = matches.sort((a, b) =>
            (a.identity?.name ?? '').localeCompare(b.identity?.name ?? '')
          );
          break;
        case 'similarity':
        default:
          matches = matches.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
      }
    }

    return matches.slice(0, opts.limit).map((m) => ({
      peerId: m.peerId,
      identity: m.identity ?? { name: m.peer?.name ?? 'Anonymous', bio: m.peer?.description ?? '' },
      similarity: m.channelScore ?? m.similarity ?? 0,
      matchedTopics: m.matchedTopics ?? [],
      online: m.online ?? false,
      lastSeen: m.lastSeen,
    }));
  }

  /**
   * Compute channel-specific similarity score
   * Considers: global similarity + topic overlap + recency
   * @param {Object} match - Peer match
   * @param {string} channelId - Channel ID
   * @returns {number} Channel-specific score 0-1
   */
  #computeChannelScore(match, channelId) {
    const globalSimilarity = match.similarity ?? 0;
    const matchedTopics = match.matchedTopics ?? [];
    const isOnline = match.online ?? false;
    const lastSeen = match.lastSeen ?? 0;

    // Base score from global similarity
    let score = globalSimilarity * 0.6;

    // Boost for topic overlap (matched topics indicate channel relevance)
    if (matchedTopics.length > 0) {
      // Each matched topic adds to the score
      const topicBoost = Math.min(matchedTopics.length * 0.1, 0.3);
      score += topicBoost;
    }

    // Slight boost for online peers (more relevant for interaction)
    if (isOnline) {
      score += 0.1;
    }

    // Recency boost (recently active peers more relevant)
    const hoursSinceLastSeen = (Date.now() - lastSeen) / (1000 * 60 * 60);
    if (hoursSinceLastSeen < 1) {
      score += 0.1;
    } else if (hoursSinceLastSeen < 24) {
      score += 0.05;
    }

    return Math.min(score, 1);
  }

  #renderListView() {
    const opts = this.#params;
    if (this.#neighbors.length === 0) {
      return `
        <aside class="neighbor-panel" data-testid="neighbor-panel" aria-label="Channel neighbors">
          <div class="neighbor-panel-header">
            <span class="neighbor-panel-title">Neighbors</span>
            <span class="neighbor-panel-count" data-testid="neighbor-count">0</span>
          </div>
          <div class="neighbor-list" data-testid="neighbor-list">
            <div class="neighbor-empty">
              ${
                opts.channelId
                  ? `No peers in #${escapeHtml(opts.channelId)} neighborhood yet`
                  : 'No semantic neighbors found yet'
              }
            </div>
          </div>
        </aside>
      `;
    }

    return `
      <aside class="neighbor-panel" data-testid="neighbor-panel" aria-label="Channel neighbors">
        <div class="neighbor-panel-header">
          <span class="neighbor-panel-title">Neighbors</span>
          <span class="neighbor-panel-count" data-testid="neighbor-count">${this.#neighbors.length}</span>
          ${
            opts.channelId
              ? `<span class="neighbor-panel-channel">#${escapeHtml(opts.channelId)}</span>`
              : ''
          }
          ${
            opts.channelId
              ? `<button class="neighbor-audio-btn" data-action="audio-space" data-testid="audio-space-btn" title="Join audio space for #${escapeHtml(opts.channelId)}">🎙</button>`
              : ''
          }
        </div>
        <div class="neighbor-list" data-testid="neighbor-list">
          ${this.#neighbors.map((m) => this.#renderNeighborItem(m)).join('')}
        </div>
        ${
          opts.viewMode === 'list' && this.#neighbors.length > 0
            ? `<div class="neighbor-panel-footer">
              <button class="neighbor-view-toggle btn btn-ghost btn-sm" data-view-mode="space" data-testid="neighbors-space-toggle">
                🌌 View in Space
              </button>
            </div>`
            : ''
        }
      </aside>
    `;
  }

  #renderNeighborItem(match) {
    const opts = this.#params;
    const name = escapeHtml(match.identity?.name || match.peerId?.slice(0, 8) || 'Anonymous');
    const desc = opts.showDetails ? escapeHtml((match.identity?.bio || '').slice(0, 60)) : '';
    const tier = match.similarity != null ? getProximityTier(match.similarity) : null;

    return `
      <div class="neighbor-item ${tier?.cssClass ?? ''}" data-testid="neighbor-${match.peerId}" data-peer-id="${escapeHtml(match.peerId)}">
        <div class="neighbor-avatar">${(name[0] || 'A').toUpperCase()}</div>
        <div class="neighbor-info">
          <span class="neighbor-name">${name}</span>
          ${desc ? `<span class="neighbor-desc">${desc}</span>` : ''}
          ${tier ? `<span class="neighbor-tier" title="Semantic similarity">${formatProximity(match.similarity)}</span>` : ''}
        </div>
        <div class="neighbor-actions">
          ${!match.online ? '<span class="neighbor-offline" title="Offline">○</span>' : ''}
          <button class="neighbor-dm-btn btn btn-xs btn-ghost" data-action="start-chat" data-peer-id="${escapeHtml(match.peerId)}" data-testid="neighbor-dm-${match.peerId}" title="Message ${name}">✉</button>
        </div>
      </div>
    `;
  }

  #renderSpaceView() {
    const opts = this.#params;
    return `
      <aside class="neighbor-panel neighbor-panel-space" data-testid="neighbor-panel" aria-label="Channel neighbors (space view)">
        <div class="neighbor-panel-header">
          <span class="neighbor-panel-title">Neighbors</span>
          <span class="neighbor-panel-count">${this.#neighbors.length}</span>
          ${
            opts.channelId
              ? `<span class="neighbor-panel-channel">#${escapeHtml(opts.channelId)}</span>`
              : ''
          }
          <button class="neighbor-view-toggle btn btn-ghost btn-sm" data-view-mode="list" data-testid="neighbors-list-toggle">
            📋 List
          </button>
        </div>
        <div class="neighbor-space-container" data-testid="neighbor-space-container">
          <canvas id="neighbor-space-canvas" class="neighbor-space-canvas" data-testid="neighbor-space-canvas"></canvas>
        </div>
        <div class="neighbor-space-legend">
          <span class="legend-item"><span class="legend-dot self"></span>You</span>
          <span class="legend-item"><span class="legend-dot peer"></span>Neighbor</span>
        </div>
      </aside>
    `;
  }

  #bind() {
    const handleListToggle = this.#container.querySelector('[data-view-mode="list"]');
    const handleSpaceToggle = this.#container.querySelector('[data-view-mode="space"]');
    const handleDm = this.#container.querySelector('[data-action="start-chat"]');
    const handleAudio = this.#container.querySelector('[data-action="audio-space"]');

    const onViewToggle = (e) => {
      const btn = e.target.closest('[data-view-mode]');
      if (!btn) return;
      const mode = btn.dataset.viewMode;
      this.setViewMode(mode);
    };

    const onDmClick = (e) => {
      const dmBtn = e.target.closest('[data-action="start-chat"]');
      if (!dmBtn) return;
      const peerId = dmBtn.dataset.peerId;
      if (peerId) {
        this.#container.dispatchEvent(
          new CustomEvent('neighbors:start-chat', { detail: { peerId }, bubbles: true })
        );
      }
    };

    const onAudioClick = async (e) => {
      const audioBtn = e.target.closest('[data-action="audio-space"]');
      if (!audioBtn) return;
      this.#container.dispatchEvent(
        new CustomEvent('neighbors:audio-space', { detail: { channelId: this.#params.channelId }, bubbles: true })
      );
    };

    handleListToggle?.addEventListener('click', onViewToggle);
    handleSpaceToggle?.addEventListener('click', onViewToggle);
    this.#container.addEventListener('click', onDmClick);
    handleAudio?.addEventListener('click', onAudioClick);

    this.#boundHandlers.push(
      () => handleListToggle?.removeEventListener('click', onViewToggle),
      () => handleSpaceToggle?.removeEventListener('click', onViewToggle),
      () => this.#container.removeEventListener('click', onDmClick),
      () => handleAudio?.removeEventListener('click', onAudioClick)
    );
  }

  setViewMode(mode) {
    this.#params.viewMode = mode;
    this.#render();
    this.#bind();

    if (mode === 'space') {
      this.#initCanvas();
    }
  }

  setParams(params) {
    this.#params = { ...this.#params, ...params };
    this.#render();
    this.#bind();

    if (this.#params.viewMode === 'space') {
      this.#initCanvas();
    }
  }

  refresh() {
    this.#render();
    this.#bind();

    if (this.#params.viewMode === 'space') {
      this.#initCanvas();
    }
  }

  #initCanvas() {
    const canvas = this.#container.querySelector('#neighbor-space-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = this.#container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = (rect.height - 100) * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height - 100;
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, width, height);

    this.#drawGrid(ctx, width, height, centerX, centerY);

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();

    const glowGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30);
    glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    glowGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(
      this.#params.channelId ? `#${this.#params.channelId}` : 'You',
      centerX,
      centerY - 15
    );

    this.#neighbors.forEach((neighbor, idx) => {
      const angle = (idx / this.#neighbors.length) * Math.PI * 2;
      const distance = 80 + Math.random() * 60;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      const color = neighbor.online ? '#10b981' : '#6b7280';
      const size = neighbor.online ? 6 : 4;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      if (neighbor.online) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#ccc';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      const name = neighbor.identity?.name || neighbor.peerId.slice(0, 6);
      ctx.fillText(name, x, y + 18);

      ctx.fillStyle = '#888';
      ctx.font = '10px system-ui';
      ctx.fillText(`${(neighbor.similarity * 100).toFixed(0)}%`, x, y + 30);
    });
  }

  #drawGrid(ctx, width, height, centerX, centerY) {
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 1;

    const gridSize = 50;
    const offsetX = centerX % gridSize;
    const offsetY = centerY % gridSize;

    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  destroy() {
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
    this.#container.innerHTML = '';
  }
}

export { NeighborsComponent };
export function renderNeighborsPanel(params = {}) {
  return `<div class="neighbors-placeholder"></div>`;
}
