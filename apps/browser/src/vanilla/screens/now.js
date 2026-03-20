/**
 * Now Screen — Semantic "For You" feed
 *
 * Shows posts ranked by similarity to the user's active channel.
 */

import { feedService, postService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions } from '../../state.js';
import { toasts } from '../../utils/toast.js';
import { formatTime } from '../../utils/time.js';
import { escapeHtml } from '../utils/dom.js';
import { renderEmpty, renderList, bindDelegate, autoGrow, setupCtrlEnterSubmit } from '../utils/screen.js';
import { renderMixerPanel, bindMixerPanel } from '../components/mixerPanel.js';

let refreshing = false;

export function render() {
  const { channels, activeChannelId } = getState();
  const posts = feedService.getForYou(50);
  const netStatus = networkService.getStatus();
  const connected = netStatus?.connected ?? false;
  const connLabel = connected ? 'connected' : (netStatus?.status ?? 'disconnected');
  const effectiveChannelId = activeChannelId ?? channels?.[0]?.id ?? null;
  const activeChannel = channels?.find(c => c.id === effectiveChannelId);

  return `
    <div class="screen now-screen" data-testid="now-screen">
      ${renderHeader(activeChannel, connected, connLabel)}
      <div class="screen-body" data-testid="now-body">
        <div id="mixer-container">${activeChannel ? renderMixerPanel(activeChannel) : ''}</div>
        ${renderComposeArea(channels, effectiveChannelId, activeChannel)}
        <div id="now-feed" data-testid="feed-container" data-component="feed" data-feed="for-you">
          ${posts.length === 0 ? renderEmptyState(channels, connected, connLabel) : renderPosts(posts, channels)}
        </div>
      </div>
    </div>
  `;
}

function renderHeader(activeChannel, connected, connLabel) {
  return `
    <div class="screen-header" data-testid="now-header">
      <div style="display:flex;align-items:center;gap:12px;min-width:0">
        <h1 class="screen-title">🏠 Now</h1>
        ${activeChannel
          ? `<span class="active-channel-badge" data-testid="active-channel-badge" title="Active channel">
               <span style="opacity:.5">#</span>${escapeHtml(activeChannel.name)}
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
              <select id="compose-channel-sel" class="form-select" style="margin-bottom:10px;font-size:13px">
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
          <span class="compose-count" data-testid="compose-count">0 / 2000</span>
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
        description: 'Create a <strong>channel</strong> — a short description of your current thoughts. ISC will embed it locally and find peers thinking similar things.',
        actions: [{ label: '✏️ Create Your First Channel', href: '#/compose', variant: 'primary' }],
      })}

      <div class="card card-blue mt-4" data-testid="now-how-it-works">
        <div class="card-title">🧠 How ISC Works</div>
        <div class="how-it-works-steps">
          ${renderHowStep(1, 'Describe your thought', 'Write a channel description — your words, your voice.')}
          ${renderHowStep(2, 'Local AI creates your vector', 'A tiny LLM runs in your browser, turning your description into a 384-dimensional idea-fingerprint. Your text never leaves your device.')}
          ${renderHowStep(3, 'Find your thought neighbors', 'Peers with similar mental models appear in Discover — ranked by how close your ideas are in semantic space.')}
          ${renderHowStep(4, 'Connect directly', 'No servers, no algorithms. Pure peer-to-peer WebRTC. Your conversations are end-to-end encrypted.')}
        </div>
      </div>

      ${!connected ? `<div class="info-banner warning mt-4">○ Network is ${escapeHtml(connLabel)} — connect to find peers</div>` : ''}
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

function renderPosts(posts, channels) {
  return `
    <div class="post-count text-muted mb-2" style="font-size:12px" data-testid="post-count">
      ${posts.length} post${posts.length !== 1 ? 's' : ''}
    </div>
    ${renderList(posts, p => renderPost(p, channels))}
  `;
}

