/* eslint-disable */
/**
 * PostList Component
 *
 * Renders a list/grid/space of posts with threading support.
 */

import { el } from '../utils/dom.js';
import { escapeHtml } from '../utils/dom.js';
import { Avatar } from './Avatar.js';

/**
 * @typedef {Object} PostData
 * @property {string} id
 * @property {string} content
 * @property {string} [author]
 * @property {Object} [identity]
 * @property {string} [identity.name]
 * @property {string} [identity.peerId]
 * @property {string} [authorId]
 * @property {string} [channelId]
 * @property {number} [timestamp]
 * @property {number} [likes]
 * @property {string} [replyTo]
 * @property {PostData[]} [replies]
 */

/**
 * @typedef {Object} PostListOptions
 * @property {PostData[]} posts - Posts to display
 * @property {Object[]} channels - Available channels
 * @property {string} [viewMode='list'] - 'list' | 'grid' | 'space'
 * @property {number} [pageSize=20] - Posts per page
 * @property {Function} [onLoadMore] - Load more handler
 * @property {Function} [onLike] - Like handler: (postId) => void
 * @property {Function} [onReply] - Reply handler: (postId) => void
 * @property {Function} [onDelete] - Delete handler: (postId) => void
 * @property {Function} [onPostClick] - Post click handler: (post) => void
 * @property {Object} [identity] - Current user identity for ownership check
 */

/**
 * Format timestamp to relative time
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Render a single post card
 * @param {PostData} post
 * @param {Object[]} channels
 * @param {Object} identity
 * @param {boolean} showActions
 * @returns {string}
 */
function renderPostCard(post, channels, identity, showActions = true) {
  const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
  const content = escapeHtml(post.content || '');
  const time = post.timestamp ? formatTime(post.timestamp) : '';
  const channel = channels?.find((c) => c.id === post.channelId);
  const chanName = channel
    ? escapeHtml(channel.name)
    : post.channelId
      ? escapeHtml(post.channelId.slice(0, 12))
      : '';

  const { peerId, pubkey } = identity ?? {};
  const isOwn = post.identity?.peerId === peerId || post.identity?.pubkey === pubkey;
  const liked = post.liked ?? false;
  const likes = post.likes?.length ?? 0;
  const replies = post.replies?.length ?? 0;

  const authorId = escapeHtml(post.authorId || post.identity?.peerId || '');

  return `
    <article class="post-card"
      data-testid="post-card"
      data-component="post"
      data-post-id="${escapeHtml(post.id)}"
      data-author-id="${authorId}"
      tabindex="0"
      role="article"
      aria-label="${author}: ${escapeHtml(content.slice(0, 80))}"
      data-lazy="true">
      ${renderPostBody(post, channels, identity, showActions)}
      ${
        showActions
          ? `
        <div class="post-actions">
          <button class="post-action-btn"
            data-action="reply"
            data-reply-btn
            data-post-id="${escapeHtml(post.id)}"
            data-testid="reply-btn-${escapeHtml(post.id)}">
            <span aria-hidden="true">↩</span>
            <span class="post-action-label">Reply</span>
            <span>${replies}</span>
          </button>
        </div>
      `
          : ''
      }
    </article>
  `;
}

/**
 * Render post body (header + content + actions)
 * @param {PostData} post
 * @param {Object[]} channels
 * @param {Object} identity
 * @param {boolean} showActions
 * @returns {string}
 */
