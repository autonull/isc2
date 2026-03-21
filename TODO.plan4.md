# TODO.plan4.md — ISC: Complete Current Development Plan

**Supersedes:** TODO.plan3.md, TODO.plan2.md, TODO.plan.md

**Status tracking:** ☐ todo · ⏳ in progress · ✅ done

**Priority order:** Web UI > TUI >> CLI (CLI is out of scope for this plan)

**Guiding principles:**
- Essential functionality first — the core loop (channel → post → discover → chat) must work end-to-end
- Advanced features (ThoughtTwin, Thought Bridge, Chaos Mode, File Transfer, Invite Links) live
  behind a collapsed Settings section or a low-prominence "more" menu
- Every item is grounded in the verified state of the code; nothing is listed if already done

---

## Verification summary: what plan3 actually completed

The following plan3 items are **confirmed done** and do NOT appear below:
A1 A2 A3 A4 A5 A7 · B3 B4 · C1 C3 C4 · D1 D2 D3 D4 · E1 E2 E3 E4 ·
F1 F2 F3 F4 F5 F7 · G1 G2 G3 G4 · I1 I2 I3 I4 · J1(discovery live-save) J3 ·
K1 K2 K3 K4 · L1 L3 L4 · M2

The following plan3 items are **confirmed incomplete** and form Phases A–D below.

---

## Phase A — Remaining P0 Bugs (plan3 leftovers)

### A1 — Duplicate send handler accumulates on every conversation open ☐

**Where:** `screens/chats.js`

`bindChatInputHandlers(container)` may be called from both `bind()` and
`openChat()`. After opening N conversations, Enter sends N messages.

**Verify and fix:** Confirm `openChat()` does NOT call `bindChatInputHandlers()`.
The handlers read `activePeerId` at call-time from the DOM, so they work
correctly for whichever conversation is currently rendered.

```js
// In openChat(): ensure this line is ABSENT:
// bindChatInputHandlers(container);  ← must not be here
```

---

### A2 — `renderError()` still uses `onclick` function serialization ☐

**Where:** `utils/screen.js` → `renderError()` line ~108:

```js
const retryAttr = onRetry ? `onclick="${onRetry.toString()}"` : '';
```

`Function.toString()` serializes the function source as an attribute — closures
are lost and this never works.

**Fix:**
```js
export function renderError(message, { retryLabel = 'Retry', onRetry } = {}) {
  return `
    <div class="empty-state" data-testid="error-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Something went wrong</div>
      <div class="empty-state-description">${escapeHtml(message)}</div>
      ${onRetry ? `
        <button class="btn btn-primary mt-4" data-action="retry"
                data-testid="retry-btn">${escapeHtml(retryLabel)}</button>
      ` : ''}
    </div>
  `;
}
```

Callers must bind the retry action themselves using a delegated click handler:
```js
container.addEventListener('click', e => {
  if (e.target.closest('[data-action="retry"]')) onRetry?.();
});
```

Audit all `renderError()` call sites and update them.

---

### A3 — `discover.js`: convergence "View" button navigates to deleted `#/space` ☐

**Where:** `screens/discover.js` → `loadConvergenceBanner()` → `#convergence-view` handler:

```js
containerEl.querySelector('#convergence-view')?.addEventListener('click', () => {
  window.location.hash = '#/space';  // ← /space was deleted in plan3 E4
});
```

**Fix:** Replace with the Space view mode in the Now screen:
```js
containerEl.querySelector('#convergence-view')?.addEventListener('click', () => {
  window.location.hash = '#/now';
  // Signal Now screen to switch to space view mode
  requestAnimationFrame(() => requestAnimationFrame(() =>
    document.dispatchEvent(new CustomEvent('isc:channel-view-change', {
      detail: { mode: 'space' }, bubbles: true,
    }))
  ));
});
```

---

### A4 — Mobile chats: split-panel layout CSS missing ☐

**Where:** `styles/irc.css`

`screens/chats.js` toggles `.chat-open` on `.chats-layout` for mobile navigation,
but no corresponding CSS media query exists.

**Add to `irc.css`:**
```css
@media (max-width: 640px) {
  .chats-layout {
    flex-direction: column;
    position: relative;
  }
  .conversation-list-panel {
    width: 100%;
    flex-shrink: 0;
  }
  .chat-panel { display: none; }

  .chats-layout.chat-open .conversation-list-panel { display: none; }
  .chats-layout.chat-open .chat-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
}
```

---

## Phase B — Settings Completion (plan3 leftovers)

### B1 — Remove "Save Preferences" button; wire appearance as live-save ☐

**Where:** `screens/settings.js` → `renderAppearance()` and `bind()`

**In `renderAppearance()`:** Remove the entire `<div class="form-actions">` block
containing `#save-preferences`.

**In `bind()`:** Remove the `#save-preferences` click handler (currently just
calls `toasts.success`). The preference toggles already live-save via the
`liveSettings` forEach loop — the button is vestigial.

---

### B2 — `showEditModal` in mixerPanel: export it and fix DOM scoping ☐

**Where:** `components/mixerPanel.js`

Plan3 J2 specified that `showEditModal` should be exported so `settings.js`
can reuse it, and that its internal `on()` helper should scope to the modal
element rather than `document`.

**Step 1 — export the function:**
```js
// Change:
function showEditModal(channel) {
// To:
export function showEditModal(channel) {
```

**Step 2 — fix `on()` scoping inside `showEditModal`:**
```js
// Current (broken — finds any element on the page):
function on(selector, event, handler) {
  document.querySelector(selector)?.addEventListener(event, handler);
}

// Fix — scope to the modal element:
function on(selector, event, handler) {
  modal.querySelector(selector)?.addEventListener(event, handler);
}
```

Also update `saveChanges()` inside `showEditModal` to use `modal.querySelector()`
instead of `document.querySelector()` for all field reads.

**Step 3 — use in `settings.js`:**
```js
import { showEditModal } from '../components/mixerPanel.js';

container.addEventListener('click', e => {
  const editBtn = e.target.closest('.edit-channel-btn');
  if (editBtn) {
    const ch = channelService.getById(editBtn.dataset.channelId);
    if (ch) showEditModal(ch);
  }
});
```

---

### B3 — Nostr Identity Bridge: resolve or remove ☐

**Where:** `screens/settings.js` → `renderIdentity()` and `bind()`

The Nostr bridge code is entirely commented out with a note "temporarily disabled
due to build resolution issues." This is not an acceptable production state.

**Option A — fix the build:**
Resolve the import path for `../../identity/nostr.js` (or wherever the Nostr
module lives). Once buildable, wrap the section in a `<details>` element as
plan3 J4 specified:
```js
<details class="nostr-bridge-details" data-testid="nostr-bridge">
  <summary class="settings-subsection-toggle">
    Nostr Identity Bridge
    <span id="nostr-linked-indicator"></span>
  </summary>
  <div class="nostr-bridge-body mt-3">
    <!-- nsec input, link/unlink buttons, status -->
  </div>
</details>
```

**Option B — remove entirely:**
If the Nostr module is not resolvable within this plan's scope, delete the
commented block entirely. Do not ship dead commented-out code in production.

Decide which option and act on it.

---

### B4 — Ephemeral session toggle in Identity section ☐

**Where:** `screens/settings.js` → `renderIdentity()` and `bind()`

