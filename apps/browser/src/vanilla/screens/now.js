/**
 * Now Screen — Semantic "For You" feed
 * Shows posts ranked by similarity to the user's active channel.
 * If no channels exist, guides user to create one first.
 */

import { feedService, postService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.js';
import { getState, actions } from '../../state.js';
import { escapeHtml } from '../../utils/dom.js';
import { formatTime } from '../../utils/time.js';
import { toasts } from '../../utils/toast.js';

let refreshing = false;

export function render() {
  const { channels, activeChannelId } = getState();
  const posts      = feedService.getForYou(50);
  const netStatus  = networkService.getStatus();
  const connected  = netStatus?.connected ?? false;
  const connLabel  = connected ? 'connected' : (netStatus?.status ?? 'disconnected');
  // Use the first channel as fallback when no channel is explicitly active
  const effectiveChannelId = activeChannelId ?? channels?.[0]?.id ?? null;
  const activeChannel = channels?.find(c => c.id === effectiveChannelId);

  return `
    <div class="screen now-screen" data-testid="now-screen">
      <div class="screen-header" data-testid="now-header">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          <h1 class="screen-title">🏠 Now</h1>
          ${activeChannel
            ? `<span class="active-channel-badge" data-testid="active-channel-badge" title="Active channel — posts are ranked by similarity to this channel">
                 <span style="opacity:.5">#</span>${escapeHtml(activeChannel.name)}
               </span>`
            : `<span class="screen-subtitle">For You</span>`}
        </div>
        <div class="header-actions">
          <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">
            ${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}
          </span>
          <button class="btn btn-icon" id="now-refresh" title="Refresh feed" data-testid="refresh-feed" aria-label="Refresh feed">↻</button>
          <button class="btn btn-primary btn-sm" id="go-compose" data-testid="create-channel-button" aria-label="Create new channel">+ Channel</button>
        </div>
      </div>

      <div class="screen-body" data-testid="now-body">
        ${renderComposeArea(channels, effectiveChannelId, activeChannel)}
        <div id="now-feed" data-testid="feed-container" data-component="feed" data-feed="for-you">
          ${posts.length === 0 ? renderEmpty(channels, connected, connLabel) : renderPosts(posts, channels)}
        </div>
      </div>
    </div>
  `;
}

function renderComposeArea(channels, activeChannelId, activeChannel) {
  if (!channels?.length) return '';

  return `
    <div class="compose-area" data-testid="compose-container">
      <form id="compose-form" data-testid="compose-form">
        ${channels.length > 1 ? `
          <div class="compose-channel-select">
            <select id="compose-channel-sel" class="form-select" style="margin-bottom:10px;font-size:13px" aria-label="Post to channel">
              ${channels.map(ch => `
                <option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>
                  #${escapeHtml(ch.name)}
                </option>
              `).join('')}
            </select>
          </div>
        ` : activeChannel ? `
          <div class="compose-channel-label">
            <span class="channel-pill">#${escapeHtml(activeChannel.name)}</span>
          </div>
        ` : ''}
        <textarea
          class="compose-input"
          id="compose-input"
          placeholder="Share a thought…"
          name="content"
          rows="3"
          maxlength="2000"
          data-testid="compose-input"
          aria-label="Compose a post"
        ></textarea>
        <div class="compose-footer">
          <span class="compose-count" data-testid="compose-count">0 / 2000</span>
          <button type="submit" class="btn btn-primary btn-sm" data-testid="compose-submit" disabled>Post</button>
        </div>
      </form>
    </div>
  `;
}

function renderEmpty(channels, connected, connLabel) {
  if (!channels?.length) {
    return `
      <div class="empty-state" data-testid="now-empty-state">
        <div class="empty-state-icon">💭</div>
        <div class="empty-state-title">What are you thinking about?</div>
        <div class="empty-state-description">
          Create a <strong>channel</strong> — a short description of your current thoughts.
          ISC will embed it locally and find peers thinking similar things.
        </div>
        <a class="btn btn-primary" href="#/compose" data-testid="now-empty-cta">✏️ Create Your First Channel</a>
      </div>

      <div class="card card-blue mt-4" data-testid="now-how-it-works">
        <div class="card-title">🧠 How ISC Works</div>
        <div class="how-it-works-steps">
          <div class="how-step">
            <span class="how-step-num">1</span>
            <div>
              <strong>Describe your thought</strong>
              <p>Write a channel description — your words, your voice.</p>
            </div>
          </div>
          <div class="how-step">
            <span class="how-step-num">2</span>
            <div>
              <strong>Local AI creates your vector</strong>
              <p>A tiny LLM runs in your browser, turning your description into a 384-dimensional idea-fingerprint. Your text never leaves your device.</p>
            </div>
          </div>
          <div class="how-step">
            <span class="how-step-num">3</span>
            <div>
              <strong>Find your thought neighbors</strong>
              <p>Peers with similar mental models appear in Discover — ranked by how close your ideas are in semantic space.</p>
            </div>
          </div>
          <div class="how-step">
            <span class="how-step-num">4</span>
            <div>
              <strong>Connect directly</strong>
              <p>No servers, no algorithms. Pure peer-to-peer WebRTC. Your conversations are end-to-end encrypted.</p>
            </div>
          </div>
        </div>
      </div>

      ${!connected ? `
        <div class="info-banner warning mt-4" data-testid="network-warning">
          ○ Network is ${escapeHtml(connLabel)} — connect to find peers
        </div>
      ` : ''}
    `;
  }

  return `
    <div class="empty-state" data-testid="now-empty-state">
      <div class="empty-state-icon">📭</div>
      <div class="empty-state-title">No posts yet</div>
      <div class="empty-state-description">
        ${connected
          ? 'Post something to your channel, or discover peers and see what they\'re sharing.'
          : 'Connect to the network to see posts from peers with similar interests.'}
      </div>
      <div class="form-actions" style="justify-content:center">
        <a href="#/discover" class="btn btn-primary">📡 Discover Peers</a>
      </div>
    </div>
    ${!connected ? `
      <div class="info-banner warning mt-4" data-testid="network-warning">
        ○ Network is ${escapeHtml(connLabel)} — posts will appear when connected
      </div>
    ` : ''}
  `;
}

function renderPosts(posts, channels) {
  return `
    <div class="post-count text-muted mb-2" style="font-size:12px" data-testid="post-count">
      ${posts.length} post${posts.length !== 1 ? 's' : ''}
    </div>
    ${posts.map(p => renderPost(p, channels)).join('')}
  `;
}

function renderPost(post, channels) {
  const author   = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const initials = (post.author || post.identity?.name || 'A')[0].toUpperCase();
  const content  = escapeHtml(post.content || '');
  const time     = post.timestamp ? formatTime(post.timestamp) : '';
  const channel  = channels?.find(c => c.id === post.channelId);
  const chanName = channel ? escapeHtml(channel.name) : (post.channelId ? escapeHtml(post.channelId.slice(0, 12)) : '');
  const likes    = post.likes?.length ?? 0;
  const replies  = post.replies?.length ?? 0;
  const score    = post.score != null ? Math.round(post.score * 100) : null;

  return `
    <div class="post-card" data-testid="post-card" data-component="post" data-post-id="${escapeHtml(post.id)}">
      <div class="post-header">
        <div class="post-avatar">${initials}</div>
        <div style="flex:1;min-width:0">
          <span class="post-author">${author}</span>
          ${chanName ? `<span class="post-channel">#${chanName}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${score != null ? `<span class="post-score" title="Semantic relevance to your channels">${score}%</span>` : ''}
          <span class="post-time">${time}</span>
        </div>
      </div>
      <div class="post-content" data-testid="post-content">${content}</div>
      <div class="post-actions">
        <button class="post-action-btn" data-action="like" data-like-btn data-post-id="${escapeHtml(post.id)}"
                data-liked="false" data-testid="like-btn-${escapeHtml(post.id)}" aria-label="Like post">
          ♡ <span class="like-count">${likes}</span>
        </button>
        <button class="post-action-btn" data-action="reply" data-reply-btn data-post-id="${escapeHtml(post.id)}"
                data-testid="reply-btn-${escapeHtml(post.id)}" aria-label="Reply">
          ↩ ${replies}
        </button>
        <button class="post-action-btn" data-action="delete" data-delete-btn data-post-id="${escapeHtml(post.id)}"
                data-testid="delete-btn-${escapeHtml(post.id)}" style="margin-left:auto" aria-label="Delete post">
          🗑
        </button>
      </div>
    </div>
  `;
}

export function bind(container) {
  // Refresh button
  container.querySelector('#now-refresh')?.addEventListener('click', () => {
    doRefresh(container);
  });

  // Navigate to compose
  container.querySelector('#go-compose')?.addEventListener('click', () => {
    window.location.hash = '#/compose';
  });

  // Channel selector
  container.querySelector('#compose-channel-sel')?.addEventListener('change', e => {
    actions.setActiveChannel(e.target.value);
  });

  // Compose form
  const composeForm  = container.querySelector('#compose-form');
  const composeInput = container.querySelector('#compose-input');
  const composeCount = container.querySelector('[data-testid="compose-count"]');
  const submitBtn    = container.querySelector('[data-testid="compose-submit"]');

  composeInput?.addEventListener('input', () => {
    const len = composeInput.value.length;
    if (composeCount) composeCount.textContent = `${len} / 2000`;
    if (submitBtn) submitBtn.disabled = len === 0;
    // Auto-grow textarea
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

  // Ctrl+Enter to submit
  composeInput?.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') composeForm?.requestSubmit();
  });

  // Post actions (delegated)
  container.addEventListener('click', e => {
    const likeBtn   = e.target.closest('[data-like-btn]');
    const replyBtn  = e.target.closest('[data-reply-btn]');
    const deleteBtn = e.target.closest('[data-delete-btn]');

    if (likeBtn) {
      const liked = likeBtn.dataset.liked === 'true';
      likeBtn.dataset.liked = liked ? 'false' : 'true';
      likeBtn.classList.toggle('liked', !liked);
      const counter = likeBtn.querySelector('.like-count');
      if (counter) counter.textContent = String(parseInt(counter.textContent || '0') + (liked ? -1 : 1));
      document.dispatchEvent(new CustomEvent('isc:like-post', { detail: { postId: likeBtn.dataset.postId } }));
    }
    if (replyBtn)  document.dispatchEvent(new CustomEvent('isc:reply-post',  { detail: { postId: replyBtn.dataset.postId } }));
    if (deleteBtn) document.dispatchEvent(new CustomEvent('isc:delete-post', { detail: { postId: deleteBtn.dataset.postId } }));
  });
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
    ? renderEmpty(channels, connected, connLabel)
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
    // Let the network discover any new posts
    await networkService.discoverPeers?.().catch(() => {});
    update(container);
  } finally {
    refreshing = false;
    if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
  }
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}