function renderPost(post, channels) {
  const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const initials = (post.author || post.identity?.name || 'A')[0].toUpperCase();
  const content = escapeHtml(post.content || '');
  const time = post.timestamp ? formatTime(post.timestamp) : '';
  const channel = channels?.find(c => c.id === post.channelId);
  const chanName = channel ? escapeHtml(channel.name) : (post.channelId ? escapeHtml(post.channelId.slice(0, 12)) : '');
  const likes = post.likes?.length ?? 0;
  const replies = post.replies?.length ?? 0;
  const score = post.score != null ? Math.round(post.score * 100) : null;

  return `
    <div class="post-card" data-testid="post-card" data-component="post" data-post-id="${escapeHtml(post.id)}">
      <div class="post-header">
        <div class="post-avatar">${initials}</div>
        <div style="flex:1;min-width:0">
          <span class="post-author">${author}</span>
          ${chanName ? `<span class="post-channel">#${chanName}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${score != null ? `<span class="post-score" title="Semantic relevance">${score}%</span>` : ''}
          <span class="post-time">${time}</span>
        </div>
      </div>
      <div class="post-content" data-testid="post-content">${content}</div>
      <div class="post-actions">
        <button class="post-action-btn" data-action="like" data-like-btn data-post-id="${escapeHtml(post.id)}"
                data-liked="false" data-testid="like-btn-${escapeHtml(post.id)}">
          ♡ <span class="like-count">${likes}</span>
        </button>
        <button class="post-action-btn" data-action="reply" data-reply-btn data-post-id="${escapeHtml(post.id)}"
                data-testid="reply-btn-${escapeHtml(post.id)}">
          ↩ ${replies}
        </button>
        <button class="post-action-btn" data-action="delete" data-delete-btn data-post-id="${escapeHtml(post.id)}"
                data-testid="delete-btn-${escapeHtml(post.id)}" style="margin-left:auto">
          🗑
        </button>
      </div>
    </div>
  `;
}

export function bind(container) {
  const { channels, activeChannelId } = getState();
  const activeChannel = channels?.find(c => c.id === activeChannelId);

  if (activeChannel) bindMixerPanel(container, activeChannel);

  container.querySelector('#now-refresh')?.addEventListener('click', () => doRefresh(container));
  container.querySelector('#go-compose')?.addEventListener('click', () => { window.location.hash = '#/compose'; });
  container.querySelector('#compose-channel-sel')?.addEventListener('change', e => {
    actions.setActiveChannel(e.target.value);
  });

  const composeForm = container.querySelector('#compose-form');
  const composeInput = container.querySelector('#compose-input');
  const composeCount = container.querySelector('[data-testid="compose-count"]');
  const submitBtn = container.querySelector('[data-testid="compose-submit"]');

  composeInput?.addEventListener('input', () => {
    const len = composeInput.value.length;
    if (composeCount) composeCount.textContent = `${len} / 2000`;
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

  return [unbindLike, unbindReply, unbindDelete];
}

function handleLike(e, target) {
  const liked = target.dataset.liked === 'true';
  target.dataset.liked = liked ? 'false' : 'true';
  target.classList.toggle('liked', !liked);
  const counter = target.querySelector('.like-count');
  if (counter) counter.textContent = String(parseInt(counter.textContent || '0') + (liked ? -1 : 1));
  document.dispatchEvent(new CustomEvent('isc:like-post', { detail: { postId: target.dataset.postId } }));
}

function handleReply(e, target) {
  document.dispatchEvent(new CustomEvent('isc:reply-post', { detail: { postId: target.dataset.postId } }));
}

async function handleDelete(e, target) {
  const { modals } = globalThis.ISC_SERVICES ?? {};
  if (!modals) return;

  const ok = await modals.confirm('Delete this post?', { title: '🗑️ Delete Post', confirmText: 'Delete', danger: true });
  if (!ok) return;

  const { postService } = globalThis.ISC_SERVICES ?? {};
  if (!postService) return;

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