**In `renderIdentity()`**, add inside the `<section>` before the closing tag:
```js
const isEphemeral = localStorage.getItem('isc-ephemeral-session') === 'true';
// ...
<div class="divider mt-4 mb-4"></div>
<div class="toggle-row" data-testid="ephemeral-toggle-row">
  <div>
    <div class="toggle-label-text">Anonymous (ephemeral) session</div>
    <div class="toggle-hint">
      Identity exists only in this tab. Closing it permanently erases all data.
    </div>
  </div>
  <label class="toggle">
    <input type="checkbox" id="ephemeral-toggle" ${isEphemeral ? 'checked' : ''}
           data-testid="ephemeral-session-toggle" />
    <span class="toggle-slider"></span>
  </label>
</div>
```

**In `bind()`:**
```js
container.querySelector('#ephemeral-toggle')?.addEventListener('change', e => {
  if (e.target.checked) {
    localStorage.setItem('isc-ephemeral-session', 'true');
  } else {
    localStorage.removeItem('isc-ephemeral-session');
  }
  showInlineSaved(e.target.closest('.toggle-row'));
});
```

---

### B5 — Update "Clear All Data" confirmation copy ☐

**Where:** `screens/settings.js` → `bind()` → `#clear-data` handler

Current text: "Delete ALL channels, posts, matches, settings, and identity?"
Plan3 J6 spec:
```js
const ok = await modals.confirm(
  'This removes all your channels, posts, conversations, settings, and identity ' +
  'from this browser. It cannot be undone. Consider exporting your identity first.',
  {
    title: 'Clear All Local Data',
    confirmText: 'Clear Everything',
    danger: true,
  }
);
```

---

### B6 — Update "Reset Identity" confirmation copy ☐

**Where:** `screens/settings.js` → `bind()` → `#reset-identity-btn` handler

Current text: "Clear your identity? You will get a new one on next launch."
Plan3 J3 spec:
```js
const ok = await modals.confirm(
  'This generates a brand-new cryptographic identity on next launch. ' +
  'Your channels and conversations will be lost unless you export first.',
  {
    title: 'Reset Identity',
    confirmText: 'Reset',
    cancelText: 'Cancel',
    danger: true,
  }
);
```

---

## Phase C — Screen Lifecycle Completion (plan3 leftovers)

### C1 — Migrate screens to `createScreen()` factory ☐

**Where:** All `screens/*.js` except `now.js` (which already has `destroy()`).

`utils/screen.js` exports `createScreen({ render, bind, update, destroy })` but
no screen uses it. The router calls `currentScreen.destroy()` — if the screen
has no `destroy`, cleanup never runs.

**For each of `discover.js`, `chats.js`, `settings.js`, `compose.js`:**

1. Ensure `bind()` returns an array of zero-argument cleanup functions:

```js
// discover.js:
export function bind(container) {
  // ...existing handlers...
  return [
    () => { bridgeCandidates = []; convergenceEvent = null;
            noMatchesBannerEl = null; autoDiscovered = false; activeCallout = null; },
    () => dismissCallout(container),
    () => dismissNoMatchesBanner(),
  ];
}

// chats.js:
export function bind(container) {
  // ...existing handlers...
  return [
    () => document.removeEventListener('isc:start-chat', onStartChat),
    () => window.removeEventListener('storage', onStorage),
    () => window.removeEventListener('storage', onStorageTyping),
    () => window.removeEventListener('online', onOnline),
    () => window.removeEventListener('offline', onOffline),
    () => { activePeerId = null; boundContainer = null; clearTimeout(typingTimeout); },
  ];
}

// settings.js bind() can return []:
export function bind(container) { /* ... */ return []; }

// compose.js:
export function bind(container, params = {}) {
  // ...existing...
  return [() => clearInterval(embeddingPollInterval)];
}
```

2. Wrap each screen's named exports in `createScreen()` and add a default export:

```js
// At the bottom of each screen file:
export default createScreen({ render, bind, update });
```

3. Update `app.js` `SCREENS` map to accept the default exports if needed; the
router should call `screen.destroy?.()` before replacing a screen.

---

### C2 — Delete orphaned `status-bar.js` ☐

**Where:** `components/status-bar.js`

`layout.js` no longer imports or creates a status bar (plan3 C2 removed it from
the layout). The file still exists on disk.

Delete `apps/browser/src/vanilla/components/status-bar.js`.

Run `grep -r "status-bar"` to confirm no remaining imports.

---

### C3 — Sidebar nav strip: keyboard navigation ☐

**Where:** `components/sidebar.js` → `bind()` keyboard handler

The nav strip has `role="toolbar"`. Arrow Left/Right should move focus between
the four `.snav-btn` elements; Tab should exit the toolbar. Currently no Arrow
key handling exists in `sidebar.js`.

```js
// In bind() keydown handler:
const snavBtn = e.target.closest('.snav-btn');
if (snavBtn && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
  e.preventDefault();
  const btns = [...el.querySelectorAll('.snav-btn')];
  const idx  = btns.indexOf(snavBtn);
  const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
  btns[next]?.focus();
}
```

Also update `cycleSidebarFocus()` in `router.js` to include `.snav-btn`:
```js
const items = [...document.querySelectorAll('.snav-btn, .irc-channel-item')];
```

---

## Phase D — CSS, Copy & Code Quality (plan3 leftovers)

### D1 — Extract inline styles from `app.js` PWA install banner ☐

**Where:** `app.js` → `setupPWAInstallPrompt()` → `installBanner.style.cssText`

The install banner uses ~12 lines of inline style. Move to `irc.css`:
```css
.pwa-install-banner {
  position: fixed; bottom: 60px; left: 50%;
  transform: translateX(-50%);
  background: var(--c-bg-card);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--r-md);
  padding: 12px 16px;
  display: flex; align-items: center; gap: 12px;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  font-size: 14px;
}
```

In `app.js`:
```js
installBanner.className = 'pwa-install-banner';
installBanner.id = 'pwa-install-banner';
// Remove installBanner.style.cssText = ... line
```

---

### D2 — Remove emoji from `SIMILARITY_TIERS` labels ☐

**Where:** `screens/discover.js` → `SIMILARITY_TIERS` constant

Plan3 G5 specified plain text labels. Current labels still use emoji:
```js
// Current (wrong):
{ key: 'strong',  label: '🔥 Strong match', ... }
{ key: 'good',    label: '✨ Good match', ... }
{ key: 'partial', label: '🌀 Partial match', ... }
{ key: 'weak',    label: '🌌 Weak match', ... }

// Fix:
const SIMILARITY_TIERS = [
  { key: 'strong',  label: 'Strong match',  desc: '85%+',   min: 0.85 },
  { key: 'good',    label: 'Good match',    desc: '70–85%', min: 0.70, max: 0.85 },
  { key: 'partial', label: 'Partial match', desc: '55–70%', min: 0.55, max: 0.70 },
  { key: 'weak',    label: 'Weak match',    desc: '<55%',   max: 0.55 },
];
```

---

### D3 — Remove emoji from Settings section titles ☐

**Where:** `screens/settings.js` → `renderProfile()`, `renderIdentity()`,
`renderDiscovery()`, `renderAppearance()`, `renderChannels()`, `renderDangerZone()`,
`renderAbout()`

Plan3 M3 policy: section titles use no emoji. Current state: every section title
has an emoji prefix (🔐 Identity, 📡 Discovery, 🎨 Appearance, etc.).

```js
// Before: <div class="section-title">🔐 Identity</div>
// After:  <div class="section-title">Identity</div>
```

Apply to every `.section-title` inside settings sections.

---

### D4 — Extract inline styles from remaining screen files ☐

**Where:** Various screen and component files

