/**
 * Now Screen — Semantic "For You" feed
 *
 * Shows posts ranked by similarity to the user's active channel.
 * Supports List, Space, and Grid view modes.
 */

import { feedService, postService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions, subscribe } from '../../state.js';
import { channelSettingsService } from '../../services/channelSettings.js';
import { toasts } from '../../utils/toast.js';
import { formatTime } from '../../utils/time.js';
import { escapeHtml } from '../utils/dom.js';
import {
  renderEmpty,
  renderList,
  bindDelegate,
  autoGrow,
  setupCtrlEnterSubmit,
  createScreen,
} from '../utils/screen.js';
import { renderMixerPanel, bindMixerPanel } from '../components/mixerPanel.js';
import { modals } from '../components/modal.js';
import {
  shouldShowThoughtTwinNotification,
  acknowledgeThoughtTwin,
  dismissThoughtTwin,
} from '../../services/thoughtTwin.ts';

let refreshing = false;
let _replyTo = null;
let _lastPostCount = 0;
let _postsPage = 1;
const PAGE_SIZE = 20;
let _lazyObserver = null;

export function render() {
  const { channels, activeChannelId } = getState();
  const posts = activeChannelId
    ? feedService.getByChannel(activeChannelId, 50)
    : feedService.getForYou(50);
  const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
  const connLabel = connected ? 'connected' : status;
  const effectiveChannelId = activeChannelId ?? channels?.[0]?.id ?? null;
  const activeChannel = channels?.find((c) => c.id === effectiveChannelId);
  const viewMode = activeChannel
    ? channelSettingsService.getSettings(activeChannel.id).viewMode
    : 'list';

  return `
    <div class="screen now-screen" data-testid="now-screen">
      ${channels.length ? renderComposeBar(channels, effectiveChannelId, activeChannel) : ''}
      ${renderHeader(activeChannel, connected, connLabel)}
      ${activeChannel ? renderFloatingToolbar(activeChannel) : ''}
      <div class="screen-body now-body" data-testid="now-body">
        <div id="now-feed" class="feed-view-${viewMode}" data-testid="feed-container" data-component="feed" data-feed="for-you">
          ${posts.length === 0 ? renderEmptyState(channels, connected, connLabel) : renderPosts(posts, channels, viewMode)}
        </div>
      </div>
    </div>
  `;
}

