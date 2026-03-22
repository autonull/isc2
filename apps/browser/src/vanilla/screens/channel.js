/**
 * Now Screen — Semantic "For You" feed
 *
 * Shows posts ranked by similarity to the user's active channel.
 * Supports List, Space, and Grid view modes.
 */

import { feedService, postService, channelService, discoveryService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions, subscribe } from '../../state.js';
import { channelSettingsService } from '../../services/channelSettings.js';
import { toasts } from '../../utils/toast.js';
import { formatTime } from '../../utils/time.js';
import { escapeHtml } from '../utils/dom.js';
import { projectToPCA } from '../../utils/pca.js';
import { getProximityTier, formatProximity } from '../../utils/proximity.js';
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
  const settings = activeChannel ? channelSettingsService.getSettings(activeChannel.id) : {};
  const viewMode = settings.viewMode || 'list';
  const specificity = settings.specificity ?? 50;
  const sortOrder = settings.sortOrder || 'recency';

  return `
    <div class="screen channel-screen" data-testid="channel-screen">
      ${channels.length ? renderComposeBar(channels, effectiveChannelId, activeChannel) : ''}
      ${renderHeader(activeChannel, connected, connLabel)}
      ${activeChannel ? renderFeedControls(activeChannel, viewMode, specificity, sortOrder) : ''}
      <div class="screen-body channel-body" data-testid="channel-body">
        <div class="channel-layout">
          <div id="now-feed" class="feed-view-${viewMode}" data-testid="feed-container" data-component="feed" data-feed="channel">
            ${posts.length === 0 ? renderEmptyState(channels, connected, connLabel) : renderPosts(posts, channels, viewMode)}
          </div>
          ${activeChannel ? renderNeighborPanel(activeChannel) : ''}
        </div>
      </div>
    </div>
  `;
}