Remaining `style="..."` attributes in templates (M1 sweep):
- `screens/now.js`: `style="margin-left:auto"` on delete button in `renderPostCard()`
- `screens/compose.js`: `style="display:flex"` on success div
- `screens/settings.js`: any remaining `style=` attributes in render functions
- `components/mixerPanel.js`: any `display:none` / `display:flex` inline styles

Move each to `irc.css` utility classes. Use `.ml-auto`, `.hidden`,
`.flex-row`, `.flex-col` which are already in plan3's M1 utility set.

---

### D5 — `screen.js:renderHeader()` inline style ☐

**Where:** `utils/screen.js` → `renderHeader()`:
```js
<div style="display:flex;align-items:center;gap:12px;min-width:0">
```

Replace with `class="flex-row gap-3 min-w-0"`.

---

### D6 — `index.js` fatal error handler inline styles ☐

**Where:** `apps/browser/src/vanilla/index.js` → `catch` block

The catch block renders a fatal error screen using an inline `style` string.
Add `.fatal-error-screen` to `irc.css` and replace the inline styles.

---

### D7 — Channel framing: consistent copy throughout ☐

**Where:** Various screen files — verify these specific strings are in place:

| Location | Required text |
|---|---|
| Sidebar section header | "My Channels" |
| Sidebar empty state | "No channels yet — press + to start" |
| Now empty state (no channels) title | "What are you thinking about?" |
| Discover: no-channels banner | "You need a channel before discovering peers. Your channel describes what you're thinking about — ISC finds others thinking similarly." |
| Compose header | "New Channel" (no emoji) |
| Settings channels section | "My Channels (N)" |

Audit each location and update any that don't match.

---

## Phase E — Feed Completeness

### E1 — Reply thread rendering ☐

**Where:** `screens/now.js` → `renderListPosts()`

Posts with `replyTo` are rendered flat. They should be grouped and indented
under their parent.

**Step 1 — group into threads:**
```js
function renderListPosts(posts, channels) {
  const postMap = new Map(posts.map(p => [p.id, p]));
  const topLevel = posts.filter(p => !p.replyTo);

  return `<div class="feed-list">${topLevel.map(post => {
    const replies = posts.filter(r => r.replyTo === post.id);
    return `
      ${renderPost(post, channels)}
      ${replies.length ? `
        <div class="post-thread" data-parent-id="${escapeHtml(post.id)}">
          ${replies.slice(0, 3).map(r => renderReplyPost(r, post, channels)).join('')}
          ${replies.length > 3 ? `
            <button class="thread-expand-btn"
                    data-thread="${escapeHtml(post.id)}"
                    data-testid="expand-thread-${escapeHtml(post.id)}">
              Show all ${replies.length} replies
            </button>
          ` : ''}
        </div>
      ` : ''}
    `;
  }).join('')}</div>`;
}
```

**Step 2 — `renderReplyPost()` helper:**
```js
function renderReplyPost(post, parentPost, channels) {
  const parentSnippet = escapeHtml((parentPost.content || '').slice(0, 60)) +
    (parentPost.content?.length > 60 ? '…' : '');
  return `
    <div class="post-card post-card-reply" data-post-id="${escapeHtml(post.id)}"
         data-testid="post-card-reply">
      <div class="post-reply-context">
        <span class="reply-indicator" aria-hidden="true">↩</span>
        <span class="reply-parent-snippet">${parentSnippet}</span>
      </div>
      ${renderPostCardBody(post, channels)}
    </div>
  `;
}
```

Extract the inner markup of `renderPostCard()` into `renderPostCardBody()` so
both `renderPost()` and `renderReplyPost()` share it.

**Step 3 — expand button handler in `bind()`:**
```js
container.addEventListener('click', e => {
  const expandBtn = e.target.closest('.thread-expand-btn');
  if (expandBtn) {
    expandBtn.closest('.post-thread')?.classList.add('thread-expanded');
    expandBtn.remove();
  }
  // ...existing handlers
});
```

**CSS:**
```css
.post-thread {
  margin-left: 24px;
  border-left: 2px solid rgba(255,255,255,0.06);
  padding-left: 12px;
}
.post-card-reply { background: var(--c-bg-card); }
.post-reply-context {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: var(--c-text-muted); margin-bottom: 6px;
}
.reply-indicator { color: var(--c-brand); }
.thread-expand-btn {
  font-size: 12px; color: var(--c-text-muted);
  background: none; border: none; cursor: pointer; padding: 4px 0;
}
.thread-expand-btn:hover { color: var(--c-text); }
```

---

### E2 — Reply compose flow: distinguish reply from new post ☐

**Where:** `screens/now.js` → `bind()` submit handler

Currently the submit handler always calls `postService.create()`. When the
user clicks a Reply button, it should call `postService.reply(parentId, content)`.

**Module-level:**
```js
let _replyTo = null; // { id, content, author } | null
```

**In `bind()` → click handler, replace the existing reply handler:**
```js
container.addEventListener('click', e => {
  const replyBtn = e.target.closest('[data-action="reply"]');
  if (replyBtn) {
    const postId = replyBtn.dataset.postId;
    const allPosts = feedService.getForYou(200);
    const post = allPosts.find(p => p.id === postId);
    if (post) {
      _replyTo = { id: postId, content: post.content,
                   author: post.author ?? post.identity?.name };
      setReplyContext(container, _replyTo);
    }
    return;
  }
  // ...existing handlers
});
```

**`setReplyContext(container, replyTo)`:**
```js
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
```

**In `bind()` → submit handler:**
```js
if (_replyTo) {
  await postService.reply(_replyTo.id, content);
  _replyTo = null;
  container.querySelector('.compose-reply-context')?.remove();
} else {
  await postService.create(targetChannelId, content);
}
```

**In `destroy()`:**
```js
export function destroy() {
  _replyTo = null;
  // ...existing
}
```

**CSS:**
```css
.compose-reply-context {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 12px; color: var(--c-text-muted);
  padding: 6px 0 4px; border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 6px;
}
.reply-label   { color: var(--c-brand); font-weight: 500; }
.reply-snippet {
  flex: 1; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; min-width: 0;
}
.reply-cancel {
  background: none; border: none; cursor: pointer;
  color: var(--c-text-muted); font-size: 16px; padding: 0 2px; line-height: 1;
}
.reply-cancel:hover { color: var(--c-text); }
```

---

### E3 — Feed live-refresh when new posts arrive ☐

**Where:** `screens/now.js` → `bind()`

Posts arrive via gossipsub and land in state but the feed never re-renders.

```js
let _lastPostCount = 0;

// In bind(), after existing setup:
const { subscribe } = await import('../../state.js');
const unsubPosts = subscribe(state => {
  const count = state.posts?.length ?? 0;
  if (count !== _lastPostCount) {
    _lastPostCount = count;
    // Only re-render the feed div; preserve the compose input value
    const feed = container.querySelector('#now-feed');
    if (feed && !refreshing) {
      const posts = feedService.getForYou(PAGE_SIZE * _postsPage);
      const { channels } = getState();
      const viewMode = channelSettingsService
        .getSettings(getState().activeChannelId ?? '').viewMode ?? 'list';
      feed.innerHTML = posts.length === 0
        ? renderEmptyState(channels, true, 'connected')
        : renderPosts(posts, channels, viewMode);
    }
  }
});

return [
  () => { _lastPostCount = 0; },
  unsubPosts,
  ...existingCleanup,
];
```

---

### E4 — Post "load more" pagination ☐

**Where:** `screens/now.js`

```js
let _postsPage = 1;
const PAGE_SIZE = 20;
```