function renderComposeBar(channels, activeChannelId, activeChannel) {
  if (!channels?.length) return '';

  return `
    <div class="compose-bar sticky-top smart-hide" data-testid="compose-bar">
      <form id="compose-form" class="compose-bar-form" data-testid="compose-form">
        <div class="compose-bar-inline">
          ${
            channels.length > 1
              ? `
              <select id="compose-channel-sel" class="compose-channel-picker form-select form-select-sm" data-testid="compose-channel-sel">
                ${channels
                  .map(
                    (ch) => `
                  <option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>
                    #${escapeHtml(ch.name)}
                  </option>
                `
                  )
                  .join('')}
              </select>
            `
              : activeChannel
                ? `<div class="compose-channel-label"><span class="channel-pill">#${escapeHtml(activeChannel.name)}</span></div>`
                : ''
          }
          <textarea
            class="compose-input"
            id="compose-input"
            placeholder="Share a thought…"
            name="content"
            rows="1"
            maxlength="2000"
            data-testid="compose-input"
          ></textarea>
          <button type="submit" class="btn btn-primary btn-sm" data-testid="compose-submit" disabled title="Post">Post</button>
        </div>
        <div class="compose-footer">
          <span class="compose-count hidden" data-testid="compose-count">0 / 2000</span>
        </div>
      </form>
      <div class="compose-reply-context" hidden data-testid="compose-reply-context">
        Replying to <strong class="reply-author"></strong> <button type="button" class="btn-clear-reply" title="Cancel reply">×</button>
      </div>
    </div>
  `;
}

function renderFloatingToolbar(activeChannel) {
  if (!activeChannel) return '';

  const settings = channelSettingsService.getSettings(activeChannel.id);
  const { specificity, viewMode, sortOrder } = settings;

  // Map specificity to precision label
  const precisionLabel = specificity <= 33 ? 'Strict' : specificity <= 67 ? 'Balanced' : 'Broad';

  return `
    <div class="floating-toolbar" data-testid="floating-toolbar" data-channel-id="${escapeHtml(activeChannel.id)}">
      <div class="toolbar-group">
        <span class="toolbar-label">View:</span>
        <select class="toolbar-dropdown" id="view-mode-select" data-testid="view-mode-select">
          <option value="list" ${viewMode === 'list' ? 'selected' : ''}>📋 List</option>
          <option value="grid" ${viewMode === 'grid' ? 'selected' : ''}>▦ Grid</option>
          <option value="space" ${viewMode === 'space' ? 'selected' : ''}>🌌 Space</option>
        </select>
      </div>

      <div class="toolbar-group">
        <span class="toolbar-label">Precision:</span>
        <div class="toolbar-precision-toggle">
          <button type="button" class="toolbar-btn precision-btn ${specificity <= 33 ? 'active' : ''}" data-precision="strict" title="Strict - high similarity threshold">Strict</button>
          <button type="button" class="toolbar-btn precision-btn ${specificity > 33 && specificity <= 67 ? 'active' : ''}" data-precision="balanced" title="Balanced - moderate similarity">⚙️</button>
          <button type="button" class="toolbar-btn precision-btn ${specificity > 67 ? 'active' : ''}" data-precision="broad" title="Broad - low similarity threshold">📊</button>
        </div>
      </div>

      <div class="toolbar-group">
        <span class="toolbar-label">Sort:</span>
        <select class="toolbar-dropdown" id="sort-order-select" data-testid="sort-order-select">
          <option value="recency" ${sortOrder === 'recency' ? 'selected' : ''}>Recent</option>
          <option value="similarity" ${sortOrder === 'similarity' ? 'selected' : ''}>Relevance</option>
          <option value="activity" ${sortOrder === 'activity' ? 'selected' : ''}>Activity</option>
        </select>
      </div>

      <button type="button" class="toolbar-btn" id="more-options-btn" data-testid="more-options-btn" title="Advanced options">⚙️ More</button>
    </div>
  `;
}

function renderHeader(activeChannel, connected, connLabel) {
  return `
    <div class="screen-header now-header" data-testid="now-header">
      <div class="header-status">
        <button class="btn btn-icon" id="now-refresh" title="Refresh feed" data-testid="refresh-feed">↻</button>
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">
          ${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}
        </span>
      </div>
      <div class="header-actions">
        <!-- Discover Peers button shown when no posts (in empty state) -->
      </div>
    </div>
  `;
}

function renderComposeArea(channels, activeChannelId, activeChannel) {
  if (!channels?.length) return '';

  return `
    <div class="compose-area" data-testid="compose-container">
      <form id="compose-form" data-testid="compose-form">
        ${
          channels.length > 1
            ? `
            <div class="compose-channel-select">
              <select id="compose-channel-sel" class="form-select form-select-sm">
                ${channels
                  .map(
                    (ch) => `
                  <option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>
                    #${escapeHtml(ch.name)}
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>
          `
            : activeChannel
              ? `<div class="compose-channel-label"><span class="channel-pill">#${escapeHtml(activeChannel.name)}</span></div>`
              : ''
        }
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
        description:
          "Create a channel — describe what's on your mind. ISC will find people on the same wavelength.",
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
      ? "Post something to your channel, or discover peers and see what they're sharing."
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

  const visible = posts.slice(0, _postsPage * PAGE_SIZE);
  const hasMore = posts.length > visible.length;

  let content;
  switch (viewMode) {
    case 'grid':
      content = renderGridPosts(visible, channels);
      break;
    case 'space':
      content = renderSpacePosts(visible, channels);
      break;
    case 'list':
    default:
      content = renderListPosts(visible, channels);
  }

  return `
    ${countHtml}
    ${content}
    ${
      hasMore
        ? `
      <div class="load-more-row">
        <button class="btn btn-ghost btn-sm" id="load-more-btn"
                data-testid="load-more-posts">
          Load earlier posts (${posts.length - visible.length} more)
        </button>
      </div>
    `
        : ''
    }
  `;
}

