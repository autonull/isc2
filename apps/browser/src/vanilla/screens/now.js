/**
 * Now Screen — Semantic "For You" feed
 *
 * Shows posts ranked by similarity to the user's active channel.
 * Supports List, Space, and Grid view modes.
 */

import { feedService, postService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions } from '../../state.js';
import { channelSettingsService } from '../../services/channelSettings.js';
import { toasts } from '../../utils/toast.js';
import { formatTime } from '../../utils/time.js';
import { escapeHtml } from '../utils/dom.js';
import { renderEmpty, renderList, bindDelegate, autoGrow, setupCtrlEnterSubmit } from '../utils/screen.js';
import { renderMixerPanel, bindMixerPanel } from '../components/mixerPanel.js';
import { modals } from '../components/modal.js';
import {
  shouldShowThoughtTwinNotification,
  acknowledgeThoughtTwin,
  dismissThoughtTwin,
} from '../../services/thoughtTwin.ts';

let refreshing = false;
let viewModeUnsubscribe = null;

export function render() {
  const { channels, activeChannelId } = getState();
  const posts = feedService.getForYou(50);
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;
  const connLabel = connected ? 'connected' : (netStatus?.status ?? 'disconnected');
  const effectiveChannelId = activeChannelId ?? channels?.[0]?.id ?? null;
  const activeChannel = channels?.find(c => c.id === effectiveChannelId);
  const viewMode = activeChannel ? channelSettingsService.getSettings(activeChannel.id).viewMode : 'list';

  return `
    <div class="screen now-screen" data-testid="now-screen">
      ${renderHeader(activeChannel, connected, connLabel)}
      <div class="screen-body now-body" data-testid="now-body">
        <div id="mixer-container">${activeChannel ? renderMixerPanel(activeChannel) : ''}</div>
        <div id="now-feed" class="feed-view-${viewMode}" data-testid="feed-container" data-component="feed" data-feed="for-you">
          ${posts.length === 0 ? renderEmptyState(channels, connected, connLabel) : renderPosts(posts, channels, viewMode)}
        </div>
      </div>
      ${channels.length ? renderComposeArea(channels, effectiveChannelId, activeChannel) : ''}
    </div>
  `;
}

function renderHeader(activeChannel, connected, connLabel) {
  return `
    <div class="screen-header" data-testid="now-header">
      <div class="screen-title-wrap">
        <h1 class="screen-title">🏠 Now</h1>
        ${activeChannel
          ? `<span class="active-channel-badge" data-testid="active-channel-badge" title="Your active channel">
               <span class="channel-prefix">#</span>${escapeHtml(activeChannel.name)}
             </span>`
          : `<span class="screen-subtitle">For You</span>`}
      </div>
      <div class="header-actions">
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">
          ${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}
        </span>
        <button class="btn btn-icon" id="now-refresh" title="Refresh feed" data-testid="refresh-feed">↻</button>
        <button class="btn btn-primary btn-sm" id="go-compose" data-testid="create-channel-button">+ Channel</button>
      </div>
    </div>
  `;
}