**In `renderPosts()`:**
```js
function renderPosts(posts, channels, viewMode = 'list') {
  const visible  = posts.slice(0, _postsPage * PAGE_SIZE);
  const hasMore  = posts.length > visible.length;
  const content  = renderPostsContent(visible, channels, viewMode);
  return `
    ${content}
    ${hasMore ? `
      <div class="load-more-row">
        <button class="btn btn-ghost btn-sm" id="load-more-btn"
                data-testid="load-more-posts">
          Load earlier posts (${posts.length - visible.length} more)
        </button>
      </div>
    ` : ''}
  `;
}
```

Rename old `renderPosts()` body to `renderPostsContent()`.

In `bind()` click handler:
```js
if (e.target.closest('#load-more-btn')) { _postsPage++; update(container); return; }
```

In `destroy()`:
```js
_postsPage = 1;
```

---

### E5 — Like: local persistence when network layer is absent ☐

**Where:** `services/index.js` → `postService.like()`

The like optimistically updates the UI but isn't persisted locally when the
network layer doesn't implement `likePost`. On refresh the like vanishes.

```js
async like(postId) {
  try {
    if (typeof networkService.service?.likePost === 'function') {
      await networkService.service.likePost(postId);
    } else {
      const key = 'isc:liked-posts';
      const liked = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
      liked.add(postId);
      localStorage.setItem(key, JSON.stringify([...liked]));
    }
  } catch (err) {
    logger.error('Like failed', { error: err.message });
    throw err; // re-throw so handleLike() can rollback the optimistic update
  }
},

getLikedPosts() {
  try { return new Set(JSON.parse(localStorage.getItem('isc:liked-posts') || '[]')); }
  catch { return new Set(); }
},
```

In `screens/now.js` → `renderPostCard()`:
```js
const liked = postService.getLikedPosts().has(post.id);
// On the Like button: data-liked="${liked}" class="post-action-btn${liked ? ' liked' : ''}"
```

---

## Phase F — WebRTC Message Delivery (P0)

`chatService._sendViaWebRTC()` is an empty stub. Messages are saved locally
but **never transmitted to the peer**. Chat is non-functional peer-to-peer.

### F1 — Wire outgoing messages to network layer ☐

**Where:** `services/index.js` → `chatService._sendViaWebRTC()`

```js
async _sendViaWebRTC(peerId, message) {
  try {
    const svc = networkService.service;
    if (typeof svc?.sendMessage !== 'function') {
      logger.warn('chatService: sendMessage not in network layer — local only');
      return;
    }
    await svc.sendMessage(peerId, {
      type: 'chat',
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
    });
    // Mark delivered
    const msgs = this.getMessages(peerId);
    const idx = msgs.findIndex(m => m.id === message.id);
    if (idx !== -1) {
      msgs[idx].delivered = true;
      this._saveMessages(peerId, msgs);
    }
  } catch (err) {
    logger.warn('WebRTC message delivery failed — stored locally', { error: err.message });
    // Non-fatal: message is already in localStorage
  }
},
```

---

### F2 — Wire incoming messages from network layer ☐

**Where:** `services/network.ts`

```ts
// In BrowserNetworkService initialize() or constructor:
this.service.on?.('onMessageReceived', (peerId: string, message: ChatMessage) => {
  if (message.type !== 'chat') return;

  const key = `isc:chat:${peerId}`;
  const stored: ChatMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
  if (stored.some(m => m.id === message.id)) return; // dedup
  stored.push({ ...message, fromMe: false, read: false });
  localStorage.setItem(key, JSON.stringify(stored));

  const unreadKey = `isc:chat:unread:${peerId}`;
  localStorage.setItem(unreadKey,
    String(parseInt(localStorage.getItem(unreadKey) || '0', 10) + 1));

  document.dispatchEvent(new CustomEvent('isc:new-message', {
    detail: { peerId, preview: (message.content || '').slice(0, 80) },
    bubbles: true,
  }));
});
```

---

### F3 — New-message toast while on another screen ☐

**Where:** `app.js`

```js
document.addEventListener('isc:new-message', ({ detail }) => {
  if (router.getCurrentRoute() === '/chats') return;

  const name = (() => {
    try {
      const convs = JSON.parse(localStorage.getItem('isc-conversations') || '[]');
      return convs.find(c => c.peerId === detail.peerId)?.name ?? 'Peer';
    } catch { return 'Peer'; }
  })();

  toasts.info(`${escapeHtml(name)}: ${escapeHtml(detail.preview)}`, {
    action: { label: 'Open', onClick: () => navigate('/chats') },
    duration: 6000,
  });
});
```

**`utils/toast.js`** — add action button support if not present:
```js
// In showToast(), after creating element:
if (opts?.action) {
  const btn = document.createElement('button');
  btn.className = 'toast-action-btn';
  btn.textContent = opts.action.label;
  btn.addEventListener('click', () => { opts.action.onClick?.(); removeToast(el); });
  el.appendChild(btn);
}
```
```css
.toast-action-btn {
  background: none; border: 1px solid rgba(255,255,255,0.3); color: inherit;
  border-radius: var(--r-sm); font-size: 12px; padding: 2px 8px;
  cursor: pointer; margin-left: 8px; flex-shrink: 0;
}
```

---

### F4 — Unread badge: add desktop sidebar nav button ☐

**Where:** `router.js` → `updateChatsBadge()`

The function only targets `[data-testid="nav-tab-chats"]` (mobile tab bar).
Desktop uses `[data-testid="snav-chats"]`. Both must be targeted:

```js
document.querySelectorAll(
  '[data-testid="snav-chats"], [data-testid="nav-tab-chats"]'
).forEach(el => { /* badge logic — unchanged */ });
```

---

### F5 — Typing indicator display ☐

**Where:** `screens/chats.js` → `renderChatView()` and `bind()`

`chats.js` has a `renderTypingIndicator()` helper but the `onStorageTyping`
handler may not update it. Verify the handler writes to the correct element:

```js
function onStorageTyping(e) {
  if (e.key !== `isc-typing-${activePeerId}`) return;
  const el = boundContainer?.querySelector('[data-testid="typing-indicator"]');
  if (!el) return;
  if (e.newValue) {
    el.textContent = 'typing…';
    clearTimeout(typingClearTimer);
    typingClearTimer = setTimeout(() => { el.textContent = ''; }, 3000);
  } else {
    el.textContent = '';
  }
}
```

```css
.typing-indicator {
  font-size: 11px; color: var(--c-text-muted);
  padding: 2px 16px; min-height: 18px; font-style: italic;
}
```

---

## Phase G — Cold Start & First-Run Experience

### G1 — Splash: real model load progress ☐

**Where:** `packages/network/src/embedding.ts` and `components/splash.js`

The splash shows a static spinner. Wire it to actual download progress.

**In `embedding.ts` → `load()`:**
```ts
this.model = await pipeline('feature-extraction', MODEL_NAME, {
  progress_callback: (p) => {
    document.dispatchEvent(new CustomEvent('isc:model-progress', {
      detail: { status: p.status, progress: p.progress ?? 0 },
      bubbles: true,
    }));
  },
});
```

**In `components/splash.js`:**
Add a progress bar to the splash HTML:
```html
<div class="splash-progress-track">
  <div class="splash-progress-bar" data-testid="splash-progress-bar"
       style="width:0"></div>
</div>
<div class="splash-progress-label" data-testid="splash-progress-label">
  Starting…
</div>
```

Wire in `show()`:
```js
document.addEventListener('isc:model-progress', ({ detail }) => {
  const bar   = document.querySelector('[data-testid="splash-progress-bar"]');
  const label = document.querySelector('[data-testid="splash-progress-label"]');
  if (bar) bar.style.width = `${Math.round((detail.progress ?? 0) * 100)}%`;
  if (label) {
    label.textContent = detail.status === 'downloading'
      ? `Downloading AI model… ${Math.round((detail.progress ?? 0) * 100)}%`
      : 'Loading model…';
  }
});
```