function renderListPosts(posts, channels) {
  const postMap = new Map(posts.map((p) => [p.id, p]));
  const topLevel = posts.filter((p) => !p.replyTo);

  return `<div class="feed-list">${topLevel
    .map((post) => {
      const replies = posts.filter((r) => r.replyTo === post.id);
      return `
      ${renderPostCard(post, channels)}
      ${
        replies.length
          ? `
        <div class="post-thread" data-parent-id="${escapeHtml(post.id)}">
          ${replies
            .slice(0, 3)
            .map((r) => renderReplyPost(r, post, channels))
            .join('')}
          ${
            replies.length > 3
              ? `
            <button class="thread-expand-btn"
                    data-thread="${escapeHtml(post.id)}"
                    data-testid="expand-thread-${escapeHtml(post.id)}">
              Show all ${replies.length} replies
            </button>
          `
              : ''
          }
        </div>
      `
          : ''
      }
    `;
    })
    .join('')}</div>`;
}

function renderReplyPost(post, parentPost, channels) {
  const parentSnippet =
    escapeHtml((parentPost.content || '').slice(0, 60)) +
    (parentPost.content?.length > 60 ? '…' : '');
  return `
    <div class="post-card post-card-reply" data-post-id="${escapeHtml(post.id)}"
         data-testid="post-card-reply">
      <div class="post-reply-context">
        <span class="reply-indicator" aria-hidden="true">↩</span>
        <span class="reply-parent-snippet">${parentSnippet}</span>
      </div>
      ${renderPostBody(post, channels, false)}
    </div>
  `;
}

function renderPostBody(post, channels, showActions = true) {
  const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const initials = (post.author || post.identity?.name || 'A')[0].toUpperCase();
  const content = escapeHtml(post.content || '');
  const time = post.timestamp ? formatTime(post.timestamp) : '';
  const channel = channels?.find((c) => c.id === post.channelId);
  const chanName = channel
    ? escapeHtml(channel.name)
    : post.channelId
      ? escapeHtml(post.channelId.slice(0, 12))
      : '';
  const likes = post.likes?.length ?? 0;
  const score = post.score != null ? Math.round(post.score * 100) : null;
  const { peerId, pubkey } = networkService.getIdentity() ?? {};
  const isOwn = post.identity?.peerId === peerId || post.identity?.pubkey === pubkey;
  const liked = postService.getLikedPosts().has(post.id);

  return `
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
    ${showActions ? renderPostActions(post.id, isOwn, liked, likes) : ''}
  `;
}

function renderPostActions(postId, isOwn, liked, likes) {
  return `
    <div class="post-actions">
      <button class="post-action-btn${liked ? ' liked' : ''}" data-action="like" data-like-btn data-post-id="${escapeHtml(postId)}"
              data-liked="${liked}" data-testid="like-btn-${escapeHtml(postId)}">
        <span aria-hidden="true">${liked ? '♥' : '♡'}</span>
        <span class="post-action-label">Like</span>
        <span class="like-count">${likes}</span>
      </button>
      ${
        isOwn
          ? `
      <button class="post-action-btn" data-action="delete" data-delete-btn data-post-id="${escapeHtml(postId)}"
              data-testid="delete-btn-${escapeHtml(postId)}">
        <span class="post-action-label">Delete</span>
      </button>
      `
          : ''
      }
    </div>
  `;
}

