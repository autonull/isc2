/* eslint-disable */
/**
 * Channel Screen - Semantic "For You" feed with List/Space/Grid views.
 */

import { feedService, postService, channelService } from '../../services/index.js';
import { networkService } from '../../services/network.ts';
import { getState, actions, subscribe } from '../../state.js';
import { channelSettingsService } from '../../services/index.js';
import { toast as toasts } from '../../utils/toast.ts';
import { formatTime } from '../../utils/time.ts';
import { escapeHtml } from '../utils/dom.js';
import { renderEmpty, bindDelegate, autoGrow, setupCtrlEnterSubmit } from '../utils/screen.js';
import { NeighborsComponent } from '../components/neighbors.js';
import { modals } from '../components/modal.js';
import { MixerPanelComponent } from '../components/mixerPanel.js';

const PAGE_SIZE = 20;

class ChannelScreen {
  #container;
  #refreshing = false;
  #replyTo = null;
  #lastPostCount = 0;
  #postsPage = 1;
  #lazyObserver = null;
  #neighborsComponent = null;
  #mixerPanel = null;
  #boundHandlers = [];
  #lastChannelId = null;

  render() {
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

    return `
      <div class="screen channel-screen" data-testid="channel-screen">
        ${channels.length ? this.#renderComposeBar(channels, effectiveChannelId, activeChannel) : ''}
        ${this.#renderHeader(activeChannel, connected, connLabel)}
        ${activeChannel ? this.#renderFeedControls() : ''}
        <div class="screen-body channel-body" data-testid="channel-body">
          <div class="channel-layout">
            <div id="now-feed" class="feed-view-${viewMode}" data-testid="feed-container" data-component="feed" data-feed="channel">
              ${posts.length === 0 ? this.#renderEmptyState(channels, connected, connLabel) : this.#renderPosts(posts, channels, viewMode)}
            </div>
            ${activeChannel ? '<div class="neighbor-panel-container" data-component="neighbors"></div>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  #renderComposeBar(channels, activeChannelId, activeChannel) {
    if (!channels?.length) return '';
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
                   ${channels.map((ch) => `<option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>#${escapeHtml(ch.name)}</option>`).join('')}
                 </select>`
                : `<span class="channel-name">#${escapeHtml(activeChannel?.name || 'default')}</span>`
            }
          </div>
          <textarea id="compose-input" class="compose-input-simple" placeholder="${escapeHtml(placeholder)}" maxlength="2000" data-testid="compose-input"></textarea>
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