```css
.splash-progress-track {
  width: 200px; height: 3px; background: rgba(255,255,255,0.1);
  border-radius: 2px; margin: 12px auto 8px;
}
.splash-progress-bar {
  height: 100%; background: var(--c-brand);
  border-radius: 2px; transition: width 0.3s ease;
}
.splash-progress-label {
  font-size: 12px; color: var(--c-text-muted); text-align: center;
}
```

---

### G2 — Demo mode: ghost peers when network is empty ☐

**Where:** `services/demoMode.ts` (exists) + `screens/discover.js`

If the user has channels but zero matches after 15 seconds connected, activate
demo mode.

**Ensure `demoMode.ts` exports:**
- `activateDemoMode(): Promise<void>`
- `getDemoMatches(): PeerMatch[]` — 4–6 ghost peers with varied similarity, each with `_isDemo: true`
- `getDemoPosts(): Post[]` — 5–8 realistic short posts

**In `screens/discover.js` → `bind()`:**
```js
let _demoTimer = null;

const { channels } = getState();
const connected = networkService.getStatus()?.connected ?? false;

if (connected && channels.length > 0 && discoveryService.getMatches().length === 0) {
  _demoTimer = setTimeout(async () => {
    if (discoveryService.getMatches().length > 0) return; // real peers arrived
    const dm = await import('../../services/demoMode.ts');
    await dm.activateDemoMode?.();
    const demoMatches = dm.getDemoMatches?.() ?? [];
    if (demoMatches.length > 0) {
      actions.setMatches(demoMatches);
      showCallout(container, 'demo', `
        <div class="demo-banner" data-testid="demo-banner">
          <span>✦ Illustrative peers — real matches appear as others join</span>
          <button class="btn-link" data-dismiss-callout>Dismiss</button>
        </div>
      `);
    }
  }, 15_000);
}

return [
  () => { clearTimeout(_demoTimer); _demoTimer = null; },
  ...existingCleanup,
];
```

---

### G3 — Embedding fallback: graceful degradation on load failure ☐

**Where:** `app.js` → `start()` → `networkService.initialize()` catch

`utils/embeddingFallback.ts` exists but is never called. When the model fails
to load, wire the degraded state:

```js
await networkService.initialize().catch((err) => {
  if (err.message?.includes('model') || err.message?.includes('embedding')) {
    logger.warn('Embedding model unavailable — word-hash fallback', err.message);
    toasts.warning('AI model unavailable. Using basic matching mode.');
    actions.setStatus('degraded');
  } else {
    throw err;
  }
});
```

Add `'degraded'` to `STATE_MAP` in `components/sidebar.js`:
```js
degraded: { class: 'degraded', label: 'Limited mode' },
```

```css
.status-degraded { color: var(--c-warning); }
```

---

## Phase H — Peer Profile View

### H1 — Peer profile modal from Discover card ☐

**Where:** `screens/discover.js` → `renderMatchCard()` + new `components/peerProfile.js`

Add a Profile button to each match card:
```js
// In renderMatchCard(), inside .match-actions:
<button class="btn btn-ghost btn-sm" data-profile-btn
        data-peer-id="${escapeHtml(id)}"
        data-testid="profile-btn-${escapeHtml(id)}"
        aria-label="View ${escapeHtml(name)}'s profile">Profile</button>
```

In `bind()`:
```js
const profileBtn = e.target.closest('[data-profile-btn]');
if (profileBtn) {
  import('../components/peerProfile.js')
    .then(m => m.showPeerProfileModal(profileBtn.dataset.peerId));
  return;
}
```

**New file `components/peerProfile.js`:**
```js
import { modals } from './modal.js';
import { getState } from '../../state.js';
import { escapeHtml } from '../utils/dom.js';

export function showPeerProfileModal(peerId) {
  const { matches } = getState();
  const match   = matches.find(m => (m.peer?.id ?? m.peerId) === peerId);
  const name    = match?.identity?.name ?? match?.peer?.name ?? 'Anonymous';
  const bio     = match?.identity?.bio  ?? match?.peer?.description ?? '';
  const channels = match?.peer?.channels ?? match?.channels ?? [];
  const sim     = match?.similarity != null ? `${Math.round(match.similarity * 100)}%` : null;

  const html = `
    <div class="modal-header">
      <h2 class="modal-title">${escapeHtml(name)}</h2>
      <button class="modal-close" aria-label="Close">×</button>
    </div>
    <div class="modal-body peer-profile-body">
      ${sim ? `<div class="peer-sim-badge">${sim} semantic match</div>` : ''}
      ${bio ? `<p class="peer-bio">${escapeHtml(bio)}</p>` : ''}
      ${channels.length ? `
        <div class="peer-channels-label">Active in</div>
        <div class="peer-channel-chips">
          ${channels.map(ch =>
            `<span class="channel-chip"># ${escapeHtml(ch.name ?? ch)}</span>`
          ).join('')}
        </div>
      ` : ''}
      <div class="peer-id-row">
        <span class="peer-id-label">Peer ID</span>
        <code class="peer-id font-mono">${escapeHtml(peerId)}</code>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-action="close">Close</button>
      <button class="btn btn-primary" id="profile-chat-btn">Chat</button>
    </div>
  `;

  const overlay = modals.open(html);
  overlay.querySelector('[data-action="close"], .modal-close')
    ?.addEventListener('click', () => modals.close());
  overlay.querySelector('#profile-chat-btn')?.addEventListener('click', () => {
    modals.close();
    window.location.hash = '#/chats';
    requestAnimationFrame(() => requestAnimationFrame(() =>
      document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }))
    ));
  });
}
```

```css
.peer-profile-body  { display: flex; flex-direction: column; gap: 12px; }
.peer-sim-badge     {
  display: inline-flex; align-items: center;
  background: var(--c-bg-active); color: var(--c-brand);
  font-size: 13px; font-weight: 500; padding: 3px 10px;
  border-radius: var(--r-full); width: fit-content;
}
.peer-bio           { font-size: 14px; color: var(--c-text-dim); line-height: 1.5; }
.peer-channels-label { font-size: 11px; color: var(--c-text-muted);
                        text-transform: uppercase; letter-spacing: 0.5px; }