function renderComposeBar(channels, activeChannelId, activeChannel) {
  if (!channels?.length) return '';

  // Phase 6.1: Compose placeholder names the channel
  const channelName = activeChannel?.name || channels?.[0]?.name || 'default';
  const placeholder = `What's on your mind? Your post reaches the #${channelName} neighborhood.`;

  return `
    <div class="compose-bar" data-testid="compose-bar">
      <form id="compose-form" class="compose-form-simple" data-testid="compose-form">
        <div class="compose-header">
          <span class="compose-label">Posting to:</span>
          ${
            channels.length > 1
              ? `<select id="compose-channel-sel" class="compose-channel-select" data-testid="compose-channel-sel">
                   ${channels
                     .map(
                       (ch) => `<option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>#${escapeHtml(ch.name)}</option>`
                     )
                     .join('')}
                 </select>`
              : `<span class="channel-name">#${escapeHtml(activeChannel?.name || 'default')}</span>`
          }
        </div>
        <textarea
          id="compose-input"
          class="compose-input-simple"
          placeholder="${escapeHtml(placeholder)}"
          maxlength="2000"
          data-testid="compose-input"
        ></textarea>
        <div class="compose-actions">
          <span class="char-count" data-testid="compose-count">0 / 2000</span>
          <button type="submit" class="btn btn-primary" data-testid="compose-submit" disabled>Post</button>
        </div>
      </form>
      <div class="compose-reply-context" hidden data-testid="compose-reply-context">
        Replying to: <strong class="reply-author"></strong>
        <button type="button" class="btn-clear-reply" title="Cancel">✕</button>
      </div>
    </div>
  `;
}

function renderFeedControls(activeChannel, viewMode, specificity, sortOrder) {
  if (!activeChannel) return '';

  // Precision/Relevance removed from channel view (Phase 4.2, 4.3):
  // - Relevance sort is removed: messages are in the neighborhood or they are not.
  // - Precision belongs in channel editing, not the message view.

  return `
    <div class="feed-controls" data-testid="feed-controls">
      <label class="view-label">View:</label>
      <select id="view-mode-select" class="view-select" data-testid="view-mode-select">
        <option value="list" ${viewMode === 'list' ? 'selected' : ''}>📋 List</option>
        <option value="grid" ${viewMode === 'grid' ? 'selected' : ''}>▦ Grid</option>
        <option value="space" ${viewMode === 'space' ? 'selected' : ''}>🌌 Space</option>
      </select>

      <label class="sort-label" style="margin-left: 20px;">Sort:</label>
      <select id="sort-order-select" class="sort-select" data-testid="sort-order-select">
        <option value="recency" ${sortOrder === 'recency' ? 'selected' : ''}>Recent</option>
        <option value="activity" ${sortOrder === 'activity' ? 'selected' : ''}>Activity</option>
      </select>

      <button type="button" id="more-options-btn" class="btn btn-small" style="margin-left: 20px;" title="Advanced options" data-testid="more-options-btn">⚙️</button>
    </div>
  `;
}

function renderHeader(activeChannel, connected, connLabel) {
  const relationPills = activeChannel?.relations?.length
    ? `<div class="relation-pills-container">
         ${activeChannel.relations.map((rel, idx) => `
           <div class="relation-pill" data-relation-idx="${idx}" data-testid="relation-pill-${idx}" title="Edit relations">
             ${getRelationEmoji(rel.tag)} ${escapeHtml(rel.object.slice(0, 20))}${rel.object.length > 20 ? '…' : ''}
           </div>
         `).join('')}
       </div>`
    : '';

  // Phase 5.1: Breadth badge
  const breadthLabel = activeChannel?.breadth ?
    (activeChannel.breadth.charAt(0).toUpperCase() + activeChannel.breadth.slice(1)) : 'Balanced';
  const breadthBadge = activeChannel ?
    `<button class="breadth-badge" id="breadth-badge-btn" data-testid="breadth-badge" title="Click to edit channel breadth">
       ${breadthLabel}
     </button>` : '';

  return `
    <div class="screen-header channel-header" data-testid="channel-header">
      <div class="header-channel-identity">
        ${activeChannel
          ? `<div class="channel-title-row">
               <h1 class="channel-screen-title" data-testid="channel-title">#${escapeHtml(activeChannel.name)}</h1>
               ${breadthBadge}
             </div>
             <p class="channel-screen-desc" data-testid="channel-description">${escapeHtml(activeChannel.description || '')}</p>
             ${relationPills}`
          : '<h1 class="channel-screen-title">Channel</h1>'
        }
      </div>
      <div class="header-status">
        <button class="btn btn-icon" id="now-refresh" title="Refresh feed" data-testid="refresh-feed">↻</button>
        <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">
          ${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}
        </span>
      </div>
    </div>
  `;
}

function getRelationEmoji(tag) {
  const emojis = {
    'in_location': '📍',
    'during_time': '📅',
    'with_mood': '😊',
    'under_domain': '🎯',
    'causes_effect': '⚡',
    'part_of': '🧩',
    'similar_to': '🔄',
    'opposed_to': '↔️',
    'requires': '🔗',
    'boosted_by': '⬆️',
  };
  return emojis[tag] || '🏷️';
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
        actions: [{ label: 'Create Your First Channel', href: '#', 'data-action': 'new-channel', variant: 'primary' }],
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
      ? "Post something to your channel — peers in your semantic neighborhood will see it."
      : 'Connect to the network to start exchanging messages with semantic neighbors.',
    actions: [],
  });
}

function renderNeighborPanel(activeChannel) {
  const matches = discoveryService.getMatches();
  // Filter to peers plausibly in this channel's neighborhood (using all matches as approximation
  // until per-channel filtering is available from the network layer)
  const neighbors = matches.slice(0, 10);

  return `
    <aside class="neighbor-panel" data-testid="neighbor-panel" aria-label="Channel neighbors">
      <div class="neighbor-panel-header">
        <span class="neighbor-panel-title">Neighbors</span>
        <span class="neighbor-panel-count" data-testid="neighbor-count">${neighbors.length}</span>
      </div>
      <div class="neighbor-list" data-testid="neighbor-list">
        ${neighbors.length === 0
          ? '<div class="neighbor-empty">No peers in neighborhood yet</div>'
          : neighbors.map(m => renderNeighborItem(m)).join('')
        }
      </div>
    </aside>
  `;
}

function renderNeighborItem(match) {
  const name = escapeHtml(match.identity?.name || match.peer?.name || 'Anonymous');
  const desc = escapeHtml((match.identity?.bio || match.peer?.description || '').slice(0, 60));
  const similarity = match.similarity != null ? match.similarity : null;
  const peerId = escapeHtml(match.peerId || match.peer?.id || '');
  const initial = (name[0] || 'A').toUpperCase();

  // Phase 4: Apply tier styling
  const tier = similarity != null ? getProximityTier(similarity) : null;
  const tierClass = tier ? tier.cssClass : '';
  const tierLabel = similarity != null ? formatProximity(similarity) : '';

  return `
    <div class="neighbor-item ${tierClass}" data-testid="neighbor-${peerId}" data-peer-id="${peerId}">
      <div class="neighbor-avatar">${initial}</div>
      <div class="neighbor-info">
        <span class="neighbor-name">${name}</span>
        ${desc ? `<span class="neighbor-desc">${desc}</span>` : ''}
        ${tierLabel ? `<span class="neighbor-tier">${tierLabel}</span>` : ''}
      </div>
      <button class="neighbor-dm-btn btn btn-xs btn-ghost"
              data-action="start-chat" data-peer-id="${peerId}"
              data-testid="neighbor-dm-${peerId}"
              title="Message ${name}">✉</button>
    </div>
  `;
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
        <span class="post-author" style="cursor:pointer" title="Click to message ${author}">${author}</span>
        ${chanName ? `<span class="post-channel" title="Sender's channel: #${chanName}">#${chanName}</span>` : ''}
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
  const { channels: allChannels, activeChannelId } = getState();
  const activeChannel = allChannels?.find(c => c.id === activeChannelId);
  const userMarker = activeChannel ? renderUserMarker(activeChannel) : '';

  return `
    <div class="feed-space">
      ${userMarker}
      ${posts.map((p, i) => renderSpacePost(p, channels, i)).join('')}
    </div>
  `;
}

