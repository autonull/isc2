import { feedService, discoveryService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions } from '../../state.js';
import { escapeHtml } from '../utils/dom.js';
import { formatTime } from '../../utils/time.js';
import { renderEmpty } from '../utils/screen.js';
import { initSpaceCanvas, destroySpaceCanvas } from '../utils/spaceCanvas.js';

export function render() {
  const { channels, activeChannelId } = getState();
  const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
  const connLabel = connected ? 'connected' : status;
  const matches = discoveryService.getMatches();

  return `
    <div class="screen now-screen" data-testid="now-screen">
      ${renderHeader(connected, connLabel, matches.length)}
      ${channels.length >= 2 ? renderSemanticMap(channels) : ''}
      <div class="screen-body now-body" data-testid="now-body">
        ${channels.length === 0 ? renderNoChannels(connected, connLabel, matches.length) : renderChannelRows(channels, activeChannelId)}
      </div>
    </div>
  `;
}

function renderSemanticMap(channels) {
  const isCollapsed = localStorage.getItem('isc:semantic-map-collapsed') === 'true';
  return `
    <div class="semantic-map-panel" data-testid="semantic-map-panel"${isCollapsed ? ' data-collapsed="true"' : ''}>
      <div class="semantic-map-header" data-action="toggle-map" data-testid="semantic-map-header">
        <span class="semantic-map-title">
          ${isCollapsed ? '▶' : '▼'} Your ${channels.length} channel${channels.length === 1 ? 's' : ''} span${channels.length === 1 ? 's' : ''} ${Math.min(channels.length, 3)} distinct region${Math.min(channels.length, 3) === 1 ? 's' : ''}
        </span>
      </div>
      ${isCollapsed ? '' : '<div class="semantic-map-container"><canvas id="semantic-map-canvas" data-testid="semantic-map-canvas"></canvas></div>'}
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
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}</span>
        ${peerLabel ? `<span class="header-peer-count" data-testid="peer-count"> · ${peerLabel}</span>` : ''}
      </div>
    </div>
  `;
}

function renderNoChannels(connected, connLabel, peerCount) {
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
    ${peerCount === 0 && connected ? renderColdStartBanner() : ''}
  `;
}

function renderColdStartBanner() {
  return `
    <div class="cold-start-banner" data-testid="cold-start-banner">
      💡 More useful with more people. <button data-action="share-link" data-testid="share-link-btn">Share Link</button> or <button data-action="learn-relay" data-testid="learn-relay-btn">Connect via Relay</button>
    </div>
  `;
}

function renderChannelRows(channels, activeChannelId) {
  const yourSpaceBtn =
    channels.length > 1
      ? `<button class="btn btn-primary btn-your-space" data-action="see-all" data-testid="your-space-btn">Your Space (all channels)</button>`
      : '';
  return `<div class="now-channel-list" data-testid="now-channel-list">${yourSpaceBtn}${channels.map((ch) => renderChannelRow(ch, activeChannelId)).join('')}</div>`;
}

function renderChannelRow(channel, activeChannelId) {
  const posts = feedService.getByChannel(channel.id);
  const latestPost = posts.at(-1);
  const unreadCount = posts.filter((p) => !p.read).length;
  const preview = latestPost
    ? escapeHtml((latestPost.content || '').slice(0, 80)) +
      (latestPost.content?.length > 80 ? '…' : '')
    : '<span class="now-row-empty">No messages yet</span>';
  const time = latestPost?.timestamp ? formatTime(latestPost.timestamp) : '';

  return `
    <div class="now-channel-row${channel.id === activeChannelId ? ' active' : ''}" data-testid="now-channel-row-${escapeHtml(channel.id)}" data-channel-id="${escapeHtml(channel.id)}" tabindex="0" role="button" aria-label="Channel ${escapeHtml(channel.name)}${unreadCount > 0 ? `, ${unreadCount} unread` : ''}">
      <div class="now-row-icon">#</div>
      <div class="now-row-content">
        <div class="now-row-header"><span class="now-row-name">${escapeHtml(channel.name)}</span><span class="now-row-time">${time}</span></div>
        <div class="now-row-preview">${preview}</div>
        <div class="now-row-meta">${channel.description ? `<span class="now-row-desc">${escapeHtml(channel.description.slice(0, 40))}${channel.description.length > 40 ? '…' : ''}</span>` : ''}</div>
      </div>
      ${unreadCount > 0 ? `<span class="now-row-unread" aria-label="${unreadCount} unread">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
    </div>
  `;
}

export function bind(container) {
  bindSemanticMap(container);
  container.addEventListener('click', handleRowClick);
  container.addEventListener('keydown', handleKeydown);
}

function handleRowClick(e) {
  const row = e.target.closest('.now-channel-row');
  if (row?.dataset.channelId) {
    actions.setActiveChannel(row.dataset.channelId);
    window.location.hash = '#/channel';
    return;
  }

  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'new-channel') {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('isc:new-channel'));
    return;
  }
  if (action === 'see-all') {
    e.preventDefault();
    actions.setActiveChannel(null);
    window.location.hash = '#/channel';
    return;
  }
  if (action === 'share-link') {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('isc:share-link'));
    return;
  }
  if (action === 'learn-relay') {
    e.preventDefault();
    window.location.hash = '#/settings';
  }
}

function handleKeydown(e) {
  const row = e.target.closest('.now-channel-row');
  if (row && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    row.click();
  }
}

function bindSemanticMap(container) {
  const panel = container.querySelector('.semantic-map-panel');
  if (!panel) return;

  const header = panel.querySelector('[data-action="toggle-map"]');
  if (header) {
    header.addEventListener('click', () => {
      const isCollapsed = panel.dataset.collapsed === 'true';
      panel.dataset.collapsed = String(!isCollapsed);
      localStorage.setItem('isc:semantic-map-collapsed', String(!isCollapsed));
      if (!isCollapsed) initCanvasOnPanel(panel);
    });
  }

  if (!panel.dataset.collapsed) initCanvasOnPanel(panel);
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
  const body = container.querySelector('[data-testid="now-body"]');
  if (!body) return;
  body.innerHTML =
    channels.length === 0
      ? renderNoChannels(connected, status, discoveryService.getMatches().length)
      : renderChannelRows(channels, activeChannelId);
}
