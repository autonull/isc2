/**
 * Now Screen — Home Dashboard
 *
 * Default route (/now). Aggregates across all active channels.
 * Per-channel summary rows, unread counts, network status, convergence events.
 * Read-only: composing happens in the Channel screen.
 */

import { feedService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions } from '../../state.js';
import { escapeHtml } from '../utils/dom.js';
import { formatTime } from '../../utils/time.js';
import { renderEmpty, createScreen } from '../utils/screen.js';

export function render() {
  const { channels, activeChannelId } = getState();
  const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
  const connLabel = connected ? 'connected' : status;

  return `
    <div class="screen now-screen" data-testid="now-screen">
      ${renderHeader(connected, connLabel)}
      <div class="screen-body now-body" data-testid="now-body">
        ${channels.length === 0
          ? renderNoChannels(connected, connLabel)
          : renderChannelRows(channels, activeChannelId)
        }
      </div>
    </div>
  `;
}

function renderHeader(connected, connLabel) {
  return `
    <div class="screen-header now-header" data-testid="now-header">
      <h1 class="screen-title" data-testid="now-title">Now</h1>
      <div class="header-status">
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">
          ${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}
        </span>
      </div>
    </div>
  `;
}

function renderNoChannels(connected, connLabel) {
  return `
    ${renderEmpty({
      icon: '💭',
      title: 'What are you thinking about?',
      description: "Create a channel to start. ISC will place you in a neighborhood of semantic space — everyone whose channel lands nearby hears what you post.",
      actions: [{ label: 'Create a channel', href: '#', 'data-action': 'new-channel', variant: 'primary' }],
    })}
    ${!connected ? `<div class="info-banner warning mt-4">○ Network is ${escapeHtml(connLabel)} — you can still create channels offline</div>` : ''}
  `;
}

function renderChannelRows(channels, activeChannelId) {
  const rows = channels.map(ch => renderChannelRow(ch, activeChannelId)).join('');
  return `
    <div class="now-channel-list" data-testid="now-channel-list">
      ${rows}
    </div>
  `;
}

function renderChannelRow(channel, activeChannelId) {
  const posts = feedService.getByChannel(channel.id);
  const latestPost = posts.at(-1);
  const unreadCount = posts.filter(p => !p.read).length;
  const isActive = channel.id === activeChannelId;

  const preview = latestPost
    ? escapeHtml((latestPost.content || '').slice(0, 80)) + (latestPost.content?.length > 80 ? '…' : '')
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
        ${channel.description ? `<div class="now-row-desc">${escapeHtml(channel.description.slice(0, 60))}${channel.description.length > 60 ? '…' : ''}</div>` : ''}
      </div>
      ${unreadCount > 0 ? `<span class="now-row-unread" aria-label="${unreadCount} unread">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
    </div>
  `;
}

export function bind(container) {
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

export function update(container) {
  const { channels, activeChannelId } = getState();
  const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
  const connLabel = connected ? 'connected' : status;

  const body = container.querySelector('[data-testid="now-body"]');
  if (!body) return;

  body.innerHTML = channels.length === 0
    ? renderNoChannels(connected, connLabel)
    : renderChannelRows(channels, activeChannelId);
}