function renderUserMarker(activeChannel) {
  // Render user's position marker (simplified - uses center position)
  // Full implementation would project channel.embedding to PCA space
  const spread = activeChannel.breadth === 'broad' ? 0.25 : (activeChannel.breadth === 'narrow' ? 0.08 : 0.15);
  const radiusPct = Math.round(spread * 100);

  return `
    <div class="user-marker" data-testid="user-marker" style="left: 50%; top: 50%; transform: translate(-50%, -50%);">
      <div class="user-position-dot"></div>
      <div class="user-spread-circle" style="width: ${radiusPct * 2}%; height: ${radiusPct * 2}%;"></div>
      <div class="user-marker-label">#${escapeHtml(activeChannel.name)}</div>
    </div>
  `;
}

function renderPostCard(post, channels, showActions = true) {
  const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const content = escapeHtml(post.content || '');
  const replies = post.replies?.length ?? 0;

  return `
    <div class="post-card" data-testid="post-card" data-component="post" data-post-id="${escapeHtml(post.id)}"
         data-author-id="${escapeHtml(post.authorId || post.identity?.peerId || '')}"
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

  // Phase 1: Compute and display similarity scores for posts
  if (activeChannel && activeChannelId) {
    feedService.computeChannelPostScores(activeChannelId).then((scores) => {
      Object.entries(scores).forEach(([postId, { similarityScore, matchedChannelName }]) => {
        const postCard = container.querySelector(`[data-post-id="${postId}"]`);
        if (postCard && similarityScore != null) {
          const similarity = Math.round(similarityScore * 100);
          const badge = document.createElement('div');
          badge.className = 'post-sim-badge';
          badge.textContent = `${(similarityScore).toFixed(2)} · #${matchedChannelName}`;
          badge.setAttribute('title', 'Contexts overlap');

          const postContent = postCard.querySelector('.post-content');
          if (postContent) {
            postContent.parentNode.insertBefore(badge, postContent.nextSibling);
          }
        }
      });
    }).catch((err) => {
      console.warn('Failed to compute similarity scores:', err.message);
    });
  }

  // Phase 3: Apply PCA-based positioning in space view
  const settings = activeChannel ? channelSettingsService.getSettings(activeChannel.id) : {};
  if (settings.viewMode === 'space' && activeChannel?.embedding) {
    requestAnimationFrame(() => {
      const spacePost = container.querySelectorAll('.space-post');
      if (spacePost.length > 0) {
        // Collect embeddings from posts (stub - would need post.embedding in DOM)
        // For now, use pseudo-random positioning from renderSpacePost
        // Full implementation requires post embeddings passed to render layer
      }
    });
  }

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

  // Bind view mode selector
  const viewModeSelect = container.querySelector('#view-mode-select');
  if (viewModeSelect) {
    viewModeSelect.addEventListener('change', (e) => {
      const viewMode = e.target.value;
      if (activeChannel) {
        const settings = channelSettingsService.getSettings(activeChannel.id);
        channelSettingsService.updateSettings(activeChannel.id, {
          ...settings,
          viewMode,
        });
      }
      document.dispatchEvent(new CustomEvent('isc:channel-view-change', { detail: { mode: viewMode } }));
    });
  }

  // Bind precision selector
  const precisionSelect = container.querySelector('#precision-select');
  if (precisionSelect) {
    precisionSelect.addEventListener('change', (e) => {
      const specificity = parseInt(e.target.value, 10);
      if (activeChannel) {
        const settings = channelSettingsService.getSettings(activeChannel.id);
        channelSettingsService.updateSettings(activeChannel.id, {
          ...settings,
          specificity,
        });
        update(container);
      }
    });
  }

  // Bind sort order selector
  const sortSelect = container.querySelector('#sort-order-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const sortOrder = e.target.value;
      if (activeChannel) {
        const settings = channelSettingsService.getSettings(activeChannel.id);
        channelSettingsService.updateSettings(activeChannel.id, {
          ...settings,
          sortOrder,
        });
        update(container);
      }
    });
  }

  // Bind more options button
  const moreOptionsBtn = container.querySelector('#more-options-btn');
  if (moreOptionsBtn) {
    moreOptionsBtn.addEventListener('click', () => {
      if (activeChannel) {
        showAdvancedOptions(container, activeChannel);
      }
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

  container.querySelector('#now-refresh')?.addEventListener('click', () => doRefresh(container));
  container.querySelector('[data-action="new-channel"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('isc:new-channel'));
  });

  // Phase 5.1: Breadth badge click to edit
  const breadthBtn = container.querySelector('#breadth-badge-btn');
  if (breadthBtn && activeChannel) {
    breadthBtn.addEventListener('click', (e) => {
      e.preventDefault();
      import('../components/channelEdit.js').then(({ openChannelEdit }) => {
        openChannelEdit(activeChannel);
      });
    });
  }

  // Neighbor panel: DM button (Phase 3.8)
  container.addEventListener('click', (e) => {
    const dmBtn = e.target.closest('[data-action="start-chat"]');
    if (dmBtn) {
      const peerId = dmBtn.dataset.peerId;
      if (peerId) {
        document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId }, bubbles: true }));
        window.location.hash = '#/chats';
      }
    }

    // Post author click → popover with DM action (Phase 3.9)
    const postAuthor = e.target.closest('.post-author');
    if (postAuthor) {
      const postCard = postAuthor.closest('.post-card');
      const authorId = postCard?.dataset?.authorId;
      const authorName = postAuthor.textContent;
      if (authorId && authorId !== networkService.getIdentity()?.peerId) {
        showAuthorPopover(postCard, authorId, authorName);
      }
    }

    // Relation pill click → open channel edit (Phase 2.4)
    const relationPill = e.target.closest('.relation-pill');
    if (relationPill && activeChannel) {
      import('../components/channelEdit.js').then(({ openChannelEdit }) => {
        openChannelEdit(activeChannel);
      });
    }
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