  #renderFeedControls() {
    // Mixer panel container - initialized in bind() with MixerPanelComponent
    return '<div class="mixer-panel-container" data-component="mixer-panel"></div>';
  }

  #renderHeader(activeChannel, connected, connLabel) {
    const relationPills = activeChannel?.relations?.length
      ? `<div class="relation-pills-container">${activeChannel.relations.map((rel, idx) => `<div class="relation-pill" data-relation-idx="${idx}" data-testid="relation-pill-${idx}" title="Edit relations">${this.#getRelationEmoji(rel.tag)} ${escapeHtml(rel.object.slice(0, 20))}${rel.object.length > 20 ? '…' : ''}</div>`).join('')}</div>`
      : '';

    const breadthLabel = activeChannel?.breadth
      ? activeChannel.breadth.charAt(0).toUpperCase() + activeChannel.breadth.slice(1)
      : 'Balanced';
    const breadthBadge = activeChannel
      ? `<button class="breadth-badge" id="breadth-badge-btn" data-testid="breadth-badge" title="Click to edit channel breadth">${breadthLabel}</button>`
      : '';

    return `
      <div class="screen-header channel-header" data-testid="channel-header">
        <div class="header-channel-identity">
          ${
            activeChannel
              ? `<div class="channel-title-row">
                <h1 class="channel-screen-title" data-testid="channel-title">#${escapeHtml(activeChannel.name)}</h1>
                ${breadthBadge}
                <button class="btn btn-icon btn-danger-ghost channel-delete-btn" data-testid="channel-delete-btn" title="Delete channel" aria-label="Delete channel ${escapeHtml(activeChannel.name)}">✕</button>
              </div>
              <p class="channel-screen-desc" data-testid="channel-description">${escapeHtml(activeChannel.description || '')}</p>
              ${relationPills}`
              : '<h1 class="channel-screen-title">Channel</h1>'
          }
        </div>
        <div class="header-status">
          <button class="btn btn-icon" id="now-refresh" title="Refresh feed" data-testid="refresh-feed">↻</button>
          <span class="status-badge ${connected ? 'online' : 'offline'}" data-testid="network-status-badge">${connected ? '● Online' : `○ ${escapeHtml(connLabel)}`}</span>
        </div>
      </div>
    `;
  }

  #getRelationEmoji(tag) {
    const emojis = {
      in_location: '📍',
      during_time: '📅',
      with_mood: '😊',
      under_domain: '🎯',
      causes_effect: '⚡',
      part_of: '🧩',
      similar_to: '🔄',
      opposed_to: '↔️',
      requires: '🔗',
      boosted_by: '⬆️',
    };
    return emojis[tag] || '🏷️';
  }

  #renderEmptyState(channels, connected, connLabel) {
    if (!channels?.length) {
      return `
        ${renderEmpty({
          icon: '💭',
          title: 'What are you thinking about?',
          description:
            "Create a channel — describe what's on your mind. ISC will find people on the same wavelength.",
          actions: [
            {
              label: 'Create Your First Channel',
              href: '#',
              'data-action': 'new-channel',
              variant: 'primary',
            },
          ],
        })}
        ${!connected ? `<div class="info-banner warning mt-4">○ Network is ${escapeHtml(connLabel)} — you can still create channels offline</div>` : ''}
      `;
    }
    return renderEmpty({
      icon: '📭',
      title: 'No posts yet',
      description: connected
        ? 'Post something to your channel — peers in your semantic neighborhood will see it.'
        : 'Connect to the network to start exchanging messages with semantic neighbors.',
      actions: [],
    });
  }

  #renderPosts(posts, channels, viewMode = 'list') {
    const countHtml = `<div class="post-count text-muted mb-2" data-testid="post-count">${posts.length} post${posts.length !== 1 ? 's' : ''}</div>`;
    const visible = posts.slice(0, this.#postsPage * PAGE_SIZE);
    const hasMore = posts.length > visible.length;

    let content;
    switch (viewMode) {
      case 'grid':
        content = `<div class="feed-grid">${visible.map((p) => this.#renderPostCard(p, channels)).join('')}</div>`;
        break;
      case 'space':
        content = `<div class="space-canvas-placeholder" data-testid="space-canvas-placeholder"><canvas id="space-canvas" class="space-canvas" data-testid="space-canvas"></canvas></div>`;
        break;
      default:
        content = this.#renderListPosts(visible, channels);
    }

    return `${countHtml}${content}${hasMore ? `<div class="load-more-row"><button class="btn btn-ghost btn-sm" id="load-more-btn" data-testid="load-more-posts">Load earlier posts (${posts.length - visible.length} more)</button></div>` : ''}`;
  }

  #renderListPosts(posts, channels) {
    const topLevel = posts.filter((p) => !p.replyTo);
    return `<div class="feed-list">${topLevel
      .map((post) => {
        const replies = posts.filter((r) => r.replyTo === post.id);
        return `${this.#renderPostCard(post, channels)}${
          replies.length
            ? `<div class="post-thread" data-parent-id="${escapeHtml(post.id)}">${replies
                .slice(0, 3)
                .map((r) => this.#renderReplyPost(r, post, channels))
                .join(
                  ''
                )}${replies.length > 3 ? `<button class="thread-expand-btn" data-thread="${escapeHtml(post.id)}" data-testid="expand-thread-${escapeHtml(post.id)}">Show all ${replies.length} replies</button>` : ''}</div>`
            : ''
        }`;
      })
      .join('')}</div>`;
  }

  #renderReplyPost(post, parentPost, channels) {
    const parentSnippet =
      escapeHtml((parentPost.content || '').slice(0, 60)) +
      (parentPost.content?.length > 60 ? '…' : '');
    return `<div class="post-card post-card-reply" data-post-id="${escapeHtml(post.id)}" data-testid="post-card-reply"><div class="post-reply-context"><span class="reply-indicator" aria-hidden="true">↩</span><span class="reply-parent-snippet">${parentSnippet}</span></div>${this.#renderPostBody(post, channels, false)}</div>`;
  }

  #renderPostBody(post, channels, showActions = true) {
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
    const { peerId, pubkey } = networkService.getIdentity() ?? {};
    const isOwn = post.identity?.peerId === peerId || post.identity?.pubkey === pubkey;
    const liked = postService.getLikedPosts().has(post.id);

    return `
      <div class="post-header">
        <div class="post-avatar">${initials}</div>
        <div class="post-meta"><span class="post-author" style="cursor:pointer" title="Click to message ${author}">${author}</span>${chanName ? `<span class="post-channel" title="Sender's channel: #${chanName}">#${chanName}</span>` : ''}</div>
        <div class="post-meta-actions"><span class="post-time">${time}</span></div>
      </div>
      <div class="post-content" data-testid="post-content">${content}</div>
      ${showActions ? this.#renderPostActions(post.id, isOwn, liked, post.likes?.length ?? 0) : ''}
    `;
  }

  #renderPostActions(postId, isOwn, liked, likes) {
    return `
      <div class="post-actions">
        <button class="post-action-btn${liked ? ' liked' : ''}" data-action="like" data-like-btn data-post-id="${escapeHtml(postId)}" data-liked="${liked}" data-testid="like-btn-${escapeHtml(postId)}"><span aria-hidden="true">${liked ? '♥' : '♡'}</span><span class="post-action-label">Like</span><span class="like-count">${likes}</span></button>
        ${isOwn ? `<button class="post-action-btn" data-action="delete" data-delete-btn data-post-id="${escapeHtml(postId)}" data-testid="delete-btn-${escapeHtml(postId)}"><span class="post-action-label">Delete</span></button>` : ''}
      </div>
    `;
  }

  #renderPostCard(post, channels, showActions = true) {
    const author = escapeHtml(post.author || post.identity?.name || 'Anonymous');
    const content = escapeHtml(post.content || '');
    const replies = post.replies?.length ?? 0;

    return `
      <div class="post-card" data-testid="post-card" data-component="post" data-post-id="${escapeHtml(post.id)}" data-author-id="${escapeHtml(post.authorId || post.identity?.peerId || '')}" tabindex="0" role="article" aria-label="${escapeHtml(author)}: ${escapeHtml(content.slice(0, 80))}" data-lazy="true">
        ${this.#renderPostBody(post, channels, showActions)}
        ${showActions ? `<div class="post-actions"><button class="post-action-btn" data-action="reply" data-reply-btn data-post-id="${escapeHtml(post.id)}" data-testid="reply-btn-${escapeHtml(post.id)}"><span aria-hidden="true">↩</span><span class="post-action-label">Reply</span><span>${replies}</span></button></div>` : ''}
      </div>
    `;
  }

  bind(container) {
    this.#container = container;
    const { channels, activeChannelId } = getState();
    const activeChannel = channels?.find((c) => c.id === activeChannelId);
    this.#lastChannelId = activeChannelId;

    this.#initSimilarityScores(container, activeChannel, activeChannelId);
    this.#initLazyLoading(container);
    this.#bindMixerPanel(container, activeChannel);
    this.#bindNeighbors(container, activeChannel);
    this.#bindFeedNavigation(container);
    this.#bindComposeForm(container, activeChannel);
    this.#bindDeleteChannel(container, activeChannel, activeChannelId);
    this.#bindPostActions(container);
    this.#bindGlobalEvents(container, activeChannel);
  }

  #initSimilarityScores(container, activeChannel, activeChannelId) {
    if (activeChannel && activeChannelId) {
      feedService
        .computeChannelPostScores(activeChannelId)
        .then((scores) => {
          Object.entries(scores).forEach(([postId, { similarityScore, matchedChannelName }]) => {
            const postCard = container.querySelector(`[data-post-id="${postId}"]`);
            if (postCard && similarityScore != null) {
              const badge = document.createElement('div');
              badge.className = 'post-sim-badge';
              badge.textContent = `${similarityScore.toFixed(2)} · #${matchedChannelName}`;
              const postContent = postCard.querySelector('.post-content');
              if (postContent) postContent.parentNode.insertBefore(badge, postContent.nextSibling);
            }
          });
        })
        .catch((err) => console.warn('Failed to compute similarity scores:', err.message));
    }
  }

  #initLazyLoading(container) {
    if ('IntersectionObserver' in window) {
      this.#lazyObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const card = entry.target;
              if (card.dataset.lazy === 'true') {
                card.dataset.lazy = 'false';
                card.classList.add('loaded');
              }
              this.#lazyObserver.unobserve(card);
            }
          });
        },
        { rootMargin: '200px' }
      );
      container
        .querySelectorAll('.post-card[data-lazy="true"]')
        .forEach((card) => this.#lazyObserver.observe(card));
    }
  }

  #bindMixerPanel(container, activeChannel) {
    const mixerContainer = container.querySelector('[data-component="mixer-panel"]');
    if (!mixerContainer || !activeChannel) {
      this.#mixerPanel?.destroy();
      this.#mixerPanel = null;
      return;
    }

    this.#mixerPanel?.destroy();
    this.#mixerPanel = new MixerPanelComponent(mixerContainer, activeChannel);

    // Listen for view mode changes from mixer panel
    mixerContainer.addEventListener('mixer:view-change', (e) => {
      const { viewMode, specificity, minSimilarity, sortBy, filters } = e.detail || {};
      if (!activeChannel) return;

      const settings = channelSettingsService.getSettings(activeChannel.id);
      const updatedSettings = { ...settings };
      if (viewMode) updatedSettings.viewMode = viewMode;
      if (specificity != null) updatedSettings.specificity = specificity;
      if (minSimilarity != null) updatedSettings.minSimilarity = minSimilarity;
      if (sortBy) updatedSettings.sortBy = sortBy;
      if (filters) updatedSettings.filters = filters;

      channelSettingsService.updateSettings(activeChannel.id, updatedSettings);

      if (viewMode) {
        document.dispatchEvent(
          new CustomEvent('isc:channel-view-change', { detail: { mode: viewMode } })
        );
      }
    });
  }

  #bindNeighbors(container, activeChannel) {
    const neighborPanelContainer = container.querySelector('[data-component="neighbors"]');

    if (!activeChannel) {
      this.#neighborsComponent?.destroy();
      this.#neighborsComponent = null;
      return;
    }

    if (neighborPanelContainer) {
      const settings = channelSettingsService.getSettings(activeChannel.id);
      this.#neighborsComponent?.destroy();
      this.#neighborsComponent = new NeighborsComponent(neighborPanelContainer, {
        channelId: activeChannel.id,
        channelName: activeChannel.name,
        threshold: (settings.specificity ?? 50) / 100,
        limit: 10,
        sortBy: 'similarity',
        viewMode: settings.neighborViewMode ?? 'list',
        showDetails: true,
      });

      neighborPanelContainer.addEventListener('neighbors:start-chat', (e) => {
        const { peerId } = e.detail || {};
        if (peerId) {
          document.dispatchEvent(
            new CustomEvent('isc:start-chat', { detail: { peerId }, bubbles: true })
          );
        }
      });

      neighborPanelContainer.addEventListener('neighbors:audio-space', async (e) => {
        const { channelId } = e.detail || {};
        if (!channelId) return;
        try {
          const { createAudioSpace, joinAudioSpace, getAllActiveSpaces } = await import('../../social/index.ts');
          const spaces = getAllActiveSpaces();
          const existingSpace = spaces.find((s) => s.channelID === channelId);

          if (existingSpace) {
            await joinAudioSpace(existingSpace.spaceID);
            toasts.info(`Joined audio space for #${existingSpace.channelID}`);
          } else {
            const space = await createAudioSpace(channelId);
            toasts.info(`Created audio space for channel`);
          }
        } catch (err) {
          toasts.error('Failed to join audio space: ' + err.message);
        }
      });
    }
  }

  #bindFeedNavigation(container) {
    const feed = container.querySelector('#now-feed');
    if (feed) {
      feed.addEventListener('keydown', (e) => {
        const posts = [...feed.querySelectorAll('.post-card[tabindex="0"]')];
        if (!posts.length) return;
        const current = document.activeElement;
        const idx = posts.indexOf(current);

        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          posts[Math.min(idx + 1, posts.length - 1)]?.focus();
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          posts[Math.max(idx - 1, 0)]?.focus();
        } else if (e.key === 'Enter' && current) {
          current.querySelector('[data-action="like"]')?.click();
        }
      });
    }

    container
      .querySelector('#now-refresh')
      ?.addEventListener('click', () => this.#doRefresh(container));
    container.querySelector('[data-action="new-channel"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('isc:new-channel'));
    });
  }

  #bindComposeForm(container, activeChannel) {
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

    container.querySelector('#compose-form')?.addEventListener('submit', async (e) => {
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

        if (this.#replyTo) {
          await postService.reply(targetChannelId, this.#replyTo.id, content);
          this.#replyTo = null;
          container.querySelector('.compose-reply-context')?.remove();
        } else {
          await postService.create(targetChannelId, content);
        }

        composeInput.value = '';
        if (composeCount) composeCount.textContent = '0 / 2000';
        document.dispatchEvent(
          new CustomEvent('isc:refresh-feed', { detail: { scrollToTop: true } })
        );
        toasts.success('Posted!');
      } catch (err) {
        console.error('FAILED TO POST:', err);
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

    setupCtrlEnterSubmit(composeInput, container.querySelector('#compose-form'));
    container
      .querySelector('#compose-channel-sel')
      ?.addEventListener('change', (e) => actions.setActiveChannel(e.target.value));
  }

  #bindDeleteChannel(container, activeChannel, activeChannelId) {
    bindDelegate(container, '[data-testid="channel-delete-btn"]', 'click', async () => {
      if (!activeChannel) return;
      const ok = await modals.confirm(
        `Delete #${escapeHtml(activeChannel.name)}? This cannot be undone.`,
        { title: 'Delete channel', confirmText: 'Delete', danger: true }
      );
      if (!ok) return;
      try {
        await networkService.deleteChannel(activeChannelId);
        toasts.success('Channel deleted');
        window.location.hash = '#/now';
      } catch (err) {
        toasts.error('Failed to delete channel');
      }
    });
  }

  #bindPostActions(container) {
    const unbindLike = bindDelegate(container, '[data-like-btn]', 'click', (e, target) =>
      this.#handleLike(e, target, container)
    );
    const unbindReply = bindDelegate(container, '[data-reply-btn]', 'click', (e, target) =>
      this.#handleReply(e, target)
    );
    const unbindDelete = bindDelegate(container, '[data-delete-btn]', 'click', (e, target) =>
      this.#handleDelete(e, target)
    );

    this.#boundHandlers.push(unbindLike, unbindReply, unbindDelete);

    container.addEventListener('click', (e) => {
      const expandBtn = e.target.closest('.thread-expand-btn');
      if (expandBtn) {
        expandBtn.closest('.post-thread')?.classList.add('thread-expanded');
        expandBtn.remove();
        return;
      }

      if (e.target.closest('#load-more-btn')) {
        this.#postsPage++;
        this.#update(container);
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
          this.#replyTo = {
            id: postId,
            content: post.content,
            author: post.author ?? post.identity?.name,
          };
          this.#setReplyContext(container, this.#replyTo);
        }
      }
    });
  }

  #bindGlobalEvents(container, activeChannel) {
    const handleViewChange = (e) => {
      const { mode } = e.detail || {};
      if (!mode) return;
      const feed = container.querySelector('#now-feed');
      if (!feed) return;
      feed.className = `feed_view-${mode}`;

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
        this.#update(container);
      }
    };
    document.addEventListener('isc:channel-view-change', handleViewChange);
    this.#boundHandlers.push(() =>
      document.removeEventListener('isc:channel-view-change', handleViewChange)
    );

    const unsubPosts = subscribe((state) => {
      const count = state.posts?.length ?? 0;
      if (count !== this.#lastPostCount && !this.#refreshing) {
        this.#lastPostCount = count;
        const feed = container.querySelector('#now-feed');
        if (feed) {
          const { activeChannelId } = getState();
          const { channels } = getState();
          const activeChannel = channels?.find((c) => c.id === activeChannelId);
          const viewMode = activeChannel
            ? channelSettingsService.getSettings(activeChannel.id).viewMode
            : 'list';
          const posts = activeChannelId
            ? feedService.getByChannel(activeChannelId, this.#postsPage * PAGE_SIZE)
            : feedService.getForYou(this.#postsPage * PAGE_SIZE);
          feed.innerHTML =
            posts.length === 0
              ? this.#renderEmptyState(channels, true, 'connected')
              : this.#renderPosts(posts, channels, viewMode);
        }
      }
    });
    this.#boundHandlers.push(unsubPosts);
  }

  #setReplyContext(container, replyTo) {
    const composeArea = container.querySelector('[data-testid="compose-bar"]');
    if (!composeArea) return;
    let ctx = composeArea.querySelector('.compose-reply-context');
    if (!ctx) {
      ctx = document.createElement('div');
      ctx.className = 'compose-reply-context';
      composeArea.prepend(ctx);
    }
    ctx.removeAttribute('hidden');
    ctx.innerHTML = `<span class="reply-label">↩ Replying to ${escapeHtml(replyTo.author ?? 'post')}</span><span class="reply-snippet">${escapeHtml((replyTo.content || '').slice(0, 60))}…</span><button class="reply-cancel" data-cancel-reply aria-label="Cancel reply">×</button>`;
    ctx.querySelector('[data-cancel-reply]')?.addEventListener('click', () => {
      this.#replyTo = null;
      ctx.remove();
    });
    container.querySelector('[data-testid="compose-input"]')?.focus();
  }

  #handleLike(e, target, container) {
    const wasLiked = target.dataset.liked === 'true';
    const counter = target.querySelector('.like-count');
    const delta = wasLiked ? -1 : 1;
    target.dataset.liked = String(!wasLiked);
    target.classList.toggle('liked', !wasLiked);
    if (counter) counter.textContent = String(parseInt(counter.textContent || '0') + delta);

    postService
      .like(target.dataset.postId)
      .then(() => {
        const feed = container.querySelector('#now-feed');
        if (!feed) return;
        const { activeChannelId, channels } = getState();
        const activeChannel = channels?.find((c) => c.id === activeChannelId);
        const viewMode = activeChannel
          ? channelSettingsService.getSettings(activeChannel.id).viewMode
          : 'list';
        const posts = activeChannelId
          ? feedService.getByChannel(activeChannelId, 50)
          : feedService.getForYou(50);
        feed.innerHTML =
          posts.length === 0
            ? this.#renderEmptyState(channels, true, 'connected')
            : this.#renderPosts(posts, channels, viewMode);
      })
      .catch(() => {
        target.dataset.liked = String(wasLiked);
        target.classList.toggle('liked', wasLiked);
        if (counter) counter.textContent = String(parseInt(counter.textContent || '0') - delta);
        toasts.warning('Could not save like');
      });
  }

  #handleReply(e, target) {
    // Reply is handled inline via #setReplyContext and #replyTo state
    // No event dispatch needed — class-based screen manages reply state directly
  }

  async #handleDelete(e, target) {
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

  #showAdvancedOptions(activeChannel) {
    const settings = channelSettingsService.getSettings(activeChannel.id);
    const html = `
      <div class="modal-header"><h2 class="modal-title">Channel Settings</h2></div>
      <div class="modal-body">
        <div class="settings-section">
          <div class="settings-group">
            <label class="settings-checkbox"><input type="checkbox" name="mute" ${settings.isMuted ? 'checked' : ''}><span>🔇 Mute this channel</span></label>
            <label class="settings-checkbox"><input type="checkbox" name="lurk" ${settings.isLurker ? 'checked' : ''}><span>👁 Lurk mode (don't include in vector)</span></label>
          </div>
        </div>
      </div>
      <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close">Close</button></div>`;
    const overlay = modals.open(html);
    overlay.querySelector('[name="mute"]')?.addEventListener('change', (e) => {
      channelSettingsService.updateSettings(activeChannel.id, {
        ...settings,
        isMuted: e.target.checked,
      });
      this.#update(this.#container);
    });
    overlay.querySelector('[name="lurk"]')?.addEventListener('change', (e) => {
      channelSettingsService.updateSettings(activeChannel.id, {
        ...settings,
        isLurker: e.target.checked,
      });
      this.#update(this.#container);
    });
    overlay.querySelector('[data-action="close"]')?.addEventListener('click', () => modals.close());
  }

  update(container, { scrollToTop = false } = {}) {
    if (this.#refreshing) return;
    const feed = container.querySelector('#now-feed');
    if (!feed) return;

    const { connected = false, status = 'disconnected' } = networkService.getStatus() ?? {};
    const connLabel = connected ? 'connected' : status;
    const { channels, activeChannelId } = getState();
    const activeChannel = channels?.find((c) => c.id === activeChannelId);

    if (activeChannel && activeChannelId !== this.#lastChannelId) {
      this.#lastChannelId = activeChannelId;
      this.#bindNeighbors(container, activeChannel);
      this.#bindMixerPanel(container, activeChannel);
    }

    if (activeChannel && networkService.fetchMessagesForChannel) {
      feed.innerHTML =
        '<div class="feed-loading" data-testid="feed-loading">Loading messages…</div>';
      networkService
        .fetchMessagesForChannel(activeChannel)
        .then((posts) => {
          if (!container.isConnected) return;
          feed.innerHTML =
            posts.length === 0
              ? this.#renderEmptyState(channels, connected, connLabel)
              : this.#renderPosts(posts, channels);
          if (scrollToTop)
            container.querySelector('[data-testid="channel-body"]')?.scrollTo({ top: 0 });
        })
        .catch(() => {
          const localPosts = activeChannelId ? feedService.getByChannel(activeChannelId, 50) : [];
          feed.innerHTML =
            localPosts.length === 0
              ? this.#renderEmptyState(channels, connected, connLabel)
              : this.#renderPosts(localPosts, channels);
        });
      return;
    }

    const localPosts = activeChannelId
      ? feedService.getByChannel(activeChannelId, 50)
      : feedService.getForYou(50);

    // Also include posts discovered via DHT (stored in app state)
    const statePosts = getState().posts ?? [];
    const allPosts = activeChannelId
      ? [...localPosts, ...statePosts.filter(p => (p.channelId || p.channelID) === activeChannelId)]
      : [...localPosts, ...statePosts];

    // Deduplicate by id and sort by timestamp
    const seen = new Set();
    const posts = allPosts
      .filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0))
      .slice(0, 50);

    // Fetch more posts from DHT network if combined feed is sparse
    const isConnected = connected || status === 'connected';
    if (isConnected && activeChannelId && posts.length < 5) {
      postService.discoverFromNetwork(activeChannelId).then(newPosts => {
        if (newPosts?.length > 0 && container.isConnected) {
          this.#update(container); // Re-render with new posts
        }
      }).catch(() => {});
    }

    feed.innerHTML =
      posts.length === 0
        ? this.#renderEmptyState(channels, connected, connLabel)
        : this.#renderPosts(posts, channels);
    if (scrollToTop) container.querySelector('[data-testid="channel-body"]')?.scrollTo({ top: 0 });
  }

  async #doRefresh(container) {
    if (this.#refreshing) return;
    this.#refreshing = true;
    const btn = container.querySelector('#now-refresh');
    if (btn) {
      btn.classList.add('spinning');
      btn.disabled = true;
    }
    try {
      await networkService.discoverPeers?.().catch(() => {});
      this.#update(container);
    } finally {
      this.#refreshing = false;
      if (btn) {
        btn.classList.remove('spinning');
        btn.disabled = false;
      }
    }
  }

  #update(container) {
    this.#container = container;
    this.update(container);
  }

  destroy() {
    import('../utils/spaceCanvas.js').then((m) => m.destroySpaceCanvas());
    this.#neighborsComponent?.destroy();
    this.#lazyObserver?.disconnect();
    this.#boundHandlers.forEach((unbind) => unbind());
    this.#boundHandlers = [];
    this.#refreshing = false;
    this.#replyTo = null;
    this.#lastPostCount = 0;
    this.#postsPage = 1;
  }
}