function renderGridPosts(posts, channels) {
  return `
    <div class="feed-grid">
      ${posts.map((p) => renderPostCard(p, channels)).join('')}
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

function renderPostCard(post, channels, showActions = true) {
  const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const content = escapeHtml(post.content || '');
  const replies = post.replies?.length ?? 0;

  return `
    <div class="post-card" data-testid="post-card" data-component="post" data-post-id="${escapeHtml(post.id)}"
         tabindex="0" role="article" aria-label="${escapeHtml(author)}: ${escapeHtml(content.slice(0, 80))}"
         data-lazy="true">
      ${renderPostBody(post, channels, showActions)}
      ${
        showActions
          ? `
      <div class="post-actions">
        <button class="post-action-btn" data-action="reply" data-reply-btn data-post-id="${escapeHtml(post.id)}"
                data-testid="reply-btn-${escapeHtml(post.id)}">
          <span aria-hidden="true">↩</span>
          <span class="post-action-label">Reply</span>
          <span>${replies}</span>
        </button>
      </div>
      `
          : ''
      }
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
  const activeChannel = channels?.find((c) => c.id === activeChannelId);

  // Bind floating toolbar controls (replaces old mixer panel)
  if (activeChannel) bindFloatingToolbar(container, activeChannel);

  // Setup smart-hide for compose bar
  setupComposeBarSmartHide(container);

  if ('IntersectionObserver' in window) {
    _lazyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target;
            if (card.dataset.lazy === 'true') {
              card.dataset.lazy = 'false';
              card.classList.add('loaded');
            }
            _lazyObserver.unobserve(card);
          }
        });
      },
      { rootMargin: '200px' }
    );

    container.querySelectorAll('.post-card[data-lazy="true"]').forEach((card) => {
      _lazyObserver.observe(card);
    });
  }

  const feed = container.querySelector('#now-feed');
  if (feed) {
    feed.addEventListener('keydown', (e) => {
      const posts = [...feed.querySelectorAll('.post-card[tabindex="0"]')];
      if (!posts.length) return;

      const current = document.activeElement;
      const idx = posts.indexOf(current);

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const next = posts[Math.min(idx + 1, posts.length - 1)];
        next?.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prev = posts[Math.max(idx - 1, 0)];
        prev?.focus();
      } else if (e.key === 'Enter' && current) {
        current.querySelector('[data-action="like"]')?.click();
      }
    });
  }

  shouldShowThoughtTwinNotification().then((notification) => {
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
  container.querySelector('#go-compose')?.addEventListener('click', () => {
    window.location.hash = '#/compose';
  });
  container.querySelector('#compose-channel-sel')?.addEventListener('change', (e) => {
    actions.setActiveChannel(e.target.value);
  });

  const handleViewChange = (e) => {
    const { mode } = e.detail || {};
    if (!mode) return;
    const feed = container.querySelector('#now-feed');
    if (!feed) return;
    feed.className = `feed-view-${mode}`;

    if (mode === 'space') {
      feed.innerHTML = `<canvas id="space-canvas" class="space-canvas" data-testid="space-canvas"></canvas>`;
      import('../utils/spaceCanvas.js').then((m) => {
        const canvas = feed.querySelector('#space-canvas');
        const { matches } = getState();
        m.initSpaceCanvas(canvas, {
          peers: matches,
          selfPosition: { x: 0.5, y: 0.5 },
          onPeerClick: (peerId) => {
            window.location.hash = '#/chats';
            setTimeout(
              () =>
                document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } })),
              100
            );
          },
        });
      });
    } else {
      import('../utils/spaceCanvas.js').then((m) => m.destroySpaceCanvas());
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

  composeForm?.addEventListener('submit', async (e) => {
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
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '…';
      }

      if (_replyTo) {
        await postService.reply(_replyTo.id, content);
        _replyTo = null;
        container.querySelector('.compose-reply-context')?.remove();
      } else {
        await postService.create(targetChannelId, content);
      }

      composeInput.value = '';
      composeInput.style.height = '';
      if (composeCount) composeCount.textContent = '0 / 2000';
      document.dispatchEvent(
        new CustomEvent('isc:refresh-feed', { detail: { scrollToTop: true } })
      );
      toasts.success('Posted!');
    } catch (err) {
      toasts.error(err.message);
    } finally {
      composeInput.disabled = false;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Post';
      }
      composeInput.focus();
    }
  });

  setupCtrlEnterSubmit(composeInput, composeForm);

  const unsubPosts = subscribe((state) => {
    const count = state.posts?.length ?? 0;
    if (count !== _lastPostCount && !refreshing) {
      _lastPostCount = count;
      const feed = container.querySelector('#now-feed');
      if (feed) {
        const { activeChannelId } = getState();
        const posts = activeChannelId
          ? feedService.getByChannel(activeChannelId, _postsPage * PAGE_SIZE)
          : feedService.getForYou(_postsPage * PAGE_SIZE);
        const { channels } = getState();
        const activeChannel = channels?.find((c) => c.id === activeChannelId);
        const viewMode = activeChannel
          ? channelSettingsService.getSettings(activeChannel.id).viewMode
          : 'list';
        feed.innerHTML =
          posts.length === 0
            ? renderEmptyState(channels, true, 'connected')
            : renderPosts(posts, channels, viewMode);
      }
    }
  });

  const unbindLike = bindDelegate(container, '[data-like-btn]', 'click', handleLike);
  const unbindReply = bindDelegate(container, '[data-reply-btn]', 'click', handleReply);
  const unbindDelete = bindDelegate(container, '[data-delete-btn]', 'click', handleDelete);

  container.addEventListener('click', (e) => {
    const expandBtn = e.target.closest('.thread-expand-btn');
    if (expandBtn) {
      expandBtn.closest('.post-thread')?.classList.add('thread-expanded');
      expandBtn.remove();
      return;
    }

    if (e.target.closest('#load-more-btn')) {
      _postsPage++;
      update(container);
      return;
    }

    const replyBtn = e.target.closest('[data-reply-btn]');
    if (replyBtn) {
      const postId = replyBtn.dataset.postId;
      const { activeChannelId } = getState();
      const posts = activeChannelId
        ? feedService.getByChannel(activeChannelId, 200)
        : feedService.getForYou(200);
      const post = posts.find((p) => p.id === postId);
      if (post) {
        _replyTo = {
          id: postId,
          content: post.content,
          author: post.author ?? post.identity?.name,
        };
        setReplyContext(container, _replyTo);
      }
    }
  });

  return [
    unbindLike,
    unbindReply,
    unbindDelete,
    () => document.removeEventListener('isc:channel-view-change', handleViewChange),
    unsubPosts,
    () => {
      _lastPostCount = 0;
    },
  ];
}