function renderComposeArea(channels, activeChannelId, activeChannel) {
  if (!channels?.length) return '';

  return `
    <div class="compose-area" data-testid="compose-container">
      <form id="compose-form" data-testid="compose-form">
        ${channels.length > 1
          ? `
            <div class="compose-channel-select">
              <select id="compose-channel-sel" class="form-select form-select-sm">
                ${channels.map(ch => `
                  <option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>
                    #${escapeHtml(ch.name)}
                  </option>
                `).join('')}
              </select>
            </div>
          `
          : activeChannel
            ? `<div class="compose-channel-label"><span class="channel-pill">#${escapeHtml(activeChannel.name)}</span></div>`
            : ''}
        <textarea
          class="compose-input"
          id="compose-input"
          placeholder="Share a thought…"
          name="content"
          rows="3"
          maxlength="2000"
          data-testid="compose-input"
        ></textarea>
        <div class="compose-footer">
          <span class="compose-count hidden" data-testid="compose-count">0 / 2000</span>
          <button type="submit" class="btn btn-primary btn-sm" data-testid="compose-submit" disabled>Post</button>
        </div>
      </form>
    </div>
  `;
}

function renderEmptyState(channels, connected, connLabel) {
  if (!channels?.length) {
    return `
      ${renderEmpty({
        icon: '💭',
        title: 'What are you thinking about?',
        description: "Create a channel — describe what's on your mind. ISC will find people on the same wavelength.",
        actions: [{ label: 'Create Your First Channel', href: '#/compose', variant: 'primary' }],
      })}

      <details class="explainer-details mt-4">
        <summary class="explainer-summary">How does ISC work?</summary>
        <div class="card card-blue mt-2">
          <div class="card-title">🧠 How ISC Works</div>
          <div class="how-it-works-steps">
            ${renderHowStep(1, 'Describe your thought', 'Write a channel description — your words, your voice.')}
            ${renderHowStep(2, 'Local AI creates your vector', 'A tiny LLM runs in your browser, turning your description into a 384-dimensional idea-fingerprint. Your text never leaves your device.')}
            ${renderHowStep(3, 'Find your thought neighbors', 'Peers with similar mental models appear in Discover — ranked by how close your ideas are in semantic space.')}
            ${renderHowStep(4, 'Connect directly', 'No servers, no algorithms. Pure peer-to-peer WebRTC. Your conversations are end-to-end encrypted.')}
          </div>
        </div>
      </details>

      ${!connected ? `<div class="info-banner warning mt-4">○ Network is ${escapeHtml(connLabel)} — you can still create channels offline</div>` : ''}
    `;
  }

  return renderEmpty({
    icon: '📭',
    title: 'No posts yet',
    description: connected
      ? 'Post something to your channel, or discover peers and see what they\'re sharing.'
      : 'Connect to the network to find peers with similar interests.',
    actions: [{ label: '📡 Discover Peers', href: '#/discover', variant: 'primary' }],
  });
}

function renderHowStep(num, title, desc) {
  return `
    <div class="how-step">
      <span class="how-step-num">${num}</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(desc)}</p>
      </div>
    </div>
  `;
}

function renderPosts(posts, channels, viewMode = 'list') {
  const countHtml = `
    <div class="post-count text-muted mb-2" data-testid="post-count">
      ${posts.length} post${posts.length !== 1 ? 's' : ''}
    </div>
  `;

  switch (viewMode) {
    case 'grid':
      return countHtml + renderGridPosts(posts, channels);
    case 'space':
      return countHtml + renderSpacePosts(posts, channels);
    case 'list':
    default:
      return countHtml + renderListPosts(posts, channels);
  }
}

function renderListPosts(posts, channels) {
  return `<div class="feed-list">${posts.map(p => renderPost(p, channels)).join('')}</div>`;
}

function renderGridPosts(posts, channels) {
  return `
    <div class="feed-grid">
      ${posts.map(p => renderPostCard(p, channels)).join('')}
    </div>
  `;
}

function renderSpacePosts(posts, channels) {
  return `
    <div class="feed-space">
      ${posts.map((p, i) => renderSpacePost(p, channels, i)).join('')}
    </div>
  `;
}

function renderPost(post, channels) {
  return renderPostCard(post, channels, true);
}

function renderPostCard(post, channels, showActions = true) {
  const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const initials = (post.author || post.identity?.name || 'A')[0].toUpperCase();
  const content = escapeHtml(post.content || '');
  const time = post.timestamp ? formatTime(post.timestamp) : '';
  const channel = channels?.find(c => c.id === post.channelId);
  const chanName = channel ? escapeHtml(channel.name) : (post.channelId ? escapeHtml(post.channelId.slice(0, 12)) : '');
  const likes = post.likes?.length ?? 0;
  const replies = post.replies?.length ?? 0;
  const score = post.score != null ? Math.round(post.score * 100) : null;

  const myIdentity = networkService.getIdentity();
  const myPeerId = myIdentity?.peerId ?? myIdentity?.pubkey;
  const isOwn = post.identity?.peerId === myPeerId || post.identity?.pubkey === myPeerId;

  return `
    <div class="post-card" data-testid="post-card" data-component="post" data-post-id="${escapeHtml(post.id)}">
      <div class="post-header">
        <div class="post-avatar">${initials}</div>
        <div class="post-meta">
          <span class="post-author">${author}</span>
          ${chanName ? `<span class="post-channel">#${chanName}</span>` : ''}
        </div>
        <div class="post-meta-actions">
          ${score != null ? `<span class="post-score" title="Semantic relevance">${score}%</span>` : ''}
          <span class="post-time">${time}</span>
        </div>
      </div>
      <div class="post-content" data-testid="post-content">${content}</div>
      ${showActions ? `
      <div class="post-actions">
        <button class="post-action-btn" data-action="like" data-like-btn data-post-id="${escapeHtml(post.id)}"
                data-liked="false" data-testid="like-btn-${escapeHtml(post.id)}">
          <span aria-hidden="true">♡</span>
          <span class="post-action-label">Like</span>
          <span class="like-count">${likes}</span>
        </button>
        <button class="post-action-btn" data-action="reply" data-reply-btn data-post-id="${escapeHtml(post.id)}"
                data-testid="reply-btn-${escapeHtml(post.id)}">
          <span aria-hidden="true">↩</span>
          <span class="post-action-label">Reply</span>
          <span>${replies}</span>
        </button>
        ${isOwn ? `
        <button class="post-action-btn" data-action="delete" data-delete-btn data-post-id="${escapeHtml(post.id)}"
                data-testid="delete-btn-${escapeHtml(post.id)}" class="ml-auto">
          <span class="post-action-label">Delete</span>
        </button>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `;
}

function renderSpacePost(post, channels, index) {
  const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const content = escapeHtml(post.content || '');
  const score = post.score != null ? Math.round(post.score * 100) : null;
  
  // Pseudo-random positioning based on post ID for deterministic layout
  const seed = post.id.charCodeAt(0) + (post.id.charCodeAt(post.id.length - 1) || 0) + index;
  const left = 10 + (seed % 60);
  const top = 10 + ((seed * 7) % 80);
  const scale = 0.8 + ((seed * 13) % 40) / 100;
  
  return `
    <div class="space-post" data-testid="post-card" data-post-id="${escapeHtml(post.id)}"
         style="left:${left}%;top:${top}%;transform:scale(${scale})">
      <div class="space-post-content">
        <span class="space-post-author">${author}</span>
        <p class="space-post-text">${content.slice(0, 140)}${content.length > 140 ? '…' : ''}</p>
        ${score != null ? `<span class="space-post-score">${score}%</span>` : ''}
      </div>
    </div>
  `;
}

export function bind(container) {
  const { channels, activeChannelId } = getState();
  const activeChannel = channels?.find(c => c.id === activeChannelId);

  if (activeChannel) bindMixerPanel(container, activeChannel);

  // Check for ThoughtTwin notification
  shouldShowThoughtTwinNotification().then(notification => {
    if (!notification) return;
    const header = container.querySelector('[data-testid="now-header"]');
    if (!header) return;

    const banner = document.createElement('div');
    banner.className = 'thought-twin-banner';
    banner.innerHTML = `
      <span class="twin-icon">✦</span>
      <span>${escapeHtml(notification.message)}</span>
      <button data-twin-ack class="btn btn-primary btn-sm">Connect</button>
      <button data-twin-dismiss class="btn btn-ghost btn-sm">Later</button>
    `;
    header.after(banner);
    banner.querySelector('[data-twin-ack]')?.addEventListener('click', () => {
      acknowledgeThoughtTwin(notification.peerId);
      banner.remove();
      window.location.hash = '#/chats';
    });
    banner.querySelector('[data-twin-dismiss]')?.addEventListener('click', () => {
      dismissThoughtTwin(notification.peerId);
      banner.remove();
    });
  });

  container.querySelector('#now-refresh')?.addEventListener('click', () => doRefresh(container));
  container.querySelector('#go-compose')?.addEventListener('click', () => { window.location.hash = '#/compose'; });
  container.querySelector('#compose-channel-sel')?.addEventListener('change', e => {
    actions.setActiveChannel(e.target.value);
  });

  // Listen for view mode changes
  const handleViewChange = e => {
    const { mode } = e.detail || {};
    if (!mode) return;
    const feed = container.querySelector('#now-feed');
    if (!feed) return;
    feed.className = `feed-view-${mode}`;

    if (mode === 'space') {
      feed.innerHTML = `<canvas id="space-canvas" class="space-canvas" data-testid="space-canvas"></canvas>`;
      import('../utils/spaceCanvas.js').then(m => {
        const canvas = feed.querySelector('#space-canvas');
        const { matches } = getState();
        m.initSpaceCanvas(canvas, {
          peers: matches,
          selfPosition: { x: 0.5, y: 0.5 },
          onPeerClick: peerId => {
            window.location.hash = '#/chats';
            setTimeout(() =>
              document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }))
            , 100);
          },
        });
      });
    } else {
      import('../utils/spaceCanvas.js').then(m => m.destroySpaceCanvas());
      update(container);
    }
  };
  document.addEventListener('isc:channel-view-change', handleViewChange);

  const composeForm = container.querySelector('#compose-form');
  const composeInput = container.querySelector('#compose-input');
  const composeCount = container.querySelector('[data-testid="compose-count"]');
  const submitBtn = container.querySelector('[data-testid="compose-submit"]');

  composeInput?.addEventListener('input', () => {
    const len = composeInput.value.length;
    if (composeCount) {
      composeCount.textContent = `${len} / 2000`;
      composeCount.classList.toggle('hidden', len === 0);
    }
    if (submitBtn) submitBtn.disabled = len === 0;
    autoGrow(composeInput);
  });

  composeForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const content = composeInput?.value.trim();
    if (!content) return;

    const { channels, activeChannelId } = getState();
    const sel = container.querySelector('#compose-channel-sel');
    const targetChannelId = sel?.value || activeChannelId || channels?.[0]?.id;

    if (!targetChannelId) {
      document.dispatchEvent(new CustomEvent('isc:need-channel'));
      return;
    }

    try {
      composeInput.disabled = true;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '…'; }
      await postService.create(targetChannelId, content);
      composeInput.value = '';
      composeInput.style.height = '';
      if (composeCount) composeCount.textContent = '0 / 2000';
      document.dispatchEvent(new CustomEvent('isc:refresh-feed', { detail: { scrollToTop: true } }));
      toasts.success('Posted!');
    } catch (err) {
      toasts.error(err.message);
    } finally {
      composeInput.disabled = false;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Post'; }
      composeInput.focus();
    }
  });

  setupCtrlEnterSubmit(composeInput, composeForm);

  // Delegated post actions
  const unbindLike = bindDelegate(container, '[data-like-btn]', 'click', handleLike);
  const unbindReply = bindDelegate(container, '[data-reply-btn]', 'click', handleReply);
  const unbindDelete = bindDelegate(container, '[data-delete-btn]', 'click', handleDelete);

  return [
    unbindLike, unbindReply, unbindDelete,
    () => document.removeEventListener('isc:channel-view-change', handleViewChange),
  ];
}

function handleLike(e, target) {
  const wasLiked = target.dataset.liked === 'true';
  const counter = target.querySelector('.like-count');
  const delta = wasLiked ? -1 : 1;

  // Optimistic update
  target.dataset.liked = String(!wasLiked);
  target.classList.toggle('liked', !wasLiked);
  if (counter) counter.textContent = String(parseInt(counter.textContent || '0') + delta);

  // Persist with rollback on failure
  postService.like(target.dataset.postId).catch(() => {
    target.dataset.liked = String(wasLiked);
    target.classList.toggle('liked', wasLiked);
    if (counter) counter.textContent = String(parseInt(counter.textContent || '0') - delta);
    toasts.warning('Could not save like');
  });

  document.dispatchEvent(new CustomEvent('isc:like-post', { detail: { postId: target.dataset.postId } }));
}

function handleReply(e, target) {
  document.dispatchEvent(new CustomEvent('isc:reply-post', { detail: { postId: target.dataset.postId } }));
}

async function handleDelete(e, target) {
  const ok = await modals.confirm('Delete this post?', { title: 'Delete Post', confirmText: 'Delete', danger: true });
  if (!ok) return;

  try {
    await postService.delete(target.dataset.postId);
    document.dispatchEvent(new CustomEvent('isc:refresh-feed'));
    toasts.success('Post deleted');
  } catch (err) {
    toasts.error(err.message);
  }
}

export function update(container, { scrollToTop = false } = {}) {
  if (refreshing) return;
  const feed = container.querySelector('#now-feed');
  if (!feed) return;

  const { channels } = getState();
  const posts = feedService.getForYou(50);
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;
  const connLabel = connected ? 'connected' : (netStatus?.status ?? 'disconnected');

  feed.innerHTML = posts.length === 0
    ? renderEmptyState(channels, connected, connLabel)
    : renderPosts(posts, channels);

  if (scrollToTop) {
    const body = container.querySelector('[data-testid="now-body"]');
    if (body) body.scrollTop = 0;
  }
}

async function doRefresh(container) {
  if (refreshing) return;
  refreshing = true;

  const btn = container.querySelector('#now-refresh');
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }

  try {
    await networkService.discoverPeers?.().catch(() => {});
    update(container);
  } finally {
    refreshing = false;
    if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
  }
}

export function destroy() {
  import('../utils/spaceCanvas.js').then(m => m.destroySpaceCanvas());
  refreshing = false;
}