.peer-channel-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.channel-chip       {
  font-size: 12px; padding: 2px 8px;
  background: var(--c-bg-card); border-radius: var(--r-sm);
  color: var(--c-text-dim); font-family: var(--font-mono);
}
.peer-id-row        { display: flex; align-items: baseline; gap: 8px; }
.peer-id-label      { font-size: 11px; color: var(--c-text-muted); white-space: nowrap; }
.peer-id            { font-size: 11px; word-break: break-all; color: var(--c-text-dim); }
```

---

## Phase I — Progressive Disclosure of Advanced Features

Advanced services (`chaosMode.ts`, `thoughtBridging.ts`, `fileTransferService.ts`,
`inviteLinks.ts`) must not appear in the primary UI. They live behind a single
collapsed Settings section and a low-prominence chat "more" menu.

### I1 — Settings: "Advanced" section (collapsed `<details>`) ☐

**Where:** `screens/settings.js` → `render()`

Add `${renderAdvanced(settings)}` between `${renderChannels()}` and
`${renderDangerZone()}`.

```js
function renderAdvanced(settings) {
  return `
    <details class="settings-section settings-advanced-details"
             data-testid="settings-advanced">
      <summary class="settings-advanced-summary">Advanced</summary>
      <div class="settings-advanced-body">

        <section class="settings-subsection" data-testid="serendipity-section">
          <div class="section-title">Serendipity</div>
          <div class="section-description">
            Occasionally surface semantically distant peers to expand your horizons.
          </div>
          <div class="toggle-row">
            <div>
              <div class="toggle-label-text">Serendipity mode</div>
              <div class="toggle-hint">Adds a random element to discovery.</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="chaos-mode-toggle"
                     ${settings.chaosMode ? 'checked' : ''}
                     data-testid="chaos-mode-toggle" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>

        <section class="settings-subsection" data-testid="thought-bridge-section">
          <div class="section-title">Thought Bridge</div>
          <div class="section-description">
            Maps concepts across vocabularies to find peers thinking similarly
            but using different words. Experimental.
          </div>
          <div class="toggle-row">
            <div>
              <div class="toggle-label-text">Enable Thought Bridge</div>
              <div class="toggle-hint">May increase match diversity.</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="thought-bridge-toggle"
                     ${settings.thoughtBridgeEnabled ? 'checked' : ''}
                     data-testid="thought-bridge-toggle" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>

        <section class="settings-subsection" data-testid="thought-twin-section">
          <div class="section-title">Thought Twin</div>
          <div class="section-description">
            Notifies you when a peer's thinking closely mirrors yours over time.
          </div>
          <div class="toggle-row">
            <div>
              <div class="toggle-label-text">Thought Twin notifications</div>
              <div class="toggle-hint">Shows a banner in your feed when a twin is found.</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="thought-twin-toggle"
                     ${settings.thoughtTwinEnabled !== false ? 'checked' : ''}
                     data-testid="thought-twin-toggle" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </section>

      </div>
    </details>
  `;
}
```

**In `bind()`:**
```js
container.querySelector('#chaos-mode-toggle')?.addEventListener('change', e => {
  settingsService.set({ chaosMode: e.target.checked });
  import('../../services/chaosMode.ts')
    .then(m => e.target.checked ? m.enableChaosMode?.() : m.disableChaosMode?.());
});
container.querySelector('#thought-bridge-toggle')?.addEventListener('change', e => {
  settingsService.set({ thoughtBridgeEnabled: e.target.checked });
  showInlineSaved(e.target.closest('.toggle-row'));
});
container.querySelector('#thought-twin-toggle')?.addEventListener('change', e => {
  settingsService.set({ thoughtTwinEnabled: e.target.checked });
  showInlineSaved(e.target.closest('.toggle-row'));
});
```

**Defaults in `settingsService`:**
```js
chaosMode: false,
thoughtBridgeEnabled: false,
thoughtTwinEnabled: true,
```

**CSS:**
```css
.settings-advanced-details { margin-top: 8px; }
.settings-advanced-summary {
  cursor: pointer; font-size: 13px; color: var(--c-text-muted);
  padding: 10px 0; user-select: none; list-style: none;
}
.settings-advanced-summary::-webkit-details-marker { display: none; }
.settings-advanced-summary::before { content: '▸  '; }
details[open].settings-advanced-details .settings-advanced-summary::before { content: '▾  '; }
.settings-advanced-summary:hover { color: var(--c-text); }
.settings-advanced-body { padding-top: 4px; display: flex; flex-direction: column; }
.settings-subsection {
  padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.05);
}
.settings-subsection .section-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.settings-subsection .section-description {
  font-size: 12px; color: var(--c-text-muted); margin-bottom: 10px;
}
```

---

### I2 — ThoughtTwin banner: respect preference ☐

**Where:** `screens/now.js` → `bind()` → ThoughtTwin notification check

```js
const { thoughtTwinEnabled } = settingsService.get();
if (thoughtTwinEnabled !== false) {
  shouldShowThoughtTwinNotification().then(notification => {
    if (!notification) return;
    // ...existing banner render — unchanged
  });
}
```

---

### I3 — File transfer: "More" menu in chat header ☐

**Where:** `screens/chats.js` → `renderChatHeader()`

Add a `⋯` button to the header actions:
```js
<button class="btn btn-icon" data-more-menu
        aria-label="More options" data-testid="chat-more-btn">⋯</button>
```

In `bind()`:
```js
container.addEventListener('click', async e => {
  // Toggle more menu
  const moreBtn = e.target.closest('[data-more-menu]');
  if (moreBtn) {
    let menu = container.querySelector('.chat-more-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'chat-more-menu';
      menu.innerHTML = `
        <button class="more-menu-item" data-menu-action="send-file">Send file</button>
        <button class="more-menu-item" data-menu-action="copy-peer-id">Copy peer ID</button>
        <button class="more-menu-item danger" data-menu-action="block">Block</button>
      `;
      moreBtn.closest('.chat-header')?.appendChild(menu);
    }
    menu.classList.toggle('hidden');
    return;
  }

  const menuItem = e.target.closest('[data-menu-action]');
  if (menuItem) {
    container.querySelector('.chat-more-menu')?.classList.add('hidden');
    const action = menuItem.dataset.menuAction;
    const peerId = container.querySelector('[data-testid="chat-view"]')?.dataset.peerId;

    if (action === 'send-file' && peerId) {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const { sendFile } = await import('../../services/fileTransferService.ts');
        toasts.info(`Sending ${escapeHtml(file.name)}…`);
        await sendFile(peerId, file).catch(err => toasts.error(err.message));
      };
      input.click();
    }

    if (action === 'copy-peer-id' && peerId) {
      navigator.clipboard.writeText(peerId)
        .then(() => toasts.success('Peer ID copied'));
    }

    if (action === 'block' && peerId) {
      const ok = await modals.confirm(
        'Block this peer? You will no longer see their posts or messages.',
        { title: 'Block Peer', confirmText: 'Block', danger: true }
      );
      if (ok) {
        moderationService.blockPeer(peerId);
        doClose(container);
      }
    }
  }

  // Close menu on outside click
  if (!e.target.closest('.chat-more-menu') && !e.target.closest('[data-more-menu]')) {
    container.querySelector('.chat-more-menu')?.classList.add('hidden');
  }
});
```

```css
.chat-more-menu {
  position: absolute; top: calc(100% + 4px); right: 8px;
  background: var(--c-bg-card); border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--r-md); padding: 4px 0; z-index: 200;
  min-width: 160px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.chat-more-menu.hidden { display: none; }