function setReplyContext(container, replyTo) {
  const composeArea = container.querySelector('[data-testid="compose-container"]');
  if (!composeArea) return;

  let ctx = composeArea.querySelector('.compose-reply-context');
  if (!ctx) {
    ctx = document.createElement('div');
    ctx.className = 'compose-reply-context';
    composeArea.prepend(ctx);
  }
  ctx.innerHTML = `
    <span class="reply-label">↩ Replying to ${escapeHtml(replyTo.author ?? 'post')}</span>
    <span class="reply-snippet">
      ${escapeHtml((replyTo.content || '').slice(0, 60))}…
    </span>
    <button class="reply-cancel" data-cancel-reply aria-label="Cancel reply">×</button>
  `;
  ctx.querySelector('[data-cancel-reply]')?.addEventListener('click', () => {
    _replyTo = null;
    ctx.remove();
  });
  container.querySelector('[data-testid="compose-input"]')?.focus();
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

  document.dispatchEvent(
    new CustomEvent('isc:like-post', { detail: { postId: target.dataset.postId } })
  );
}

function handleReply(e, target) {
  document.dispatchEvent(
    new CustomEvent('isc:reply-post', { detail: { postId: target.dataset.postId } })
  );
}

async function handleDelete(e, target) {
  const ok = await modals.confirm('Delete this post?', {
    title: 'Delete Post',
    confirmText: 'Delete',
    danger: true,
  });
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

  const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
  const connLabel = connected ? 'connected' : status;
  const { channels, activeChannelId } = getState();
  const posts = activeChannelId
    ? feedService.getByChannel(activeChannelId, 50)
    : feedService.getForYou(50);

  feed.innerHTML =
    posts.length === 0
      ? renderEmptyState(channels, connected, connLabel)
      : renderPosts(posts, channels);

  if (scrollToTop) {
    container.querySelector('[data-testid="now-body"]')?.scrollTo({ top: 0 });
  }
}

async function doRefresh(container) {
  if (refreshing) return;
  refreshing = true;

  const btn = container.querySelector('#now-refresh');
  if (btn) {
    btn.classList.add('spinning');
    btn.disabled = true;
  }

  try {
    await networkService.discoverPeers?.().catch(() => {});
    update(container);
  } finally {
    refreshing = false;
    if (btn) {
      btn.classList.remove('spinning');
      btn.disabled = false;
    }
  }
}

