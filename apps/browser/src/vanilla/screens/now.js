/**
 * Now Screen — Home Dashboard
 *
 * Default route (/now). Aggregates across all active channels.
 * Per-channel summary rows, unread counts, network status, convergence events.
 * Read-only: composing happens in the Channel screen.
 */

import { feedService, channelService, discoveryService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions } from '../../state.js';
import { escapeHtml } from '../utils/dom.js';
import { formatTime } from '../../utils/time.js';
import { renderEmpty } from '../utils/screen.js';
import { initSpaceCanvas, destroySpaceCanvas, updateSpaceData } from '../utils/spaceCanvas.js';

export function render() {
  const { channels, activeChannelId } = getState();
  const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
  const connLabel = connected ? 'connected' : status;
  const matches = discoveryService.getMatches();
  const peerCount = matches.length;

  return `
    <div class="screen now-screen" data-testid="now-screen">
      ${renderHeader(connected, connLabel, peerCount)}
      ${channels.length >= 2 ? renderSemanticMap(channels, matches) : ''}
      <div class="screen-body now-body" data-testid="now-body">
        ${
          channels.length === 0
            ? renderNoChannels(connected, connLabel)
            : renderChannelRows(channels, activeChannelId)
        }
      </div>
    </div>
  `;
}

function renderSemanticMap(channels, matches) {
  const isCollapsed = localStorage.getItem('isc:semantic-map-collapsed') === 'true';
  const channelCount = channels.length;
  const uniqueRegions = Math.min(channelCount, 3);

  return `
    <div class="semantic-map-panel" data-testid="semantic-map-panel"${isCollapsed ? ' data-collapsed="true"' : ''}>
      <div class="semantic-map-header" data-action="toggle-map" data-testid="semantic-map-header">
        <span class="semantic-map-title">
          ${isCollapsed ? '▶' : '▼'} Your ${channelCount} channel${channelCount !== 1 ? 's' : ''} span${channelCount === 1 ? 's' : ''} ${uniqueRegions} distinct region${uniqueRegions !== 1 ? 's' : ''}
        </span>
      </div>
      ${
        isCollapsed
          ? ''
          : `
        <div class="semantic-map-container">
          <canvas id="semantic-map-canvas" data-testid="semantic-map-canvas"></canvas>
        </div>
      `
      }
    </div>
  `;
}

function renderHeader(connected, connLabel, peerCount) {
  const peerLabel =
    peerCount > 0
      ? `${peerCount} ${peerCount === 1 ? 'peer' : 'peers'} in network`
      : peerCount === 0
        ? 'no peers found — share your link or check relay'
        : '';
  return `
    <div class="screen-header now-header" data-testid="now-header">
      <h1 class="screen-title" data-testid="now-title">Now</h1>
      <div class="header-status">
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">
          ${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}
        </span>
        ${peerLabel ? `<span class="header-peer-count" data-testid="peer-count"> · ${peerLabel}</span>` : ''}
      </div>
    </div>
  `;
}

function renderNoChannels(connected, connLabel) {
  const matches = discoveryService.getMatches();
  const hasNoPeers = matches.length === 0;

  return `
    <div data-testid="now-empty-state">
      ${renderEmpty({
        icon: '💭',
        title: 'What are you thinking about?',
        description:
          'Create a channel to start. ISC will place you in a neighborhood of semantic space — everyone whose channel lands nearby hears what you post.',
        actions: [
          {
            label: 'Create a channel',
            href: '#',
            'data-action': 'new-channel',
            variant: 'primary',
          },
        ],
      })}
      <div style="display:none" data-testid="now-empty-cta"></div>
    </div>
    ${!connected ? `<div class="info-banner warning mt-4">○ Network is ${escapeHtml(connLabel)} — you can still create channels offline</div>` : ''}
    ${hasNoPeers && connected ? renderColdStartBanner() : ''}
  `;
}

function renderColdStartBanner() {
  return `
    <div class="cold-start-banner" data-testid="cold-start-banner">
      💡 More useful with more people. 
      <button data-action="share-link" data-testid="share-link-btn">Share Link</button>
      or <button data-action="learn-relay" data-testid="learn-relay-btn">Connect via Relay</button>
    </div>
  `;
}

function renderChannelRows(channels, activeChannelId) {
  const rows = channels.map((ch) => renderChannelRow(ch, activeChannelId)).join('');
  const yourSpaceBtn =
    channels.length > 1
      ? `<button class="btn btn-primary btn-your-space" data-action="see-all" data-testid="your-space-btn">Your Space (all channels)</button>`
      : '';
  return `
    <div class="now-channel-list" data-testid="now-channel-list">
      ${yourSpaceBtn}
      ${rows}
    </div>
  `;
}