.more-menu-item {
  display: block; width: 100%; text-align: left; padding: 8px 14px;
  font-size: 13px; background: none; border: none; cursor: pointer;
  color: var(--c-text-dim);
}
.more-menu-item:hover { background: var(--c-bg-hover); color: var(--c-text); }
.more-menu-item.danger { color: var(--c-danger); }
```

---

### I4 — Invite links: Settings → "Share" section ☐

**Where:** `screens/settings.js`

Add `${renderShare()}` between `${renderChannels()}` and `${renderAdvanced()}`.

```js
function renderShare() {
  return `
    <section class="settings-section" data-testid="share-section">
      <div class="section-title">Share</div>
      <div class="section-description">
        Invite someone directly — they'll connect to your active channel.
      </div>
      <div class="form-group">
        <button class="btn btn-secondary" id="generate-invite-btn"
                data-testid="generate-invite-btn">Generate invite link</button>
        <div id="invite-link-output" class="invite-link-output hidden"
             data-testid="invite-link-output"></div>
      </div>
    </section>
  `;
}
```

In `bind()`:
```js
container.querySelector('#generate-invite-btn')?.addEventListener('click', async () => {
  const { channels, activeChannelId } = getState();
  const channelId = activeChannelId ?? channels[0]?.id;
  if (!channelId) { toasts.warning('Create a channel first'); return; }

  const { generateInviteLink } = await import('../../services/inviteLinks.ts');
  const link = await generateInviteLink(channelId).catch(err => {
    toasts.error(err.message); return null;
  });
  if (!link) return;

  const output = container.querySelector('#invite-link-output');
  if (output) {
    output.classList.remove('hidden');
    output.innerHTML = `
      <code class="invite-link-code">${escapeHtml(link)}</code>
      <button class="btn btn-ghost btn-sm" id="copy-invite-btn">Copy</button>
    `;
    output.querySelector('#copy-invite-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(link).then(() => toasts.success('Link copied'));
    });
  }
});
```

```css
.invite-link-output {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
}
.invite-link-code {
  font-size: 11px; word-break: break-all; flex: 1;
  color: var(--c-text-dim); background: var(--c-bg-card);
  padding: 6px 8px; border-radius: var(--r-sm);
}
.invite-link-output.hidden { display: none; }
```

---

## Phase J — Moderation Basics

### J1 — Block list: persist, filter, unblock ☐

**Where:** `services/index.js` (new `moderationService`)

```js
export const moderationService = {
  getBlockedPeers() {
    try { return new Set(JSON.parse(localStorage.getItem('isc:blocked-peers') || '[]')); }
    catch { return new Set(); }
  },
  blockPeer(peerId) {
    const blocked = this.getBlockedPeers();
    blocked.add(peerId);
    localStorage.setItem('isc:blocked-peers', JSON.stringify([...blocked]));
    actions.setMatches(
      (getState().matches ?? [])
        .filter(m => (m.peer?.id ?? m.peerId) !== peerId)
    );
  },
  unblockPeer(peerId) {
    const blocked = this.getBlockedPeers();
    blocked.delete(peerId);
    localStorage.setItem('isc:blocked-peers', JSON.stringify([...blocked]));
  },
  isBlocked(peerId) { return this.getBlockedPeers().has(peerId); },
};
```

**Filter blocked peers in `screens/discover.js`:**
```js
import { moderationService } from '../../services/index.js';
// Before rendering matches:
const visibleMatches = discoveryService.getMatches()
  .filter(m => !moderationService.isBlocked(m.peer?.id ?? m.peerId));
```

**In `screens/settings.js` → `renderDangerZone()`:** Add a blocked-peers list
with unblock buttons (only shown if any are blocked). Bind unblock in `bind()`.

---

## Phase K — Background Sync & Offline Resilience

### K1 — Wire `backgroundSync.ts` on reconnect ☐

**Where:** `services/network.ts` → `onStatusChange` callback

```ts
onStatusChange: (status) => {
  actions.setStatus(status);
  if (status === 'connected') {
    import('../backgroundSync').then(m => m.syncPendingPosts?.());
  }
},
```

**`backgroundSync.ts` → `syncPendingPosts()`:**
```ts
export async function syncPendingPosts() {
  const posts = (getState().posts ?? []).filter(p => (p as any)._pending);
  for (const post of posts) {
    try {
      await networkService.createPost(post.channelId, post.content);
      const updated = (getState().posts ?? []).map(p =>
        p.id === post.id ? { ...p, _pending: false } : p
      );
      actions.setPosts(updated);
    } catch {
      logger.warn('Background sync: could not broadcast pending post', { id: post.id });
    }
  }
}
```

---

### K2 — Post creation: optimistic local add + pending flag ☐

**Where:** `services/index.js` → `postService.create()`

```js
async create(channelId, content) {
  const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempPost = {
    id: tempId, channelId, content,
    createdAt: Date.now(), timestamp: Date.now(),
    identity: networkService.getIdentity(),
    _pending: true,
  };
  actions.setPosts([tempPost, ...(getState().posts ?? [])]);

  try {
    const post = await networkService.createPost(channelId, content);
    const updated = (getState().posts ?? []).map(p =>
      p.id === tempId ? { ...post, _pending: false } : p
    );
    actions.setPosts(updated);
    return post;
  } catch (err) {
    logger.warn('Post not broadcast (offline) — stored locally', err.message);
    return tempPost;
  }
},
```

---

## Phase L — Accessibility

### L1 — ARIA live region for status announcements ☐

**Where:** `layout.js`

```js
const liveRegion = document.createElement('div');
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.setAttribute('aria-atomic', 'true');
liveRegion.className = 'sr-only';
liveRegion.id = 'isc-live-region';
document.body.appendChild(liveRegion);
```

Export `announce(msg)`:
```js
export function announce(msg) {
  const el = document.getElementById('isc-live-region');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = msg; });
}
```

Use in `app.js` on status transitions:
```js
let _prevStatus = null;
subscribe(state => {
  if (state.status !== _prevStatus) {
    _prevStatus = state.status;
    announce(state.status === 'connected' ? 'Connected to network' : `Network: ${state.status}`);
  }
});
```

```css
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
```

---

### L2 — Focus management on screen transition ☐

**Where:** `router.js` → `renderRoute()`

After each screen bind, move focus to the designated target:
```js
requestAnimationFrame(() => {
  const focusTarget =
    mainContent.querySelector('[data-autofocus]') ??
    mainContent.querySelector('h1') ??
    mainContent.querySelector('[tabindex="0"]');
  focusTarget?.focus({ preventScroll: true });
});
```

Add `data-autofocus` to: compose name input, chats compose input (when open),
discover search button.

---

### L3 — Feed keyboard navigation (j/k and arrow keys) ☐

**Where:** `screens/now.js` → `bind()`

Make post cards focusable:
```js
// In renderPostCard(), outer div:
tabindex="0" role="article"
aria-label="${escapeHtml(author)}: ${escapeHtml((content).slice(0,80))}"
```

Navigation:
```js
container.addEventListener('keydown', e => {
  if (e.target.closest('.compose-area')) return;
  const posts = [...container.querySelectorAll('.post-card')];
  const current = document.activeElement?.closest('.post-card');
  const idx = current ? posts.indexOf(current) : -1;
  if (e.key === 'ArrowDown' || e.key === 'j') {
    e.preventDefault();
    posts[Math.min(idx + 1, posts.length - 1)]?.focus();
  }
  if (e.key === 'ArrowUp' || e.key === 'k') {
    e.preventDefault();
    posts[Math.max(idx - 1, 0)]?.focus();
  }
});
```

---

### L4 — Global focus ring for keyboard users ☐

**Where:** `styles/irc.css`

```css
:focus-visible {
  outline: 2px solid var(--c-brand);
  outline-offset: 2px;
}
:focus:not(:focus-visible) {
  outline: none;
}
```

Audit for any `outline: none` / `outline: 0` rules that don't pair with a
`:focus-visible` alternative and fix them.

---

## Phase M — Performance

### M1 — Lazy-render off-screen posts ☐

**Where:** `screens/now.js` → `bind()`

After initial render (Phase E4 pagination), use IntersectionObserver to swap
placeholders for full cards as they scroll into view:

```js
// In renderPostsContent(), for posts beyond index 20:
posts.map((post, i) =>
  i < 20
    ? renderPostCard(post, channels)
    : `<div class="post-placeholder" data-post-index="${i}"
            style="height:110px;contain:strict"></div>`
).join('')
```

After bind:
```js
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const ph = entry.target;
    const idx = parseInt(ph.dataset.postIndex ?? '-1', 10);
    const post = feedService.getForYou(_postsPage * PAGE_SIZE)[idx];
    if (!post) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = renderPostCard(post, getState().channels);
    ph.replaceWith(tmp.firstElementChild);
    observer.unobserve(ph);
  });
}, { rootMargin: '300px' });