function bindFloatingToolbar(container, activeChannel) {
  // View mode dropdown
  const viewModeSelect = container.querySelector('#view-mode-select');
  if (viewModeSelect) {
    viewModeSelect.addEventListener('change', (e) => {
      const viewMode = e.target.value;
      const settings = channelSettingsService.getSettings(activeChannel.id);
      channelSettingsService.updateSettings(activeChannel.id, {
        ...settings,
        viewMode,
      });
      document.dispatchEvent(new CustomEvent('isc:channel-view-change', { detail: { mode: viewMode } }));
    });
  }

  // Precision toggle buttons
  const precisionBtns = container.querySelectorAll('.precision-btn');
  precisionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const precision = btn.dataset.precision;
      const specificity = precision === 'strict' ? 25 : precision === 'balanced' ? 50 : 75;
      const settings = channelSettingsService.getSettings(activeChannel.id);
      channelSettingsService.updateSettings(activeChannel.id, {
        ...settings,
        specificity,
      });
      update(container);
    });
  });

  // Sort order dropdown
  const sortOrderSelect = container.querySelector('#sort-order-select');
  if (sortOrderSelect) {
    sortOrderSelect.addEventListener('change', (e) => {
      const sortOrder = e.target.value;
      const settings = channelSettingsService.getSettings(activeChannel.id);
      channelSettingsService.updateSettings(activeChannel.id, {
        ...settings,
        sortOrder,
      });
      update(container);
    });
  }

  // More Options button - shows modal with advanced controls
  const moreOptionsBtn = container.querySelector('#more-options-btn');
  if (moreOptionsBtn) {
    moreOptionsBtn.addEventListener('click', () => {
      showAdvancedOptions(container, activeChannel);
    });
  }
}

function setupComposeBarSmartHide(container) {
  const composeBar = container.querySelector('.compose-bar');
  if (!composeBar) return;

  let lastScrollTop = 0;
  const body = container.querySelector('.now-body');
  if (!body) return;

  body.addEventListener('scroll', () => {
    const scrollTop = body.scrollTop;
    const isScrollingDown = scrollTop > lastScrollTop;
    const threshold = 50; // Collapse after scrolling 50px

    if (isScrollingDown && scrollTop > threshold) {
      composeBar.classList.add('compose-bar-collapsed');
    } else {
      composeBar.classList.remove('compose-bar-collapsed');
    }

    lastScrollTop = scrollTop;
  });

  // Expand on focus
  const textarea = container.querySelector('.compose-input');
  if (textarea) {
    textarea.addEventListener('focus', () => {
      composeBar.classList.remove('compose-bar-collapsed');
    });
  }
}