function showAuthorPopover(postCard, peerId, authorName) {
  // Remove any existing popover
  document.querySelectorAll('.author-popover').forEach(p => p.remove());

  const popover = document.createElement('div');
  popover.className = 'author-popover';
  popover.setAttribute('data-testid', 'author-popover');
  popover.innerHTML = `
    <div class="author-popover-name">${escapeHtml(authorName)}</div>
    <button class="btn btn-sm btn-primary author-popover-dm" data-peer-id="${escapeHtml(peerId)}">
      Message →
    </button>
    <button class="btn btn-sm btn-ghost author-popover-close">Close</button>
  `;

  postCard.style.position = 'relative';
  postCard.appendChild(popover);

  popover.querySelector('.author-popover-dm')?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId }, bubbles: true }));
    window.location.hash = '#/chats';
    popover.remove();
  });
  popover.querySelector('.author-popover-close')?.addEventListener('click', () => popover.remove());

  // Auto-dismiss on outside click
  setTimeout(() => {
    document.addEventListener('click', function dismissPopover(e) {
      if (!popover.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', dismissPopover);
      }
    });
  }, 0);
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
  const activeChannel = channels?.find(c => c.id === activeChannelId);

  // Show loading indicator immediately, then fetch from DHT (Phase 4.4)
  if (activeChannel && networkService.fetchMessagesForChannel) {
    feed.innerHTML = '<div class="feed-loading" data-testid="feed-loading">Loading messages…</div>';
    networkService.fetchMessagesForChannel(activeChannel).then(posts => {
      if (!container.isConnected) return; // Guard: container may have been unmounted
      feed.innerHTML = posts.length === 0
        ? renderEmptyState(channels, connected, connLabel)
        : renderPosts(posts, channels);
      if (scrollToTop) {
        container.querySelector('[data-testid="channel-body"]')?.scrollTo({ top: 0 });
      }
    }).catch(() => {
      // Fallback to local posts on DHT error
      const localPosts = activeChannelId ? feedService.getByChannel(activeChannelId, 50) : [];
      feed.innerHTML = localPosts.length === 0
        ? renderEmptyState(channels, connected, connLabel)
        : renderPosts(localPosts, channels);
    });
    return;
  }

  const posts = activeChannelId
    ? feedService.getByChannel(activeChannelId, 50)
    : feedService.getForYou(50);

  feed.innerHTML =
    posts.length === 0
      ? renderEmptyState(channels, connected, connLabel)
      : renderPosts(posts, channels);

  if (scrollToTop) {
    container.querySelector('[data-testid="channel-body"]')?.scrollTo({ top: 0 });
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
  const body = container.querySelector('.channel-body');
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