container.querySelectorAll('.post-placeholder').forEach(el => observer.observe(el));
return [() => observer.disconnect(), ...existingCleanup];
```

---

### M2 — Service worker: offline app shell ☐

**File:** `apps/browser/public/sw.js` (create)

```js
const SHELL_CACHE = 'isc-shell-v1';
const SHELL_FILES = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
  }
  // Do NOT cache the embedding model — transformers.js manages its own cache
});
```

Register in `apps/browser/src/vanilla/index.js`:
```js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .catch(err => console.warn('[SW] Registration failed:', err));
}
```

---

## Phase N — E2E Test Updates

Plan3 restructured HTML across all screens. Playwright tests use `data-testid`
selectors that now target old structure.

### N1 — Navigation helper: adaptive desktop/mobile ☐

**File:** `tests/e2e/helpers/nav.ts` (create)

```ts
import { Page } from '@playwright/test';

export async function navigateTo(
  page: Page,
  route: 'now' | 'discover' | 'chats' | 'settings'
) {
  const isMobile = (page.viewportSize()?.width ?? 1280) < 640;
  await page.click(isMobile
    ? `[data-testid="nav-tab-${route}"]`
    : `[data-testid="snav-${route}"]`
  );
}
```

Replace all hardcoded nav-tab selectors in tests with `navigateTo()`.

---

### N2 — Selector audit: map old → new ☐

| Old selector | New selector |
|---|---|
| `[data-testid="nav-tab-now"]` | `[data-testid="snav-now"]` (desktop) |
| `[data-testid="nav-tab-discover"]` | `[data-testid="snav-discover"]` (desktop) |
| `[data-testid="nav-tab-chats"]` | `[data-testid="snav-chats"]` (desktop) |
| `[data-testid="nav-tab-settings"]` | `[data-testid="snav-settings"]` (desktop) |
| `[data-testid="status-bar"]` | `[data-testid="sidebar-status"]` |
| `[data-testid="channel-list"]` | `[data-testid="sidebar-channel-list"]` |
| `#logout-btn` | `[data-testid="reset-identity-btn"]` |

---

### N3 — Add missing test coverage ☐

1. **`channel-lifecycle.spec.ts`** — create → sidebar → edit → delete
2. **`post-flow.spec.ts`** — post → like → reply thread renders → delete own only
3. **`discover-flow.spec.ts`** — auto-discovery → match card → profile modal → Chat navigates
4. **`chat-persistence.spec.ts`** — send message → reload → still present
5. **`settings-advanced.spec.ts`** — Advanced collapsed → expand → toggle chaos → persists

---

## Phase O — TUI Application

### O1 — Extract shared service layer to `packages/services/` ☐

`apps/browser/src/services/index.js` uses `window`, `document`, `localStorage`
directly. Extract pure business logic into a shared package both the browser app
and TUI can import.

**New workspace:** `packages/services/`

```
packages/services/src/
  types.ts              ← Channel, Post, Match, ChatMessage
  channelService.ts
  postService.ts
  feedService.ts
  discoveryService.ts
  chatService.ts
  settingsService.ts    ← uses injected StorageAdapter
  moderationService.ts
  index.ts
```

The `StorageAdapter` interface replaces direct `localStorage` calls:
```ts
interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}
```

Browser app injects `localStorage`. TUI injects a file-based adapter. This
is a prerequisite for O2 and O3.

---

### O2 — TUI: 3-pane layout wired to live state ☐

**Where:** `apps/tui/src/`

```
┌──────────────┬──────────────────────┬──────────────┐
│ MY CHANNELS  │   Now / Feed         │   PEERS      │
│ # rust-wasm  │ > @alice: hello      │ alice  92%   │
│ # urban-ag ← │ > @you: hey!         │ bob    78%   │
│              │ [compose]_           │ carol  65%   │
│ ─────────── │                      │ ─────────── │
│ ● 3 peers    │ /now /disco /chats   │ /discover    │
└──────────────┴──────────────────────┴──────────────┘
```

Key interactions: `Tab` cycles panes · `↑↓` navigates within pane ·
`Enter` activates · `/now` `/disco` `/chats` `/settings` switch content ·
`Ctrl+C` / `:q` quit.

---

### O3 — TUI: core command set ☐

| Command | Description |
|---|---|
| `/new <name> <description>` | Create a channel |
| `/switch <name>` | Switch active channel |
| `/post <text>` | Post to active channel |
| `/reply <postId> <text>` | Reply to a post |
| `/discover` | Trigger peer discovery |
| `/chat <peerId>` | Open DM with peer |
| `/send <text>` | Send message in active chat |
| `/status` | Network status + peer count |
| `/block <peerId>` | Block a peer |
| `/help` | Show command list |
| `:q` or `Ctrl+C` | Quit |

---

## Sequence & PR Grouping

```
Phase A (P0 bugs, plan3 leftovers) → first PR, no dependencies
Phase B (settings completion)      → standalone, no dependencies
Phase C (lifecycle cleanup)        → depends on A+B
Phase D (CSS/copy cleanup)         → standalone, any time
Phase E (feed completeness)        → no hard dependencies
Phase F (WebRTC delivery)          → P0 for chat
Phase G (cold start/demo)          → standalone
Phase H (peer profiles)            → depends on E (match data shape)
Phase I (progressive disclosure)   → depends on B (settings structure)
Phase J (moderation)               → depends on I (block entry point)
Phase K (background sync)          → depends on F (network connectivity)
Phase L (accessibility)            → standalone
Phase M (performance)              → depends on E (pagination first)
Phase N (E2E tests)                → after each phase lands
Phase O (TUI)                      → parallel track; O1 (extraction) must land first
```

**Recommended PR sequence:**

| PR | Phases | Notes |
|---|---|---|
| PR-1 | A | Remaining P0 bugs: duplicate send, renderError onclick, #/space link, mobile CSS |
| PR-2 | B | Settings completion: Remove Save Preferences button, showEditModal export+fix, Nostr bridge resolve-or-remove, ephemeral toggle, confirm copy |
| PR-3 | C | Screen lifecycle: createScreen migration, delete status-bar.js, sidebar keyboard nav |
| PR-4 | D | CSS/copy: inline styles, emoji policy in tiers+settings, copy strings |
| PR-5 | E | Feed: reply threads, reply compose, live refresh, pagination, like persistence |
| PR-6 | F | WebRTC: outgoing/incoming message delivery, new-msg toast, unread badge fix, typing indicator |
| PR-7 | G | Cold start: splash progress, demo mode, degraded fallback |
| PR-8 | H | Peer profile modal |
| PR-9 | I+J | Progressive disclosure (Advanced settings + file transfer more-menu + invite links) + moderation block list |
| PR-10 | K | Background sync + optimistic post creation |
| PR-11 | L | Accessibility: live region, focus management, keyboard nav, focus rings |
| PR-12 | M | Performance: lazy render, service worker |
| PR-13 | N | E2E: nav helper, selector audit, new coverage |
| PR-14+ | O | TUI: service extraction (O1 first), then layout + commands |

---

## Non-Goals

- CLI implementation (TUI covers the terminal use case)
- AT Protocol / Bluesky bridge (Phase 4 in ROADMAP)
- Native mobile apps
- Full reputation / staking system (Phase 2 in ROADMAP)
- Changing the network, embedding, or crypto layers
- Switching away from vanilla JS for the web UI
- Post/peer search (post-Phase 3)