const channelScreen = new ChannelScreen();
const screen = {
  render: () => channelScreen.render(),
  bind: channelScreen.bind.bind(channelScreen),
  update: channelScreen.update.bind(channelScreen),
  destroy: channelScreen.destroy.bind(channelScreen),
};
export const { render, bind, update, destroy } = screen;

function renderComposeBar(channels, activeChannelId, activeChannel) {
  if (!channels?.length) return '';

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
                       (ch) =>
                         `<option value="${escapeHtml(ch.id)}" ${ch.id === activeChannelId ? 'selected' : ''}>#${escapeHtml(ch.name)}</option>`
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
         ${activeChannel.relations
           .map(
             (rel, idx) => `
           <div class="relation-pill" data-relation-idx="${idx}" data-testid="relation-pill-${idx}" title="Edit relations">
             ${getRelationEmoji(rel.tag)} ${escapeHtml(rel.object.slice(0, 20))}${rel.object.length > 20 ? '…' : ''}
           </div>
         `
           )
           .join('')}
       </div>`
    : '';

  const breadthLabel = activeChannel?.breadth
    ? activeChannel.breadth.charAt(0).toUpperCase() + activeChannel.breadth.slice(1)
    : 'Balanced';
  const breadthBadge = activeChannel
    ? `<button class="breadth-badge" id="breadth-badge-btn" data-testid="breadth-badge" title="Click to edit channel breadth">
       ${breadthLabel}
     </button>`
    : '';

  return `
    <div class="screen-header channel-header" data-testid="channel-header">
      <div class="header-channel-identity">
        ${
          activeChannel
            ? `<div class="channel-title-row">
               <h1 class="channel-screen-title" data-testid="channel-title">#${escapeHtml(activeChannel.name)}</h1>
               ${breadthBadge}
               <button class="btn btn-icon btn-danger-ghost channel-delete-btn"
                       data-testid="channel-delete-btn"
                       title="Delete channel"
                       aria-label="Delete channel ${escapeHtml(activeChannel.name)}">
                 ✕
               </button>
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
    in_location: '📍',
    during_time: '📅',
    with_mood: '😊',
    under_domain: '🎯',
    causes_effect: '⚡',
    part_of: '🧩',
    similar_to: '🔄',
    opposed_to: '↔️',
    requires: '🔗',
    boosted_by: '⬆️',
  };
  return emojis[tag] || '🏷️';
}

function renderEmptyState(channels, connected, connLabel) {
  if (!channels?.length) {
    return `
      ${renderEmpty({
        icon: '💭',
        title: 'What are you thinking about?',
        description:
          "Create a channel — describe what's on your mind. ISC will find people on the same wavelength.",
        actions: [
          {
            label: 'Create Your First Channel',
            href: '#',
            'data-action': 'new-channel',
            variant: 'primary',
          },
        ],
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
      ? 'Post something to your channel — peers in your semantic neighborhood will see it.'
      : 'Connect to the network to start exchanging messages with semantic neighbors.',
    actions: [],
  });
}

function renderNeighborPanel(activeChannel) {
  return `<div class="neighbor-panel-container" data-component="neighbors"></div>`;
}

function renderHowStep(num, title, desc) {
  return `<div class="how-step"><span class="how-step-num">${num}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(desc)}</p></div></div>`;
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
      content = `<div class="space-canvas-placeholder" data-testid="space-canvas-placeholder">
        <canvas id="space-canvas" class="space-canvas" data-testid="space-canvas"></canvas>
      </div>`;
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
  const activeChannel = allChannels?.find((c) => c.id === activeChannelId);
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
  const spread =
    activeChannel.breadth === 'broad' ? 0.25 : activeChannel.breadth === 'narrow' ? 0.08 : 0.15;
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

function showAuthorPopover(postCard, peerId, authorName) {
  // Remove any existing popover
  document.querySelectorAll('.author-popover').forEach((p) => p.remove());

  const popover = document.createElement('div');
  popover.className = 'author-popover';
  popover.setAttribute('data-testid', 'author-popover');
  popover.innerHTML = `
    <div class="author-popover-name">${escapeHtml(authorName)}</div>
    <button class="btn btn-sm btn-primary author-popover-dm" data-peer-id="${escapeHtml(peerId)}">
      Message →
    </button>
    <button class="btn btn-sm btn-ghost author-popover-profile" data-peer-id="${escapeHtml(peerId)}">
      View Profile
    </button>
    <button class="btn btn-sm btn-ghost author-popover-close">Close</button>
  `;

  postCard.style.position = 'relative';
  postCard.appendChild(popover);

  popover.querySelector('.author-popover-dm')?.addEventListener('click', () => {
    document.dispatchEvent(
      new CustomEvent('isc:start-chat', { detail: { peerId }, bubbles: true })
    );
    window.location.hash = '#/chats';
    popover.remove();
  });

  popover.querySelector('.author-popover-profile')?.addEventListener('click', () => {
    popover.remove();
    const peer = networkService.getMatches?.()?.find((p) => p.peerId === peerId) ?? {
      peerId,
      identity: { name: authorName, bio: '' },
      similarity: null,
      online: false,
    };
    modals.showPeerProfile(peer);
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
  const composeArea = container.querySelector('[data-testid="compose-bar"]');
  if (!composeArea) return;

  let ctx = composeArea.querySelector('.compose-reply-context');
  if (!ctx) {
    ctx = document.createElement('div');
    ctx.className = 'compose-reply-context';
    composeArea.prepend(ctx);
  }
  ctx.removeAttribute('hidden');
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
  postService
    .like(target.dataset.postId)
    .then(() => {
      // Force re-render of the feed to update like states
      const feed = document.querySelector('#now-feed');
      if (feed) {
        const { activeChannelId, channels } = getState();
        const activeChannel = channels?.find((c) => c.id === activeChannelId);
        const viewMode = activeChannel
          ? channelSettingsService.getSettings(activeChannel.id).viewMode
          : 'list';
        const posts = activeChannelId
          ? feedService.getByChannel(activeChannelId, 50)
          : feedService.getForYou(50);
        feed.innerHTML =
          posts.length === 0
            ? renderEmptyState(channels, true, 'connected')
            : renderPosts(posts, channels, viewMode);
      }
    })
    .catch(() => {
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