function renderPostBody(post, channels, identity, showActions = true) {
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

  const { peerId, pubkey } = identity ?? {};
  const isOwn = post.identity?.peerId === peerId || post.identity?.pubkey === pubkey;
  const liked = post.liked ?? false;
  const likes = post.likes?.length ?? 0;

  return `
    <div class="post-header">
      <div class="post-avatar">${initials}</div>
      <div class="post-meta">
        <span class="post-author" style="cursor:pointer" title="Click to message ${author}">${author}</span>
        ${chanName ? `<span class="post-channel" title="Sender's channel: #${chanName}">#${chanName}</span>` : ''}
      </div>
      <div class="post-meta-actions"><span class="post-time">${time}</span></div>
    </div>
    <div class="post-content" data-testid="post-content">${content}</div>
    ${showActions ? renderPostActions(post.id, isOwn, liked, likes) : ''}
  `;
}

/**
 * Render post action buttons
 * @param {string} postId
 * @param {boolean} isOwn
 * @param {boolean} liked
 * @param {number} likes
 * @returns {string}
 */
function renderPostActions(postId, isOwn, liked, likes) {
  return `
    <div class="post-actions">
      <button class="post-action-btn${liked ? ' liked' : ''}"
        data-action="like"
        data-like-btn
        data-post-id="${escapeHtml(postId)}"
        data-liked="${liked}"
        data-testid="like-btn-${escapeHtml(postId)}">
        <span aria-hidden="true">${liked ? '♥' : '♡'}</span>
        <span class="post-action-label">Like</span>
        <span class="like-count">${likes}</span>
      </button>
      ${
        isOwn
          ? `
        <button class="post-action-btn"
          data-action="delete"
          data-delete-btn
          data-post-id="${escapeHtml(postId)}"
          data-testid="delete-btn-${escapeHtml(postId)}">
          <span class="post-action-label">Delete</span>
        </button>
      `
          : ''
      }
    </div>
  `;
}

/**
 * Render reply post
 * @param {PostData} post
 * @param {PostData} parentPost
 * @param {Object[]} channels
 * @returns {string}
 */
function renderReplyPost(post, parentPost, channels) {
  const parentSnippet =
    escapeHtml((parentPost.content || '').slice(0, 60)) +
    (parentPost.content?.length > 60 ? '…' : '');

  return `
    <div class="post-card post-card-reply"
      data-post-id="${escapeHtml(post.id)}"
      data-testid="post-card-reply">
      <div class="post-reply-context">
        <span class="reply-indicator" aria-hidden="true">↩</span>
        <span class="reply-parent-snippet">${parentSnippet}</span>
      </div>
      ${renderPostBody(post, channels, null, false)}
    </div>
  `;
}

/**
 * Render list of posts with threading
 * @param {PostData[]} posts
 * @param {Object[]} channels
 * @returns {string}
 */
function renderListPosts(posts, channels) {
  const topLevel = posts.filter((p) => !p.replyTo);

  return `<div class="feed-list">${topLevel
    .map((post) => {
      const replies = posts.filter((r) => r.replyTo === post.id);
      return `
      ${renderPostCard(post, channels, null)}
      ${
        replies.length
          ? `<div class="post-thread" data-parent-id="${escapeHtml(post.id)}">
            ${replies
              .slice(0, 3)
              .map((r) => renderReplyPost(r, post, channels))
              .join('')}
            ${
              replies.length > 3
                ? `<button class="thread-expand-btn"
                  data-thread="${escapeHtml(post.id)}"
                  data-testid="expand-thread-${escapeHtml(post.id)}">
                  Show all ${replies.length} replies
                </button>`
                : ''
            }
          </div>`
          : ''
      }
    `;
    })
    .join('')}</div>`;
}

/**
 * Render posts in grid view
 * @param {PostData[]} posts
 * @param {Object[]} channels
 * @returns {string}
 */
function renderGridPosts(posts, channels) {
  return `<div class="feed-grid">${posts.map((p) => renderPostCard(p, channels, null)).join('')}</div>`;
}

/**
 * Render space view placeholder
 * @returns {string}
 */
function renderSpaceView() {
  return `
    <div class="space-canvas-placeholder" data-testid="space-canvas-placeholder">
      <canvas id="space-canvas" class="space-canvas" data-testid="space-canvas"></canvas>
    </div>
  `;
}

/**
 * PostList class for managing post rendering and interactions
 */
class PostList {
  #container;
  #options;
  #currentPage = 1;
  #boundHandlers = [];

  constructor(container, options = {}) {
    this.#container = container;
    this.#options = {
      pageSize: 20,
      viewMode: 'list',
      ...options,
    };
    this.#render();
  }

  #render() {
    const { posts, viewMode, pageSize } = this.#options;
    const visible = posts.slice(0, pageSize * this.#currentPage);
    const hasMore = posts.length > visible.length;

    const countHtml = `
      <div class="post-count text-muted mb-2" data-testid="post-count">
        ${posts.length} post${posts.length !== 1 ? 's' : ''}
      </div>
    `;

    let content;
    switch (viewMode) {
      case 'grid':
        content = renderGridPosts(visible, this.#options.channels);
        break;
      case 'space':
        content = renderSpaceView();
        break;
      default:
        content = renderListPosts(visible, this.#options.channels);
    }

    const loadMoreHtml = hasMore
      ? `<div class="load-more-row">
          <button class="btn btn-ghost btn-sm" id="load-more-btn" data-testid="load-more-posts">
            Load earlier posts (${posts.length - visible.length} more)
          </button>
        </div>`
      : '';

    this.#container.innerHTML = countHtml + content + loadMoreHtml;
  }

  #bind() {
    const loadMoreBtn = this.#container.querySelector('#load-more-btn');
    if (loadMoreBtn) {
      const handler = () => {
        this.#currentPage++;
        this.#render();
        this.#bind();
      };
      loadMoreBtn.addEventListener('click', handler);
      this.#boundHandlers.push(() => loadMoreBtn.removeEventListener('click', handler));
    }

    // Bind action buttons
    const likeButtons = this.#container.querySelectorAll('[data-action="like"]');
    likeButtons.forEach((btn) => {
      const handler = (e) => {
        const postId = btn.dataset.postId;
        this.#options.onLike?.(postId);
      };
      btn.addEventListener('click', handler);
      this.#boundHandlers.push(() => btn.removeEventListener('click', handler));
    });

    const deleteButtons = this.#container.querySelectorAll('[data-action="delete"]');
    deleteButtons.forEach((btn) => {
      const handler = (e) => {
        const postId = btn.dataset.postId;
        this.#options.onDelete?.(postId);
      };
      btn.addEventListener('click', handler);
      this.#boundHandlers.push(() => btn.removeEventListener('click', handler));
    });

    const replyButtons = this.#container.querySelectorAll('[data-action="reply"]');
    replyButtons.forEach((btn) => {
      const handler = (e) => {
        const postId = btn.dataset.postId;
        this.#options.onReply?.(postId);
      };
      btn.addEventListener('click', handler);
      this.#boundHandlers.push(() => btn.removeEventListener('click', handler));
    });
  }

  /**
   * Update posts and re-render
   * @param {PostData[]} posts
   */
  setPosts(posts) {
    this.#options.posts = posts;
    this.#currentPage = 1;
    this.#render();
    this.#bind();
  }

  /**
   * Update options and re-render
   * @param {Partial<PostListOptions>} options
   */
  setOptions(options) {
    this.#options = { ...this.#options, ...options };
    this.#currentPage = 1;
    this.#render();
    this.#bind();
  }

  /**
   * Refresh the current view
   */
  refresh() {
    this.#render();
    this.#bind();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.#boundHandlers.forEach((fn) => fn?.());
    this.#boundHandlers = [];
    this.#container.innerHTML = '';
  }
}

// Export both the class and helper functions
export {
  PostList,
  renderPostCard,
  renderPostBody,
  renderPostActions,
  renderReplyPost,
  renderListPosts,
  renderGridPosts,
  renderSpaceView,
};
export default PostList;