function renderChannelRow(channel, activeChannelId) {
  const posts = feedService.getByChannel(channel.id);
  const latestPost = posts.at(-1);
  const unreadCount = posts.filter((p) => !p.read).length;
  const isActive = channel.id === activeChannelId;

  const preview = latestPost
    ? escapeHtml((latestPost.content || '').slice(0, 80)) +
      (latestPost.content?.length > 80 ? '…' : '')
    : '<span class="now-row-empty">No messages yet</span>';

  const time = latestPost?.timestamp ? formatTime(latestPost.timestamp) : '';

  return `
    <div class="now-channel-row${isActive ? ' active' : ''}"
         data-testid="now-channel-row-${escapeHtml(channel.id)}"
         data-channel-id="${escapeHtml(channel.id)}"
         tabindex="0"
         role="button"
         aria-label="Channel ${escapeHtml(channel.name)}${unreadCount > 0 ? `, ${unreadCount} unread` : ''}">
      <div class="now-row-icon">#</div>
      <div class="now-row-content">
        <div class="now-row-header">
          <span class="now-row-name">${escapeHtml(channel.name)}</span>
          <span class="now-row-time">${time}</span>
        </div>
        <div class="now-row-preview">${preview}</div>
        <div class="now-row-meta">
          ${channel.description ? `<span class="now-row-desc">${escapeHtml(channel.description.slice(0, 40))}${channel.description.length > 40 ? '…' : ''}</span>` : ''}
        </div>
      </div>
      ${unreadCount > 0 ? `<span class="now-row-unread" aria-label="${unreadCount} unread">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
    </div>
  `;
}

export function bind(container) {
  bindSemanticMap(container);

  // Channel row click — set active and navigate to /channel
  container.addEventListener('click', (e) => {
    const row = e.target.closest('.now-channel-row');
    if (row) {
      const channelId = row.dataset.channelId;
      if (channelId) {
        actions.setActiveChannel(channelId);
        window.location.hash = '#/channel';
      }
      return;
    }

    const newChannelBtn = e.target.closest('[data-action="new-channel"]');
    if (newChannelBtn) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('isc:new-channel'));
      return;
    }

    const yourSpaceBtn = e.target.closest('[data-action="see-all"]');
    if (yourSpaceBtn) {
      e.preventDefault();
      actions.setActiveChannel(null);
      window.location.hash = '#/channel';
      return;
    }

    const shareLinkBtn = e.target.closest('[data-action="share-link"]');
    if (shareLinkBtn) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('isc:share-link'));
    }

    const learnRelayBtn = e.target.closest('[data-action="learn-relay"]');
    if (learnRelayBtn) {
      e.preventDefault();
      window.location.hash = '#/settings';
    }
  });

  // Keyboard: Enter/Space on channel rows
  container.addEventListener('keydown', (e) => {
    const row = e.target.closest('.now-channel-row');
    if (row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      row.click();
    }
  });
}

function bindSemanticMap(container) {
  const panel = container.querySelector('.semantic-map-panel');
  if (!panel) return;

  const header = panel.querySelector('[data-action="toggle-map"]');
  const canvas = panel.querySelector('#semantic-map-canvas');

  if (header) {
    header.addEventListener('click', () => {
      const isCollapsed = panel.dataset.collapsed === 'true';
      panel.dataset.collapsed = String(!isCollapsed);
      localStorage.setItem('isc:semantic-map-collapsed', String(!isCollapsed));

      if (!isCollapsed) {
        const newCanvas = panel.querySelector('#semantic-map-canvas');
        if (newCanvas) initCanvasOnPanel(panel);
      }
    });
  }

  if (canvas && !panel.dataset.collapsed) {
    initCanvasOnPanel(panel);
  }
}

function initCanvasOnPanel(panel) {
  const canvas = panel.querySelector('#semantic-map-canvas');
  if (!canvas) return;

  const { channels } = getState();
  const matches = discoveryService.getMatches();

  const peers = matches.map((m) => ({
    peerId: m.peerId,
    similarity: m.similarity,
    identity: { name: m.name, bio: m.bio },
    matchedTopics: channels?.map((c) => c.name) || [],
    isSynthetic: m.isSynthetic || false,
  }));

  initSpaceCanvas(canvas, {
    peers,
    selfPosition: { x: 0.5, y: 0.5 },
    onPeerClick: (peerId) => {
      document.dispatchEvent(new CustomEvent('isc:navigate-discover', { detail: { peerId } }));
      window.location.hash = '#/discover';
    },
  });
}

export function destroy() {
  destroySpaceCanvas();
}

export function update(container) {
  const { channels, activeChannelId } = getState();
  const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
  const connLabel = connected ? 'connected' : status;

  const body = container.querySelector('[data-testid="now-body"]');
  if (!body) return;

  body.innerHTML =
    channels.length === 0
      ? renderNoChannels(connected, connLabel)
      : renderChannelRows(channels, activeChannelId);
}