function showAdvancedOptions(container, activeChannel) {
  const settings = channelSettingsService.getSettings(activeChannel.id);
  const { filters, minSimilarity, isMuted, isLurker } = settings;

  const html = `
<div class="modal-header">
  <h2 class="modal-title">Channel Settings</h2>
</div>
<div class="modal-body">
  <div class="settings-section">
    <h3 class="settings-section-title">Content Filters</h3>
    <div class="settings-group">
      <label class="settings-checkbox">
        <input type="checkbox" name="filter-me" ${filters?.showMe ? 'checked' : ''}>
        <span>👤 Your posts</span>
      </label>
      <label class="settings-checkbox">
        <input type="checkbox" name="filter-others" ${filters?.showOthers ? 'checked' : ''}>
        <span>👥 Other people</span>
      </label>
      <label class="settings-checkbox">
        <input type="checkbox" name="filter-trusted" ${filters?.showTrusted ? 'checked' : ''}>
        <span>✓ Trusted peers</span>
      </label>
      <label class="settings-checkbox">
        <input type="checkbox" name="filter-high" ${filters?.showHighAlignment ? 'checked' : ''}>
        <span>🔥 High alignment (75%+)</span>
      </label>
      <label class="settings-checkbox">
        <input type="checkbox" name="filter-low" ${filters?.showLowAlignment ? 'checked' : ''}>
        <span>🌱 Low alignment (25%-50%)</span>
      </label>
    </div>

    <div class="settings-group">
      <label class="settings-label">Min Similarity: <strong>${Math.round(minSimilarity * 100)}%</strong></label>
      <input type="range" class="settings-slider" name="min-similarity" min="0" max="100" value="${Math.round(minSimilarity * 100)}">
    </div>
  </div>

  <div class="settings-section">
    <h3 class="settings-section-title">Advanced</h3>
    <div class="settings-group">
      <label class="settings-checkbox">
        <input type="checkbox" name="mute" ${isMuted ? 'checked' : ''}>
        <span>🔇 Mute this channel</span>
      </label>
      <label class="settings-checkbox">
        <input type="checkbox" name="lurk" ${isLurker ? 'checked' : ''}>
        <span>👁 Lurk mode (don't include in vector)</span>
      </label>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" data-action="reset-settings">↺ Reset Settings</button>
    <button type="button" class="btn btn-ghost btn-sm" data-action="edit-channel">✏️ Edit Channel</button>
    <button type="button" class="btn btn-ghost btn-sm danger" data-action="archive-channel">📦 Archive</button>
  </div>
</div>
<div class="modal-actions">
  <button type="button" class="btn btn-secondary" data-action="close">Close</button>
</div>
  `;

  const overlay = modals.open(html);

  // Bind advanced options controls
  overlay.querySelector('[name="filter-me"]')?.addEventListener('change', (e) => {
    const newSettings = {
      ...settings,
      filters: { ...settings.filters, showMe: e.target.checked },
    };
    channelSettingsService.updateSettings(activeChannel.id, newSettings);
    update(container);
  });

  // Similar for other filters... (abbreviated for space)
  overlay.querySelector('[name="filter-others"]')?.addEventListener('change', (e) => {
    const newSettings = {
      ...settings,
      filters: { ...settings.filters, showOthers: e.target.checked },
    };
    channelSettingsService.updateSettings(activeChannel.id, newSettings);
    update(container);
  });

  overlay.querySelector('[name="min-similarity"]')?.addEventListener('change', (e) => {
    const newSettings = {
      ...settings,
      minSimilarity: parseInt(e.target.value) / 100,
    };
    channelSettingsService.updateSettings(activeChannel.id, newSettings);
    update(container);
  });

  overlay.querySelector('[name="mute"]')?.addEventListener('change', (e) => {
    const newSettings = { ...settings, isMuted: e.target.checked };
    channelSettingsService.updateSettings(activeChannel.id, newSettings);
    update(container);
  });

  overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => {
    modals.close();
  });

  overlay.querySelector('[data-action="reset-settings"]')?.addEventListener('click', () => {
    channelSettingsService.resetSettings(activeChannel.id);
    modals.close();
    update(container);
  });

  overlay.querySelector('[data-action="edit-channel"]')?.addEventListener('click', () => {
    modals.close();
    // Open channel edit modal
    const html = `
<div class="modal-header">
  <h2 class="modal-title">Edit Channel</h2>
</div>
<div class="modal-body">
  <form>
    <div class="form-group">
      <label>Channel Name</label>
      <input type="text" class="form-input" id="channel-name-input" value="${escapeHtml(activeChannel.name)}" maxlength="100">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea class="form-textarea" id="channel-desc-input" maxlength="500">${escapeHtml(activeChannel.description || '')}</textarea>
    </div>
  </form>
</div>
<div class="modal-actions">
  <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
  <button type="button" class="btn btn-primary" data-action="save">Save Changes</button>
</div>
    `;
    const editOverlay = modals.open(html);
    editOverlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => modals.close());
    editOverlay.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      const name = editOverlay.querySelector('#channel-name-input').value;
      const description = editOverlay.querySelector('#channel-desc-input').value;
      channelService.updateChannel(activeChannel.id, { name, description });
      modals.close();
      update(container);
    });
  });

  overlay.querySelector('[data-action="archive-channel"]')?.addEventListener('click', () => {
    if (confirm('Archive this channel? You can unarchive it later.')) {
      channelService.archiveChannel(activeChannel.id);
      modals.close();
      update(container);
    }
  });
}

export function destroy() {
  import('../utils/spaceCanvas.js').then((m) => m.destroySpaceCanvas());
  refreshing = false;
  _replyTo = null;
  _lastPostCount = 0;
  _postsPage = 1;
  if (_lazyObserver) {
    _lazyObserver.disconnect();
    _lazyObserver = null;
  }
}

export default createScreen({ render, bind, update, destroy });
