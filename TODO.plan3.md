# TODO.plan3.md — ISC Vanilla UI Overhaul (Revised)

**Scope:** Complete overhaul of `apps/browser/src/vanilla/` addressing every
bug, UX problem, and architectural weakness identified in the March 2026 analysis.
Guiding aesthetic: IRC client (mIRC/HexChat) — channel list owns the left panel,
compact navigation lives at the top of that panel, every screen has one job.

**Status tracking:** ☐ todo · ⏳ in progress · ✅ done

**File tree for quick reference:**
```
apps/browser/src/vanilla/
  app.js                        ← bootstrap, lifecycle, onboarding
  index.js                      ← entry point
  layout.js                     ← DOM skeleton, tab bar, debug panel
  router.js                     ← hash routing, keyboard shortcuts, event hub
  components/
    modal.js                    ← modal system (open, close, confirm, showHelp)
    mixerPanel.js               ← channel control surface (Now screen)
    sidebar.js                  ← sidebar nav + channel list
    splash.js                   ← loading screen
    status-bar.js               ← bottom status strip (to be replaced)
  screens/
    now.js                      ← home feed + compose
    discover.js                 ← peer discovery
    chats.js                    ← DM conversations
    settings.js                 ← identity, prefs, danger zone
    compose.js                  ← new/edit channel form
    space.js                    ← 2D semantic canvas (to be dissolved)
    video.js                    ← video calls (to be dissolved)
  styles/
    irc.css                     ← all vanilla UI styles
  utils/
    component.js                ← Button, Card, Modal, etc. factory components
    dom.js                      ← el(), escapeHtml(), delegate(), isMobile()
    screen.js                   ← createScreen(), renderEmpty(), renderLoading()
    validation.js               ← required(), length(), range(), validateForm()

apps/browser/src/
  services/index.js             ← channelService, postService, feedService,
                                   discoveryService, chatService, settingsService
  services/network.ts           ← networkService wrapper
  services/channelSettings.js   ← per-channel UI settings (viewMode, specificity…)
  state.js                      ← subscribe(), getState(), actions.*
  utils/toast.js                ← toasts.info/success/warning/error
```

---

## Phase A — P0 Bugs (silent failures and data loss)

Ship these as a single PR before anything else. Each is a regression that affects
all users today.

---

### A1 — `globalThis.ISC_SERVICES` never assigned → delete/reply silently fail ☐

**Where it breaks:**
- `screens/now.js` → `handleDelete()` (line ~356): reads
  `globalThis.ISC_SERVICES?.modals` and `globalThis.ISC_SERVICES?.postService`
- `router.js` → `setupEventHandlers()`: reads
  `globalThis.ISC_SERVICES?.postService`, `.networkService`, `.modals`

`ISC_SERVICES` is never assigned anywhere. Delete and Reply fail with no error.

**Fix — `screens/now.js`:**
Add direct imports at the top of the file:
```js
import { postService } from '../../services/index.js';
import { modals } from '../components/modal.js';
```
Rewrite `handleDelete()` to use imported `postService` and `modals` directly.
Rewrite `handleReply()` to dispatch `isc:reply-post` (already done) — but the
router's handler also needs fixing.

**Fix — `router.js` → `setupEventHandlers({ onNavigate, mainContent })`:**
Add a `services` parameter:
```js
export function setupEventHandlers({ onNavigate, mainContent, services }) {
  const { postService, networkService, modals } = services;
  // ... rest unchanged
}
```
In `app.js` → `initLayout()`, pass services explicitly:
```js
import { postService } from '../services/index.js';
// networkService and modals already imported
setupEventHandlers({
  onNavigate: navigate,
  mainContent: layout.main,
  services: { postService, networkService, modals },
});
```
Remove all `globalThis.ISC_SERVICES` references (none should remain).

---

### A2 — `modal.confirm()` does not close after user clicks Confirm ☐

**Where:** `components/modal.js` → `confirm()` method, line ~109–117.

The `[data-action]` click handler calls `settle()` (resolves the promise) but
never calls `this.close()`. The modal overlay stays on screen after confirmation.

```js
// Current (broken):
const btn = e.target.closest('[data-action]');
if (btn) settle(btn.dataset.action === 'confirm');

// Fix:
const btn = e.target.closest('[data-action]');
if (btn) {
  settle(btn.dataset.action === 'confirm');
  this.close();
}
```

---

### A3 — Context tags silently dropped on channel creation ☐

**Where:** `screens/compose.js` → `bind()` → save handler (~line 186–216).

`selectedTags` is collected but `channelService.create(name, desc, spread)` is
called without it.

**Fix — two parts:**

**Part 1: `services/index.js` → `channelService.create()`:**
```js
// Current:
async create(name, description, spread = 0.15) {
  const channel = await networkService.createChannel(name, description);

// Fix — pass spread and context through:
async create(name, description, spread = 0.15, context = []) {
  const channel = await networkService.createChannel(name, description, {
    spread,
    context,
  });
```
(If `networkService.createChannel` doesn't accept options yet, add the parameter
and store context on the channel record via the DB layer — even if the embedding
pipeline ignores it for now, it should be persisted.)

**Part 2: `screens/compose.js` → save handler:**
```js
await channelService.create(name, desc, spread, selectedTags);
```

---

### A4 — `channelService.create()` ignores the `spread` parameter ☐

**Where:** `services/index.js` → `channelService.create()`.

`spread` is accepted as the 3rd argument but the call to
`networkService.createChannel(name, description)` omits it entirely. Covered
jointly with A3 in the fix above — pass `{ spread, context }` as options.

---

### A5 — `channelService.update()` is missing but called by `mixerPanel.js` ☐

**Where:** `components/mixerPanel.js` → `showEditModal()` → `saveChanges()` (~line
443): calls `channelService.update(channel.id, { name, description })`.
`channelService` in `services/index.js` has no `update()` method. This throws a
TypeError and the edit modal save silently fails.

**Fix — add to `services/index.js` → `channelService`:**
```js
async update(channelId, { name, description }) {
  try {
    await networkService.service?.updateChannel?.(channelId, { name, description });
    // Refresh local state
    actions.setChannels(networkService.getChannels());
    logger.info('Channel updated', { channelId, name });
  } catch (err) {
    logger.error('Channel update failed', { error: err.message });
    throw err;
  }
},
```

---

### A6 — Duplicate send handler accumulates on every conversation open ☐

**Where:** `screens/chats.js`.

`bindChatInputHandlers(container)` is called in `bind()` (line ~412) and again
inside `openChat()` (line ~442). After opening N conversations, Enter sends N
messages.

**Fix:** Remove the `bindChatInputHandlers(container)` call from `openChat()`.
The existing handlers read `peerId` at call-time from the DOM
(`container.querySelector('[data-testid="chat-view"]')?.dataset.peerId`), so they
work correctly for whichever conversation is currently rendered — no rebinding
needed.

```js
// In openChat():
chatPanel.innerHTML = renderChatView(peerId, conversations);
// DELETE: bindChatInputHandlers(container);  ← remove this line

// Bind only the new dismiss button for bridge suggestion:
const dismissBtn = container.querySelector('#bridge-dismiss');
dismissBtn?.addEventListener('click', () => { /* ... */ });
```

---

### A7 — `mixerPanel.js` uses native `window.confirm()` ☐

**Where:** `components/mixerPanel.js` → `archiveChannel()` (~line 357) and
`resetSettings()` (~line 365). Both call the synchronous `confirm()` builtin,
which blocks the JS thread and is visually inconsistent with the rest of the app.

**Fix:** Replace with `modals.confirm()`:
```js
import { modals } from './modal.js';

async function archiveChannel() {
  const ok = await modals.confirm('Archive this channel?', {
    title: 'Archive Channel',
    confirmText: 'Archive',
  });
  if (!ok) return;
  channelSettingsService.archiveChannel(activeChannel.id);
  // ...
}

async function resetSettings() {
  const ok = await modals.confirm('Reset all settings to defaults?', {
    title: 'Reset Settings',
    confirmText: 'Reset',
    danger: true,
  });
  if (!ok) return;
  // ...
}
```

---

### A8 — `renderEmpty()` `onclick` handler is non-functional ☐

**Where:** `utils/screen.js` → `renderEmpty()` (~line 140):
```js
`<button class="btn btn-${variant}" onclick="${onClick}">${escapeHtml(label)}</button>`
```
When `onClick` is a function, `Function.toString()` produces the source text as
the `onclick` attribute. The closure is lost — this never works.

**Fix:** Use `data-action` attributes and bind in the caller, or — since
`renderEmpty()` is used in contexts where `href` is always provided and `onClick`
is never actually passed — remove the `onClick` branch and require `href`:
```js
// In renderEmpty, actions only accept href (never onclick):
${href
  ? `<a href="${escapeHtml(href)}" class="btn btn-${variant}">${escapeHtml(label)}</a>`
  : `<button class="btn btn-${variant}" data-action="${escapeHtml(action ?? '')}">${escapeHtml(label)}</button>`
}
```
Audit all callers: in `screens/discover.js` the action button uses
`action: 'discover'` — bind a click handler in `bind()` via
`container.querySelector('[data-action="discover"]')?.addEventListener(...)`.

---

## Phase B — Screen Lifecycle Architecture

### B1 — Migrate all screens to `createScreen()` factory ☐

**Why:** `utils/screen.js` already exports a `createScreen({ render, bind, update, destroy })` factory that manages unbind functions automatically. No screen uses it. The router calls `currentScreen.destroy()` but no screen exports `destroy` — so cleanup never runs.

**How `createScreen` works (existing code, `utils/screen.js` ~line 28):**
```js
export function createScreen({ render: renderFn, bind, update, destroy }) {
  let unbindFns = [];
  return {
    render: renderFn,
    bind(container) { unbindFns = bind?.(container) ?? []; },
    update(container, ...args) { /* re-renders or delegates */ },
    destroy() {
      unbindFns.forEach(fn => fn?.());
      destroy?.();
      unbindFns = [];
    },
  };
}
```

**Migration for each screen:**
1. Each screen's `bind()` already returns an array of cleanup functions in
   `now.js` (returns `[unbindLike, unbindReply, unbindDelete, viewChangeCleanup]`).
   The other screens need to be updated to return their cleanup arrays too.
2. Wrap each screen's exports with `createScreen()`:

```js
// Before (e.g., discover.js):
export function render() { /* ... */ }
export function bind(container) { /* ... */ }  // returns nothing
export function update(container) { /* ... */ }

// After:
export default createScreen({
  render,
  bind,   // must return [] of cleanup fns
  update,
});

// Also keep named exports for any direct callers:
export { render, bind, update };
```

3. Update `app.js` `SCREENS` map and router to accept the default export.

**Files:** All `screens/*.js`, `router.js`, `app.js`

---

### B2 — `bind()` cleanup arrays for all screens ☐

Each screen's `bind()` must return an array of zero-argument cleanup functions.
Checklist by screen:

**`now.js`** — already returns cleanup array. Add cleanup for the
`isc:refresh-feed` listener added in `setupEventHandlers` (that's in router, not
here) and reset module state:
```js
export function destroy() {
  refreshing = false;
  viewModeUnsubscribe = null;
}
```

**`discover.js`** — `bind()` currently returns nothing. Add cleanup:
```js
export function bind(container) {
  // ... existing handlers ...
  return [
    () => { bridgeCandidates = []; convergenceEvent = null; noMatchesBannerEl = null; },
  ];
}
```

**`chats.js`** — `bind()` adds `storage` listener, `isc:start-chat` listener, and
`online`/`offline` listeners on `window` and `document`. All must be returned for
cleanup:
```js
export function bind(container) {
  // ...
  return [
    () => document.removeEventListener('isc:start-chat', onStartChat),
    () => window.removeEventListener('storage', onStorage),
    () => window.removeEventListener('storage', onStorageTyping),
    () => window.removeEventListener('online', onOnline),
    () => window.removeEventListener('offline', onOffline),
    () => { activePeerId = null; boundContainer = null; clearTimeout(typingTimeout); },
  ];
}
```

**`settings.js`** — has no document-level listeners; `bind()` can return `[]`.

**`compose.js`** — has no document-level listeners; `bind()` can return
`[() => clearInterval(embeddingPollInterval)]` (see I3).

---

### B3 — Default route: `/now` ☐

**File:** `app.js` line 38:
```js
const DEFAULT_ROUTE = '/now';  // was '/space'
```

---

### B4 — Remove `/space` and `/video` as top-level routes ☐

**File:** `app.js` → `SCREENS` map. Remove:
```js
'/space': SpaceScreen,
'/video': VideoScreen,
```
Remove their imports. The router's `parseRoute()` will fall through to
`defaultRoute` for any stale `#/space` or `#/video` links.

Add a dev-mode warning in `router.js` → `parseRoute()`:
```js
function parseRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && !screens[hash] && import.meta.env?.DEV) {
    console.warn(`[Router] Unknown route: ${hash}, falling back to ${defaultRoute}`);
  }
  return screens[hash] ? hash : defaultRoute;
}
```

---

## Phase C — Sidebar & Navigation Redesign

**Concept:** Replace the "ISC" brand label at the top of the sidebar with a
compact horizontal strip of four icon-buttons (Now · Discover · Chats · Settings).
The channel list fills the rest of the panel top-to-bottom. Connection status
moves to a footer strip at the very bottom of the sidebar. The result is a
recognizable IRC-client layout with no wasted chrome.

```
┌────────────────────┬──────────────────────────────────────┐
│ [⌂] [◎] [◷] [⚙]  │                                      │
│ ─────────────────  │          Main Content Area           │
│ MY CHANNELS     +  │                                      │
│ # rust-on-wasm     │    (Now / Discover / Chats /         │
│ # urban-farming  ← │     Settings screen renders here)    │
│ # post-agi         │                                      │
│ ─────────────────  │                                      │
│ ● Online · 4 peers │                                      │
└────────────────────┴──────────────────────────────────────┘
         220px                    flex: 1
```

### C1 — Redesign sidebar HTML structure ☐

**File:** `components/sidebar.js`

Replace `render()` function's `el.innerHTML` with:
```html
<aside class="irc-sidebar" data-testid="sidebar">

  <!-- Navigation strip (replaces .irc-brand) -->
  <div class="sidebar-nav-strip" role="toolbar" aria-label="Main navigation"
       data-testid="sidebar-nav-strip">
    <button class="snav-btn" data-route="/now"
            title="Now — your feed (Home)"
            aria-label="Now" data-testid="snav-now">⌂</button>
    <button class="snav-btn" data-route="/discover"
            title="Discover peers"
            aria-label="Discover" data-testid="snav-discover">◎</button>
    <button class="snav-btn" data-route="/chats"
            title="Chats"
            aria-label="Chats" data-testid="snav-chats">◷</button>
    <button class="snav-btn" data-route="/settings"
            title="Settings (Ctrl+,)"
            aria-label="Settings" data-testid="snav-settings">⚙</button>
  </div>

  <!-- Channel list (fills remaining space) -->
  <div class="irc-sidebar-scroll">
    <div class="irc-channels-section">
      <div class="irc-channels-header" data-testid="sidebar-channels-header"
           title="Your channels describe your current thinking. ISC finds peers on the same wavelength.">
        <span class="channels-label">My Channels</span>
        <button class="irc-add-btn" data-testid="new-channel-btn"
                title="New Channel (Ctrl+K)" aria-label="New Channel">+</button>
      </div>
      <ul class="irc-channel-list" data-testid="sidebar-channel-list"
          role="listbox" aria-label="Your channels">
        <!-- rendered by renderChannelItems() -->
      </ul>
    </div>
  </div>

  <!-- Status footer -->
  <div class="sidebar-status-strip" data-testid="sidebar-status" role="status"
       aria-live="polite">
    <span class="sidebar-status-dot status-offline" data-field="status-dot">●</span>
    <span class="sidebar-status-text" data-field="status-text">Offline</span>
    <span class="sidebar-status-peers" data-field="peer-count"></span>
    <button class="sidebar-debug-btn" data-testid="debug-toggle"
            title="Debug panel (Ctrl+D)" aria-label="Toggle debug panel">›</button>
  </div>

</aside>
```

Remove `NAV_ITEMS` array from `sidebar.js` entirely — it is superseded by the
hardcoded nav strip above. The sidebar no longer drives primary navigation
item rendering; the strip buttons handle that.

**Update `updateSidebar()` to highlight active nav strip button:**
```js
function updateSidebar(el, state, route) {
  // ... (connection indicator update, channel list update — unchanged) ...

  // Update nav strip active state
  el.querySelectorAll('.snav-btn').forEach(btn => {
    const active = btn.dataset.route === route;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : '');
  });
}
```

**Update `bind()` to handle nav strip clicks:**
```js
function bind(el, { onNavigate, onNewChannel }) {
  el.addEventListener('click', e => {
    const snavBtn  = e.target.closest('.snav-btn');
    const chanItem = e.target.closest('.irc-channel-item');
    const addBtn   = e.target.closest('[data-testid="new-channel-btn"]');
    const debugBtn = e.target.closest('[data-testid="debug-toggle"]');

    if (snavBtn)   onNavigate(snavBtn.dataset.route);
    if (chanItem) { actions.setActiveChannel(chanItem.dataset.channelId); onNavigate('/now'); }
    if (addBtn)    onNewChannel?.();
    if (debugBtn)  el.dispatchEvent(new CustomEvent('isc:toggle-debug', { bubbles: true }));
  });
  // ... keyboard handler unchanged ...
}
```

**Update `createSidebar()` API** — add `setStatus({ status, peerCount })` method
so `app.js` can drive the status footer directly (replacing status-bar component):
```js
return {
  update(route, state = getState()) { updateSidebar(el, state, route); },
  setStatus({ status, peerCount }) {
    const cfg = STATUS_MAP[status] ?? STATUS_MAP.disconnected;
    const dot  = el.querySelector('[data-field="status-dot"]');
    const text = el.querySelector('[data-field="status-text"]');
    const peers = el.querySelector('[data-field="peer-count"]');
    if (dot)   dot.className = `sidebar-status-dot status-${cfg.class}`;
    if (text)  text.textContent = cfg.label;
    if (peers) peers.textContent = peerCount > 0 ? `· ${peerCount} peer${peerCount !== 1 ? 's' : ''}` : '';
  },
  destroy() { el.remove(); },
};
```

**Unread badge on Chats nav button:**
Move the unread badge logic from `router.js:updateChatsBadge()` to target
`.snav-btn[data-route="/chats"]` in addition to (or instead of) the old
`[data-testid="nav-tab-chats"]` selector. Both selectors can be targeted in one
`querySelectorAll` call:
```js
document.querySelectorAll(
  '[data-testid="snav-chats"], [data-testid="nav-tab-chats"]'
).forEach(el => { /* badge logic */ });
```

---

### C2 — Remove `status-bar.js` component ☐

Once the sidebar status footer is implemented (C1), the standalone bottom status
bar becomes redundant.

**`layout.js` changes:**
- Remove `createStatusBar()` call and `statusBarContainer` creation
- Remove `statusBar` from the returned layout object
- Remove the `.status-bar` `padding-bottom` compensation from `.irc-layout`

**`app.js` changes:**
- Replace `layout.statusBar?.update(...)` calls with `layout.sidebar?.setStatus(...)`
- Replace `layout.statusBar?.setLog(msg)` — log messages can go to the sidebar
  debug button tooltip or be dropped (the debug panel itself shows all logs)

**`irc.css`:** Keep `.status-dot`, `.status-text` animation classes (reused in
sidebar footer). Remove `.status-bar`, `.status-bar-section`, `.status-bar-log`,
`.debug-toggle-btn` rules once the footer has its own classes.

**File to delete** when done: `components/status-bar.js`

---

### C3 — Mobile tab bar: 5 tabs, Channels drawer ☐

**File:** `layout.js`

**New TABS array (replaces current 6-tab array):**
```js
const TABS = [
  { id: 'now',      icon: '⌂',  label: 'Now',      route: '/now' },
  { id: 'discover', icon: '◎',  label: 'Discover', route: '/discover' },
  { id: 'chats',    icon: '◷',  label: 'Chats',    route: '/chats' },
  { id: 'channels', icon: '≡',  label: 'Channels', action: 'open-channel-drawer' },
  { id: 'settings', icon: '⚙',  label: 'Settings', route: '/settings' },
];
```

"New Channel" is no longer a tab — it's a `+` button inside the Channels drawer
and reachable via `Ctrl+K`.

**`buildTabBar()` update:**
```js
TABS.forEach(tab => {
  const btn = el('button', {
    className: 'tab',
    'data-testid': `nav-tab-${tab.id}`,
    'data-tab': tab.id,
    'aria-label': tab.label,
  });
  btn.innerHTML = `<span class="tab-icon">${tab.icon}</span>
                   <span class="tab-label">${tab.label}</span>`;
  if (tab.route) {
    btn.addEventListener('click', () => onNavigate(tab.route));
  } else if (tab.action === 'open-channel-drawer') {
    btn.addEventListener('click', () =>
      document.dispatchEvent(new CustomEvent('isc:toggle-channel-drawer'))
    );
  }
  nav.appendChild(btn);
});
```

---

### C4 — Channel drawer component (mobile) ☐

**New file:** `components/channelDrawer.js`

A slide-up bottom sheet for mobile showing the channel list. Hidden on desktop
(sidebar is always visible).

```js
import { getState, actions } from '../../state.js';
import { escapeHtml } from '../../utils/dom.js';

export function createChannelDrawer(onNavigate) {
  const backdrop = document.createElement('div');
  backdrop.className = 'channel-drawer-backdrop';

  const drawer = document.createElement('div');
  drawer.className = 'channel-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', 'Your channels');
  drawer.setAttribute('data-testid', 'channel-drawer');

  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);

  function render() {
    const { channels, activeChannelId } = getState();
    drawer.innerHTML = `
      <div class="channel-drawer-header">
        <span class="channel-drawer-title">My Channels</span>
        <button class="channel-drawer-new" data-testid="drawer-new-channel"
                aria-label="New Channel">+ New</button>
        <button class="channel-drawer-close" aria-label="Close">×</button>
      </div>
      <ul class="channel-drawer-list" role="listbox">
        ${channels.length === 0
          ? '<li class="drawer-empty">No channels yet — press + New to start</li>'
          : channels.map(ch => `
              <li class="drawer-channel-item${ch.id === activeChannelId ? ' active' : ''}"
                  data-channel-id="${escapeHtml(ch.id)}" role="option"
                  aria-selected="${ch.id === activeChannelId}" tabindex="0">
                <span class="drawer-channel-prefix">#</span>
                <span class="drawer-channel-name">${escapeHtml(ch.name)}</span>
              </li>
            `).join('')}
      </ul>
    `;
    bindDrawerEvents();
  }

  function bindDrawerEvents() {
    drawer.querySelector('.channel-drawer-close')
      ?.addEventListener('click', close);
    drawer.querySelector('.channel-drawer-new')
      ?.addEventListener('click', () => { close(); onNavigate('/compose'); });
    drawer.querySelectorAll('.drawer-channel-item').forEach(item => {
      item.addEventListener('click', () => {
        actions.setActiveChannel(item.dataset.channelId);
        onNavigate('/now');
        close();
      });
    });
  }

  function open() {
    render();
    drawer.classList.add('open');
    backdrop.classList.add('open');
    document.addEventListener('keydown', handleEscape);
  }

  function close() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    document.removeEventListener('keydown', handleEscape);
  }

  function handleEscape(e) {
    if (e.key === 'Escape') close();
  }

  backdrop.addEventListener('click', close);
  document.addEventListener('isc:toggle-channel-drawer', () => {
    drawer.classList.contains('open') ? close() : open();
  });

  return { open, close, destroy() { backdrop.remove(); drawer.remove(); } };
}
```

**Integrate in `layout.js` → `buildLayout()`:**
```js
import { createChannelDrawer } from './components/channelDrawer.js';
// ...
const channelDrawer = createChannelDrawer(onNavigate);
// Return channelDrawer in the layout object for destroy()
```

---

### C5 — Sidebar nav strip: keyboard navigation ☐

**File:** `components/sidebar.js` → `bind()` keyboard handler.

The nav strip is a `role="toolbar"`. Arrow Left/Right should move focus between
buttons; Tab exits the toolbar.

```js
el.addEventListener('keydown', e => {
  // Existing: Enter/Space on channel items
  const item = e.target.closest('.irc-nav-item, .irc-channel-item');
  if (item && ['Enter', ' '].includes(e.key)) { e.preventDefault(); item.click(); }

  // New: Arrow keys within nav strip
  const snavBtn = e.target.closest('.snav-btn');
  if (snavBtn && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault();
    const btns = [...el.querySelectorAll('.snav-btn')];
    const idx  = btns.indexOf(snavBtn);
    const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
    btns[next]?.focus();
  }
});
```

Update `setupKeyboardShortcuts` in `router.js` → `cycleSidebarFocus()` to include
`.snav-btn` in the selectable items:
```js
const items = [...document.querySelectorAll('.snav-btn, .irc-channel-item')];
```

---

## Phase D — Video → Chat Integration

Video calling is a modality of a conversation, not a standalone screen. This
matches how Signal, WhatsApp, and Telegram handle it.

### D1 — Add video call button to chat header ☐

**File:** `screens/chats.js` → `renderChatHeader()`

Add after the existing avatar/name block:
```js
function renderChatHeader(name, online, simPct) {
  return `
    <div class="chat-header" data-testid="chat-header">
      ${currentBridgeSuggestion ? renderBridgeSuggestion(currentBridgeSuggestion) : ''}
      <div class="chat-peer-info">
        <!-- existing avatar/name/status markup -->
      </div>
      <div class="chat-header-actions">
        <button class="btn btn-icon" data-video-call
                title="Start video call" aria-label="Video call"
                data-testid="video-call-btn">📹</button>
        <button class="btn btn-ghost btn-sm mobile-back-btn" data-close-chat
                title="Back" aria-label="Back to conversations"
                data-testid="close-chat-mobile">← Back</button>
        <button class="btn btn-icon desktop-close-btn" data-close-chat
                title="Close" aria-label="Close chat"
                data-testid="close-chat">×</button>
      </div>
    </div>
  `;
}
```

Bind in `bindChatInputHandlers()`:
```js
container.querySelector('[data-video-call]')?.addEventListener('click', () => {
  const peerId = container.querySelector('[data-testid="chat-view"]')?.dataset.peerId;
  if (peerId) import('../components/videoCallOverlay.js')
    .then(m => m.openVideoCall(peerId, conv?.name ?? 'Peer'));
});
```

---

### D2 — Video call overlay component ☐

**New file:** `components/videoCallOverlay.js`

The overlay covers the entire app viewport over the active chat. It handles
WebRTC media negotiation via a `type: 'video-signal'` message on the existing
DataChannel.

```js
let overlayEl = null;

export function openVideoCall(peerId, peerName) {
  if (overlayEl) return;  // call already active

  overlayEl = document.createElement('div');
  overlayEl.className = 'video-overlay';
  overlayEl.setAttribute('data-testid', 'video-overlay');
  overlayEl.innerHTML = `
    <video class="video-remote" autoplay playsinline data-testid="video-remote"></video>
    <video class="video-local"  autoplay playsinline muted data-testid="video-local"></video>
    <div class="video-controls">
      <button class="video-ctrl-btn" id="vc-mute"   aria-label="Mute">🎤</button>
      <button class="video-ctrl-btn" id="vc-cam"    aria-label="Camera off">📷</button>
      <button class="video-ctrl-btn video-ctrl-end" id="vc-hang" aria-label="Hang up">✕</button>
    </div>
    <div class="video-peer-name">${escapeHtml(peerName)}</div>
  `;
  document.body.appendChild(overlayEl);

  overlayEl.querySelector('#vc-hang')?.addEventListener('click', closeVideoCall);

  // Request media and signal via existing DataChannel
  initVideoCall(peerId);
}

export function closeVideoCall() {
  stopLocalStream();
  overlayEl?.remove();
  overlayEl = null;
}
```

Full WebRTC media implementation (getUserMedia, offer/answer, track attachment)
should reuse or extend `chat/webrtc.ts`. The signaling payload format:
```js
{ type: 'video-signal', payload: { sdp?, candidate?, action: 'offer'|'answer'|'ice'|'hang-up' } }
```

**CSS for overlay** (in `irc.css`):
```css
.video-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: #000;
  display: flex; align-items: center; justify-content: center;
}
.video-remote { width: 100%; height: 100%; object-fit: cover; }
.video-local  {
  position: absolute; bottom: 80px; right: 16px;
  width: 120px; height: 90px; object-fit: cover;
  border-radius: var(--r-md); border: 2px solid rgba(255,255,255,0.2);
}
.video-controls {
  position: absolute; bottom: 24px; left: 50%;
  transform: translateX(-50%);
  display: flex; gap: 16px;
}
.video-ctrl-btn {
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(255,255,255,0.15); border: none;
  font-size: 20px; cursor: pointer; color: white;
  transition: background 0.15s;
}
.video-ctrl-btn:hover { background: rgba(255,255,255,0.25); }
.video-ctrl-end { background: var(--c-danger); }
.video-ctrl-end:hover { background: #c04040; }
.video-peer-name {
  position: absolute; top: 16px; left: 50%;
  transform: translateX(-50%);
  color: white; font-size: 14px; font-weight: 500;
  text-shadow: 0 1px 4px rgba(0,0,0,0.6);
}
```

---

### D3 — "New conversation" modal in Chats (replaces Video "Dial by Peer ID") ☐

**File:** `screens/chats.js` → `renderHeader()`

Add a "+" button to open a "Start new conversation" modal:
```js
function renderHeader() {
  return `
    <div class="screen-header" data-testid="chats-header">
      <h1 class="screen-title">Chats
        <span class="screen-subtitle">E2E encrypted</span>
      </h1>
      <div class="header-actions">
        <a href="#/discover" class="btn btn-ghost btn-sm">Find Peers</a>
        <button class="btn btn-primary btn-sm" id="new-chat-btn"
                data-testid="new-chat-btn" aria-label="New conversation">+</button>
      </div>
    </div>
  `;
}
```

In `bind()`, the `#new-chat-btn` click opens a modal:
```js
container.querySelector('#new-chat-btn')?.addEventListener('click', () => {
  const html = `
    <div class="modal-header">
      <h2 class="modal-title">Start Conversation</h2>
      <button class="modal-close" aria-label="Close">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label" for="dial-peer-id-input">Peer ID</label>
        <input type="text" id="dial-peer-id-input" class="form-input font-mono"
               placeholder="12D3KooW…" autocomplete="off"
               data-testid="dial-peer-input" />
        <div class="form-hint">Paste a peer's ID to open a direct encrypted chat.</div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="confirm" id="dial-confirm-btn">
        Open Chat
      </button>
    </div>
  `;
  const overlay = modals.open(html);
  overlay.querySelector('[data-action="cancel"]')
    ?.addEventListener('click', () => modals.close());
  overlay.querySelector('[data-action="confirm"]')
    ?.addEventListener('click', () => {
      const peerId = overlay.querySelector('#dial-peer-id-input')?.value.trim();
      if (!peerId) return;
      modals.close();
      activePeerId = peerId;
      update(container);
      openChat(container, peerId);
    });
});
```

---

### D4 — Delete `screens/video.js` ☐

After D1–D3 are complete and confirmed working, delete the file.
Remove its import from `app.js`.

---

## Phase E — Space View Consolidation

### E1 — Extract canvas logic to `utils/spaceCanvas.js` ☐

The Space screen (`screens/space.js`) contains about 400 lines of canvas/UMAP
rendering that is standalone and can be extracted.

**New file:** `utils/spaceCanvas.js`

Export:
```js
export function initSpaceCanvas(canvasEl, { peers, selfPosition, onPeerClick }) { /* ... */ }
export function destroySpaceCanvas() { /* cancel animationId, release resources */ }
export function updateSpaceData({ peers, selfPosition }) { /* re-project and redraw */ }
```

The canvas element itself will be created and injected by the Now screen when
`viewMode === 'space'`.

---

### E2 — Space view mode wired into Now screen ☐

**File:** `screens/now.js`

The mixer panel already dispatches `isc:channel-view-change` with `{ mode }`.
The Now screen's `handleViewChange` already handles this. Extend it to handle
`mode === 'space'`:

```js
const handleViewChange = e => {
  const { mode } = e.detail || {};
  if (!mode) return;
  const feed = container.querySelector('#now-feed');
  if (!feed) return;
  feed.className = `feed-view-${mode}`;

  if (mode === 'space') {
    feed.innerHTML = `<canvas id="space-canvas" class="space-canvas"
                              data-testid="space-canvas"></canvas>`;
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
    // destroy canvas if switching away from space mode
    import('../utils/spaceCanvas.js').then(m => m.destroySpaceCanvas());
    update(container);
  }
};
```

Add canvas cleanup to `destroy()` in `now.js`:
```js
export function destroy() {
  import('../utils/spaceCanvas.js').then(m => m.destroySpaceCanvas());
  refreshing = false;
}
```

---

### E3 — ThoughtTwin notification in Now screen ☐

`space.js` checks `shouldShowThoughtTwinNotification()` on mount and shows a
banner. Move this to the Now screen header area so it works regardless of view
mode.

In `screens/now.js` → `bind()`:
```js
import { shouldShowThoughtTwinNotification, acknowledgeThoughtTwin, dismissThoughtTwin }
  from '../../services/thoughtTwin.ts';

// After rendering, check for thought twin
shouldShowThoughtTwinNotification().then(notification => {
  if (!notification) return;
  const header = container.querySelector('[data-testid="now-header"]');
  const banner = document.createElement('div');
  banner.className = 'thought-twin-banner';
  banner.innerHTML = `
    <span class="twin-icon">✦</span>
    <span>${escapeHtml(notification.message)}</span>
    <button data-twin-ack class="btn btn-primary btn-sm">Connect</button>
    <button data-twin-dismiss class="btn btn-ghost btn-sm">Later</button>
  `;
  header?.after(banner);
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
```

---

### E4 — Delete `screens/space.js` ☐

After E1–E3 are complete and the canvas works in Now, delete the file and its
import in `app.js`.

---

## Phase F — Now Screen

### F1 — Move compose area to bottom of screen ☐

**File:** `screens/now.js`

The compose area moves from above the feed to below it, like an IRC input bar.

**`render()` layout:**
```js
return `
  <div class="screen now-screen" data-testid="now-screen">
    ${renderHeader(activeChannel, connected, connLabel)}
    <div class="screen-body now-body" data-testid="now-body">
      <div id="mixer-container">
        ${activeChannel ? renderMixerPanel(activeChannel) : ''}
      </div>
      <div id="now-feed" class="feed-view-${viewMode}"
           data-testid="feed-container" data-component="feed"
           data-feed="for-you">
        ${posts.length === 0
          ? renderEmptyState(channels, connected, connLabel)
          : renderPosts(posts, channels, viewMode)}
      </div>
    </div>
    ${channels?.length ? renderComposeArea(channels, effectiveChannelId, activeChannel) : ''}
  </div>
`;
```

**`irc.css` — Now screen layout:**
```css
.now-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.now-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;     /* essential for flex children to scroll */
}
.compose-area {
  flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,0.07);
  padding: 10px 16px 12px;
  background: var(--c-bg-sidebar);
}
```

---

### F2 — Hide character counter until user types ☐

**File:** `screens/now.js` → `renderComposeArea()`

Change the counter span initial state:
```js
<span class="compose-count hidden" data-testid="compose-count"></span>
```

In `bind()` input handler:
```js
composeInput?.addEventListener('input', () => {
  const len = composeInput.value.length;
  if (composeCount) {
    composeCount.textContent = `${len} / 2000`;
    composeCount.classList.toggle('hidden', len === 0);
  }
  if (submitBtn) submitBtn.disabled = len === 0;
  autoGrow(composeInput);
});
```

---

### F3 — Only show Delete on own posts ☐

**File:** `screens/now.js` → `renderPostCard()`

```js
import { networkService } from '../../services/network.ts';

function renderPostCard(post, channels, showActions = true) {
  const myIdentity = networkService.getIdentity();
  const myPeerId   = myIdentity?.peerId ?? myIdentity?.pubkey;
  const isOwn      = post.identity?.peerId === myPeerId
                  || post.identity?.pubkey === myPeerId;
  // ...
  return `
    <!-- ... -->
    ${showActions ? `
      <div class="post-actions">
        <button class="post-action-btn" data-action="like" ...> ... </button>
        <button class="post-action-btn" data-action="reply" ...> ... </button>
        ${isOwn ? `
          <button class="post-action-btn" data-action="delete" data-delete-btn
                  data-post-id="${escapeHtml(post.id)}"
                  data-testid="delete-btn-${escapeHtml(post.id)}"
                  style="margin-left:auto">🗑</button>
        ` : ''}
      </div>
    ` : ''}
  `;
}
```

---

### F4 — Like rollback on failure ☐

**File:** `screens/now.js` → `handleLike()`

```js
function handleLike(e, target) {
  const wasLiked = target.dataset.liked === 'true';
  const counter  = target.querySelector('.like-count');
  const delta    = wasLiked ? -1 : 1;

  // Optimistic update
  target.dataset.liked = String(!wasLiked);
  target.classList.toggle('liked', !wasLiked);
  if (counter) counter.textContent = String(parseInt(counter.textContent || '0') + delta);

  // Persist (import at top of file, not via ISC_SERVICES)
  postService.like(target.dataset.postId).catch(() => {
    // Rollback
    target.dataset.liked = String(wasLiked);
    target.classList.toggle('liked', wasLiked);
    if (counter) counter.textContent = String(parseInt(counter.textContent || '0') - delta);
    toasts.warning('Could not save like');
  });
}
```

---

### F5 — Robust reply flow ☐

**File:** `router.js` → `setupEventHandlers()` → `isc:reply-post` handler.

Current code uses `setTimeout(100)` to wait for the Now screen to render before
querying the compose input. This is a race condition.

**Fix:** Instead of a blind timeout, dispatch a secondary event that the Now screen
listens for:
```js
// In router.js isc:reply-post handler:
onNavigate('/now');
const snippet = (post.content || '').slice(0, 80);
const quoteText = `> ${snippet}${post.content?.length > 80 ? '…' : ''}\n\n`;
// Small delay still needed for DOM render, but use rAF + check:
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const input = mainContent?.querySelector('[data-testid="compose-input"]');
    if (input) {
      input.value = quoteText;
      input.dispatchEvent(new Event('input'));
      input.focus();
    }
  });
});
```
Two nested `requestAnimationFrame` calls guarantee execution after the browser
paints the new screen, which is more reliable than a fixed timeout.

---

### F6 — Mixer panel: replace native confirm() with modals.confirm() ☐

Covered in A7 — ensure this is applied as part of Phase A.

---

### F7 — Mixer panel: default to collapsed on mobile ☐

**File:** `components/mixerPanel.js` → `renderMixerPanel()`

```js
import { isMobile } from '../utils/dom.js';

export function renderMixerPanel(activeChannel) {
  if (!activeChannel) return '';
  const settings = channelSettingsService.getSettings(activeChannel.id);
  // Override expanded state on mobile: default to collapsed unless explicitly expanded
  const isExpanded = isMobile()
    ? (settings.panelsExpanded.mixerExpanded ?? false)
    : (settings.panelsExpanded.mixerExpanded ?? true);
  // ...
}
```

---

## Phase G — Discover Screen

### G1 — Auto-trigger discovery on first load ☐

**File:** `screens/discover.js` → `bind()`

```js
let autoDiscovered = false;

export function bind(container) {
  // ...existing bindings...

  // Auto-discover once per session if conditions are met
  const { channels } = getState();
  const connected = networkService.getStatus()?.connected ?? false;
  const matches   = discoveryService.getMatches();

  if (!autoDiscovered && connected && channels.length > 0 && matches.length === 0) {
    autoDiscovered = true;
    // Show searching state immediately
    const content = container.querySelector('#discover-content');
    if (content) content.innerHTML = renderLoading('Searching for thought neighbors…');
    // Trigger discovery without waiting for button click
    doDiscover();
  }

  return [() => { autoDiscovered = false; }];
}
```

`renderLoading()` is already exported from `utils/screen.js`.

---

### G2 — Merge "Connect" + "Message" into single "Chat" CTA ☐

**File:** `screens/discover.js` → `renderMatchCard()`

Replace the two-button row with a single button:
```js
<div class="match-actions">
  <button class="btn btn-primary btn-sm" data-chat-btn
          data-peer-id="${escapeHtml(id)}" data-peer-name="${escapeHtml(name)}"
          data-testid="chat-btn-${escapeHtml(id)}"
          aria-label="Chat with ${escapeHtml(name)}">
    Chat
  </button>
</div>
```

Click handler in `bind()`:
```js
container.addEventListener('click', async e => {
  const chatBtn = e.target.closest('[data-chat-btn]');
  if (!chatBtn) return;

  const { peerId, peerName } = chatBtn.dataset;
  chatBtn.disabled = true;
  chatBtn.textContent = 'Connecting…';

  try {
    // Connect first (idempotent if already connected)
    await discoveryService.connect(peerId);
    await markPeerContacted(peerId).catch(() => {});
    // Then open chat
    window.location.hash = '#/chats';
    setTimeout(() =>
      document.dispatchEvent(new CustomEvent('isc:start-chat', { detail: { peerId } }))
    , 100);
  } catch (err) {
    toasts.error(`Could not connect: ${err.message}`);
    chatBtn.disabled = false;
    chatBtn.textContent = 'Chat';
  }
});
```

---

### G3 — Collapsible "How it works" explainer ☐

**File:** `screens/discover.js` → `renderEmptyState()`

```js
function renderEmptyState(connected, channels) {
  const description = /* ... existing logic ... */;
  const actionBtn = connected && channels.length
    ? `<button class="btn btn-primary" data-action="discover" id="discover-btn-empty"
               data-testid="discover-btn-empty">Search Now</button>`
    : '';

  return `
    <div class="empty-state" data-testid="empty-state">
      <div class="empty-state-icon">🔭</div>
      <div class="empty-state-title">No thought neighbors yet</div>
      <div class="empty-state-description">${escapeHtml(description)}</div>
      ${actionBtn}
    </div>
    <details class="explainer-details mt-4">
      <summary class="explainer-summary">How does semantic discovery work?</summary>
      <div class="card card-blue mt-2">
        ${renderExplainerStep('🧠', 'Local embedding', '...')}
        ${renderExplainerStep('🗺️', 'LSH + DHT lookup', '...')}
        ${renderExplainerStep('📐', 'Cosine similarity ranking', '...')}
        ${renderExplainerStep('🔒', 'Direct P2P connection', '...')}
      </div>
    </details>
  `;
}
```

**CSS:**
```css
.explainer-details summary {
  cursor: pointer; color: var(--c-text-dim); font-size: 13px;
  padding: 8px 0; user-select: none;
}
.explainer-details summary:hover { color: var(--c-text); }
```

---

### G4 — Single callout slot: banner priority queue ☐

**File:** `screens/discover.js`

Replace the four independent banner variables (`bridgeCandidates`, `convergenceEvent`,
`noMatchesBannerEl`, and the need-channels banner) with a single priority queue:

```js
const CALLOUT_PRIORITY = ['need-channels', 'no-matches', 'convergence', 'bridge'];
let activeCallout = null;

function showCallout(container, type, content) {
  // Only show if this type is higher priority than the current one
  const currentPrio = CALLOUT_PRIORITY.indexOf(activeCallout);
  const newPrio     = CALLOUT_PRIORITY.indexOf(type);
  if (activeCallout && newPrio > currentPrio) return;  // lower priority, skip

  dismissCallout(container);
  activeCallout = type;

  const el = document.createElement('div');
  el.className = 'discover-callout';
  el.setAttribute('data-callout-type', type);
  el.innerHTML = content;
  container.querySelector('#discover-content')?.before(el);
}

function dismissCallout(container) {
  container.querySelector('.discover-callout')?.remove();
  activeCallout = null;
}
```

All banner rendering functions (`showNoMatchesBanner`, `renderBridgeMomentBanner`,
`renderConvergenceBanner`, `renderNeedChannels`) are refactored to call
`showCallout(container, type, html)`.

---

### G5 — Simplify similarity tier labels ☐

**File:** `screens/discover.js` → `SIMILARITY_TIERS` constant.

```js
const SIMILARITY_TIERS = [
  { key: 'strong',  label: 'Strong match',  desc: '85%+',    min: 0.85 },
  { key: 'good',    label: 'Good match',    desc: '70–85%',  min: 0.70, max: 0.85 },
  { key: 'partial', label: 'Partial match', desc: '55–70%',  min: 0.55, max: 0.70 },
  { key: 'weak',    label: 'Weak match',    desc: '<55%',    max: 0.55 },
];
```

Update `renderMatchCard()` `simLabel` and `simClass` derivations accordingly.
The tier key also drives the `.match-section` CSS class used for left-border color.

---

## Phase H — Chats Screen

### H1 — Duplicate send handler (covered in A6) ☐

See Phase A6.

---

### H2 — Mobile responsive stacking ☐

**File:** `screens/chats.js` → `openChat()` and `doClose()` + `irc.css`

```js
function openChat(container, peerId) {
  // ...existing logic...
  container.querySelector('.chats-layout')?.classList.add('chat-open');
}

// In doClose():
container.querySelector('.chats-layout')?.classList.remove('chat-open');
```

**`irc.css`:**
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

### H3 — Video call wiring (covered in D1) ☐

See Phase D1.

---

### H4 — New conversation modal (covered in D3) ☐

See Phase D3.

---

## Phase I — Compose Screen

### I1 — Move Save button to bottom of form ☐

**File:** `screens/compose.js` → `render()`

Header becomes: `← Cancel | ✏️ New Channel` (no Save in header).

```js
// Header (no Save button):
<div class="screen-header" data-testid="compose-header">
  <button class="btn btn-ghost btn-sm" id="compose-cancel"
          data-testid="compose-cancel" aria-label="Cancel">← Cancel</button>
  <h1 class="screen-title">New Channel</h1>
  <div style="width:60px"></div>  <!-- spacer to centre the title -->
</div>

// Bottom of screen-body (after all cards):
<div class="compose-submit-area">
  <button class="btn btn-primary btn-full" id="compose-save"
          data-testid="compose-save" disabled aria-label="Save channel">
    Create Channel
  </button>
</div>
```

**CSS:**
```css
.compose-submit-area {
  padding: 16px 20px 24px;
  flex-shrink: 0;
}
.btn-full { width: 100%; justify-content: center; }
```

---

### I2 — Cancel uses history navigation ☐

**File:** `screens/compose.js` → `bind()`

```js
cancelBtn?.addEventListener('click', () => {
  // If there's browser history within the app, go back.
  // Otherwise fall to /now as a safe default.
  if (history.length > 1) {
    history.back();
  } else {
    window.location.hash = '#/now';
  }
});
```

---

### I3 — Post-save navigation waits for embedding ☐

**File:** `screens/compose.js` → `bind()` save handler

```js
saveBtn?.addEventListener('click', async () => {
  // ... validation, disable button ...
  try {
    await channelService.create(name, desc, spread, selectedTags);
    toasts.success(`Channel "#${name}" created!`);
    if (successDiv) successDiv.style.display = 'flex';

    // Poll for embedding readiness before navigating (max 8 seconds)
    let embeddingPollInterval = null;
    let pollAttempts = 0;
    const navigate = () => { window.location.hash = '#/now'; };

    embeddingPollInterval = setInterval(() => {
      pollAttempts++;
      const svc = networkService.service?.getEmbeddingService?.();
      const ready = svc ? svc.isLoaded?.() ?? true : true;
      if (ready || pollAttempts >= 32) {  // 32 × 250ms = 8s max
        clearInterval(embeddingPollInterval);
        navigate();
      }
    }, 250);
  } catch (err) { /* ... */ }
});
```

---

### I4 — Edit mode: pre-fill from existing channel ☐

**File:** `screens/compose.js` and `router.js`

The Compose screen needs to handle an optional `?edit=<channelId>` query on the
hash route, e.g. `#/compose?edit=<id>`.

**`router.js` → `parseRoute()`** — extend to parse query string from hash:
```js
function parseRoute() {
  const full = window.location.hash.replace('#', '').trim();
  const [path, query] = full.split('?');
  const params = Object.fromEntries(new URLSearchParams(query ?? ''));
  const route  = screens[path] ? path : defaultRoute;
  return { route, params };
}
```
Update `renderRoute()` to pass `params` to `screen.bind(mainContent, params)`.

**`screens/compose.js` → `render(params = {})`:**
```js
export function render(params = {}) {
  const editChannel = params.edit
    ? channelService.getById(params.edit)
    : null;
  // ...
  return `
    <!-- title changes if editing -->
    <h1 class="screen-title">${editChannel ? 'Edit Channel' : 'New Channel'}</h1>
    <!-- pre-fill inputs if editing -->
    <input ... value="${escapeHtml(editChannel?.name ?? '')}" ...>
    <textarea ...>${escapeHtml(editChannel?.description ?? '')}</textarea>
  `;
}

export function bind(container, params = {}) {
  const editChannelId = params.edit ?? null;
  // ...
  saveBtn?.addEventListener('click', async () => {
    if (editChannelId) {
      await channelService.update(editChannelId, { name, description: desc });
    } else {
      await channelService.create(name, desc, spread, selectedTags);
    }
    // ...
  });
}
```

**`screens/settings.js` → channel Edit button:**
In `renderChannels()`, add an Edit button alongside Delete:
```js
<button class="btn btn-secondary btn-sm edit-channel-btn"
        data-channel-id="${escapeHtml(ch.id)}"
        data-testid="edit-channel-${escapeHtml(ch.id)}">Edit</button>
```
Click handler:
```js
container.addEventListener('click', e => {
  const editBtn = e.target.closest('.edit-channel-btn');
  if (editBtn) window.location.hash = `#/compose?edit=${editBtn.dataset.channelId}`;
});
```

---

## Phase J — Settings Screen

### J1 — All-live-save; remove spurious Save buttons ☐

**File:** `screens/settings.js`

**What to remove:**
- "Save Discovery Settings" button (`#save-discovery`) and its click handler
- "Save Preferences" button (`#save-preferences`) and its click handler

**What to add:** Discovery settings (auto-discover, interval, threshold) become
live-save via individual `change`/`input` handlers, same pattern as the existing
appearance toggles.

```js
// Discovery live-save:
container.querySelector('#auto-discover')?.addEventListener('change', e => {
  settingsService.set({ autoDiscover: e.target.checked });
});
container.querySelector('#discover-interval')?.addEventListener('change', e => {
  settingsService.set({ discoverInterval: parseInt(e.target.value, 10) });
});
container.querySelector('#similarity-threshold')?.addEventListener('input', e => {
  const v = container.querySelector('#sim-value');
  if (v) v.textContent = e.target.value;
  settingsService.set({ similarityThreshold: parseInt(e.target.value, 10) / 100 });
});
```

For preference toggles: replace the toast on "Save Preferences" with an inline
fade-in "Saved ✓" message adjacent to the last toggle row:
```js
// After any live-save toggle change, show subtle confirmation:
function showInlineSaved(nearEl) {
  const msg = document.createElement('span');
  msg.className = 'inline-saved-msg';
  msg.textContent = 'Saved';
  nearEl?.after(msg);
  setTimeout(() => msg.remove(), 1500);
}
```

**CSS:**
```css
.inline-saved-msg {
  font-size: 11px; color: var(--c-success);
  animation: fade-out 1.5s forwards;
}
@keyframes fade-out { 0% { opacity:1 } 70% { opacity:1 } 100% { opacity:0 } }
```

---

### J2 — Channel Edit in Settings references mixer panel's `showEditModal` ☐

`mixerPanel.js` already has a fully functional `showEditModal(channel)`. Rather
than duplicating it, import and reuse it in the Settings channel Edit button
handler:

```js
// In screens/settings.js:
import { showEditModal } from '../components/mixerPanel.js';
// Note: showEditModal is not currently exported — add export keyword to it.

container.addEventListener('click', e => {
  const editBtn = e.target.closest('.edit-channel-btn');
  if (editBtn) {
    const ch = channelService.getById(editBtn.dataset.channelId);
    if (ch) showEditModal(ch);
  }
});
```

**Fix in `mixerPanel.js`:** Add `export` to `showEditModal`:
```js
export function showEditModal(channel) { /* ... */ }
```

Also fix the `document.querySelector` scoping bug inside `showEditModal`:
it uses `document.querySelector('#edit-channel-name')` etc., which could
accidentally find elements in any open modal. Since the edit modal is appended
directly to `document.body`, the `modal` reference itself should be used for
queries:
```js
// Instead of:
function on(selector, event, handler) {
  document.querySelector(selector)?.addEventListener(event, handler);
}
// Use:
function on(selector, event, handler) {
  modal.querySelector(selector)?.addEventListener(event, handler);
}
// And update saveChanges() to use modal.querySelector() instead of document.querySelector()
```

---

### J3 — Rename "Logout" → "Reset Identity" ☐

**File:** `screens/settings.js` → `renderDangerZone()` and its bind handler.

```js
<button class="btn btn-danger" id="reset-identity-btn"
        data-testid="reset-identity-btn">Reset Identity</button>
```

Confirmation copy:
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

### J4 — Collapse Nostr Identity Bridge ☐

**File:** `screens/settings.js` → `renderIdentity()`

```js
function renderIdentity(identity) {
  // ...existing fingerprint / export / import markup...
  return `
    <section class="settings-section" data-testid="identity-section">
      <div class="section-title">Identity</div>
      <!-- fingerprint + export/import unchanged -->
      ...

      <div class="divider mt-4 mb-4"></div>

      <details class="nostr-bridge-details" data-testid="nostr-bridge">
        <summary class="settings-subsection-toggle">
          Nostr Identity Bridge
          <span id="nostr-linked-indicator"></span>
        </summary>
        <div class="nostr-bridge-body mt-3">
          <!-- existing nsec input, link/unlink buttons, status -->
          ...
        </div>
      </details>
    </section>
  `;
}
```

In `bind()` → `updateNostrStatus()`: if linked, open the `<details>` element and
show a "Linked ✓" indicator in the `<summary>`:
```js
if (linked) {
  container.querySelector('.nostr-bridge-details')?.setAttribute('open', '');
  const indicator = container.querySelector('#nostr-linked-indicator');
  if (indicator) { indicator.textContent = '✓ Linked'; indicator.className = 'text-success ml-2'; }
}
```

---

### J5 — Add ephemeral session toggle to Identity section ☐

**File:** `screens/settings.js` → `renderIdentity()`

```js
const isEphemeral = localStorage.getItem('isc-ephemeral-session') === 'true';

// Add inside the Identity section, before the Nostr bridge:
<div class="toggle-row" data-testid="ephemeral-toggle-row">
  <div>
    <div class="toggle-label-text">Anonymous (ephemeral) session</div>
    <div class="toggle-hint">Your identity exists only in this tab. Closing it permanently erases all data.</div>
  </div>
  <label class="toggle">
    <input type="checkbox" id="ephemeral-toggle" ${isEphemeral ? 'checked' : ''}
           data-testid="ephemeral-session-toggle" />
    <span class="toggle-slider"></span>
  </label>
</div>
```

Bind:
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

### J6 — Improve "Clear All Data" copy ☐

**File:** `screens/settings.js` → `renderDangerZone()` and clear handler.

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

### J7 — Fix broken About link ☐

**File:** `screens/settings.js` → `renderAbout()`

Replace `https://github.com/isc2` with the actual repository URL, or replace the
link with plain text until the URL is confirmed. Do not ship broken hrefs.

---

## Phase K — Onboarding & First-Run Flow

### K1 — Land on Compose after onboarding ☐

**File:** `app.js` → `showOnboarding()`

```js
overlay.querySelector('#onboarding-done')?.addEventListener('click', () => {
  localStorage.setItem('isc-onboarding-completed', 'true');
  modals.close();
  navigate('/compose');   // first action: create a channel
});
```

---

### K2 — Simplify onboarding modal; remove ephemeral checkbox ☐

**File:** `app.js` → `showOnboarding()`

Remove the ephemeral session checkbox (moved to Settings → J5). Simplify to a
two-paragraph welcome:

```js
const html = `
  <div class="modal-header">
    <h2 class="modal-title">Welcome to ISC</h2>
  </div>
  <div class="modal-body" data-testid="onboarding-content">
    <p>ISC connects you with people thinking about the same things — not by social graph, but by the meaning of your words.</p>
    <p>Your first step is creating a <strong>channel</strong> — a short description of what's on your mind. A tiny AI runs in your browser to turn it into a semantic fingerprint. No text ever leaves your device.</p>
    <p style="font-size:12px;color:var(--c-text-muted);margin-top:12px">
      Press <kbd>?</kbd> anytime for keyboard shortcuts.
    </p>
  </div>
  <div class="modal-actions">
    <button class="btn btn-primary" id="onboarding-done"
            data-testid="onboarding-complete">Create my first channel →</button>
  </div>
`;
```

---

### K3 — Contextual empty states (Now + Discover) ☐

**`screens/now.js` → `renderEmptyState()` when no channels:**

Replace the 4-step explainer card with a single focused prompt:
```js
function renderEmptyState(channels, connected, connLabel) {
  if (!channels?.length) {
    return `
      <div class="empty-state" data-testid="empty-state">
        <div class="empty-state-icon">💭</div>
        <div class="empty-state-title">What are you thinking about?</div>
        <div class="empty-state-description">
          Create a channel — a short description of your current thoughts.
          ISC will find people on the same wavelength.
        </div>
        <a href="#/compose" class="btn btn-primary mt-4"
           data-testid="create-first-channel-btn">Create your first channel</a>
      </div>
      <details class="explainer-details mt-4">
        <summary class="explainer-summary">How does ISC work?</summary>
        ${renderHowItWorksCard()}
      </details>
      ${!connected ? `<div class="info-banner warning mt-4">Network is ${escapeHtml(connLabel)} — you can still create channels offline</div>` : ''}
    `;
  }
  // ...existing no-posts empty state...
}
```

Move the `card card-blue` How-it-works content into `renderHowItWorksCard()` and
wrap it in the `<details>` element.

**`screens/discover.js` → no-channels banner:**
Replace inline banner with the same collapsible-explainer pattern from G3.

---

### K4 — PWA banner: trigger on meaningful action, not a timer ☐

**File:** `app.js` → `setupPWAInstallPrompt()`

```js
function setupPWAInstallPrompt() {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;

    const hasInstalled  = localStorage.getItem('isc-pwa-installed');
    const installCount  = parseInt(localStorage.getItem('isc-install-prompt-count') || '0', 10);
    if (hasInstalled || installCount >= 2) return;

    // Trigger on first meaningful engagement, not a timer
    const showPrompt = () => {
      document.removeEventListener('isc:channel-created', showPrompt);
      document.removeEventListener('isc:peers-found',     showPrompt);
      showInstallBanner(installCount);
    };

    document.addEventListener('isc:channel-created', showPrompt, { once: true });
    document.addEventListener('isc:peers-found',     showPrompt, { once: true });
  });
}
```

`channelService.create()` should dispatch `isc:channel-created` after success.
`discoveryService.discoverPeers()` should dispatch `isc:peers-found` when matches
are found. Both are in `services/index.js`.

---

## Phase L — Modal System

### L1 — Focus trap ☐

**File:** `components/modal.js` → `open()`

After focusing the first element, trap Tab key within the modal:
```js
const focusableSelectors =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), ' +
  'select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

const handleTabTrap = e => {
  if (e.key !== 'Tab' || !activeModal) return;
  const focusable = [...modal.querySelectorAll(focusableSelectors)];
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus(); }
  } else {
    if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
  }
};
document.addEventListener('keydown', handleTabTrap);
// Store handleTabTrap in activeModal to remove it on close:
activeModal = { overlay, onClose, handleTabTrap };
```

In `close()`:
```js
close() {
  if (!activeModal) return;
  document.removeEventListener('keydown', activeModal.handleTabTrap);
  // ... rest of close() ...
}
```

---

### L2 — `confirm()` close-on-confirm (covered in A2) ☐

See Phase A2.

---

### L3 — Help modal: add missing shortcuts ☐

**File:** `components/modal.js` → `showHelp()`

```js
const shortcuts = [
  { key: '?',         desc: 'Show this help' },
  { key: 'Ctrl+K',    desc: 'New channel' },
  { key: 'Ctrl+,',    desc: 'Settings' },
  { key: 'Ctrl+D',    desc: 'Toggle debug panel' },
  { key: 'Ctrl+Enter',desc: 'Send message / submit form' },
  { key: '/',         desc: 'Focus search / input' },
  { key: 'Ctrl+Space',desc: 'Toggle serendipity mode' },
  { key: 'Esc',       desc: 'Close modal / dialog' },
  { key: '↑ ↓',       desc: 'Navigate conversation list' },
];
```

---

### L4 — Deduplicate `Ctrl+K` and `Ctrl+N` shortcuts ☐

**File:** `router.js` → `setupKeyboardShortcuts()`

Both `Ctrl+K` (line ~261) and `Ctrl+N` (line ~291) navigate to `/compose`.
Remove the `Ctrl+N` handler — `Ctrl+K` is the canonical shortcut (consistent with
VS Code "new file" convention and already advertised in the help modal).

---

## Phase M — CSS & Visual System

### M1 — Extract inline styles from all screen JS files ☐

Every `style="..."` attribute inside template literals in screen and component
files must move to `irc.css`. This is a comprehensive sweep — do it screen by
screen in dedicated commits.

**Priority order (most inline styles first):**
1. `screens/now.js` — post-header flex layout, post actions margin
2. `screens/settings.js` — section description, about section typography
3. `app.js` — onboarding modal inline styles (margin, padding, color)
4. `components/mixerPanel.js` — various inline display:none / display:flex
5. `screens/compose.js` — spread-labels flex layout, count display
6. `screens/discover.js` — match-stats font-size, section range text

**New utility classes to add to `irc.css`:**
```css
.flex-row   { display: flex; align-items: center; }
.flex-col   { display: flex; flex-direction: column; }
.gap-2      { gap: 8px; }
.gap-3      { gap: 12px; }
.min-w-0    { min-width: 0; }
.flex-1     { flex: 1; }
.flex-shrink-0 { flex-shrink: 0; }
.ml-auto    { margin-left: auto; }
/* spacing: mt-1 through mt-6, mb-1 through mb-6 already partially present */
```

---

### M2 — Light theme CSS variables ☐

**File:** `styles/irc.css`

Add after the `:root { }` block:
```css
[data-theme="light"] {
  --c-bg-base:     #f0f0f5;
  --c-bg-sidebar:  #e4e4eb;
  --c-bg-content:  #ffffff;
  --c-bg-card:     #f5f5fa;
  --c-bg-input:    #ffffff;
  --c-bg-hover:    #e8e8ee;
  --c-bg-active:   #dddde8;
  --c-bg-overlay:  rgba(0, 0, 0, 0.4);

  --c-text:        #1a1a2e;
  --c-text-dim:    #444458;
  --c-text-muted:  #888899;
  --c-text-link:   #2c5fb3;

  --c-online:      #2e7d4a;
  --c-offline:     #b03030;
  --c-brand:       #2c5fb3;
  --c-brand-hover: #1e4a99;
  --c-success:     #2e7d4a;
  --c-warning:     #915a00;
  --c-danger:      #b03030;
  --c-info:        #2c5fb3;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) { /* same values */ }
}
```

---

### M3 — Emoji in structural UI: apply consistent policy ☐

**Policy:**
- Navigation (sidebar nav strip, tab bar): use Unicode symbols or SVG, **no emoji**
- Screen `<h1>` titles: allow **one** leading emoji as visual identity marker
- Section titles in Settings/Compose: **remove emoji** from `.section-title` and
  `.card-title` elements
- Post actions (♡ ↩ 🗑): replace with plain text or consistent Unicode:
  `♥ Like` · `↩ Reply` · `Delete` (text, not icon-only — see WCAG 2.1 AA)
- Status indicators (● ○): keep — these are intentional IRC aesthetic
- Toast messages: keep where they add signal, remove from mundane confirmations
  ("Saved ✓" doesn't need an emoji)

The mixer panel icons (🎯 Precision, 👁 View, etc.) are acceptable since they are
compact labels for a dense control surface.

---

### M4 — Touch targets: minimum 44×44px on mobile ☐

**File:** `styles/irc.css`

```css
/* Tab bar */
.tab {
  min-height: 52px;
  padding: 6px 4px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.tab .tab-icon  { font-size: 18px; line-height: 1; }
.tab .tab-label { font-size: 11px; letter-spacing: 0.2px; line-height: 1; }

/* Sidebar channel items */
.irc-channel-item { min-height: 36px; }

/* Post action buttons */
.post-action-btn { min-height: 32px; padding: 0 10px; }

/* Sidebar nav strip buttons */
.snav-btn { min-width: 44px; min-height: 36px; }
```

---

### M5 — Sidebar nav strip CSS ☐

**File:** `styles/irc.css`

```css
.sidebar-nav-strip {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
  gap: 1px;
  padding: 4px 6px;
}

.snav-btn {
  flex: 1;
  height: 34px;
  border-radius: var(--r-sm);
  font-size: 16px;
  line-height: 1;
  color: var(--c-text-dim);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.snav-btn:hover  { background: var(--c-bg-hover);  color: var(--c-text); }
.snav-btn.active { background: var(--c-bg-active); color: var(--c-brand); }
.snav-btn:focus-visible {
  outline: 2px solid var(--c-brand);
  outline-offset: -2px;
}

/* Unread badge on Chats button */
.snav-btn .nav-unread-badge {
  position: absolute;
  top: 3px; right: 5px;
  background: var(--c-danger);
  color: #fff;
  border-radius: var(--r-full);
  font-size: 9px;
  min-width: 14px; height: 14px;
  line-height: 14px;
  text-align: center;
  padding: 0 3px;
  pointer-events: none;
}

/* Sidebar status footer */
.sidebar-status-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--c-text-muted);
  flex-shrink: 0;
}
.sidebar-status-dot  { font-size: 9px; }
.sidebar-status-text { white-space: nowrap; }
.sidebar-status-peers{ flex: 1; white-space: nowrap; overflow: hidden;
                        text-overflow: ellipsis; }
.sidebar-debug-btn   {
  margin-left: auto; background: none; border: none;
  color: var(--c-text-muted); cursor: pointer;
  font-size: 12px; font-family: var(--font-mono); padding: 0 2px;
}
.sidebar-debug-btn:hover { color: var(--c-text); }

/* Channel drawer (mobile) */
.channel-drawer-backdrop {
  display: none; position: fixed; inset: 0;
  background: var(--c-bg-overlay); z-index: 2000;
}
.channel-drawer-backdrop.open { display: block; }

.channel-drawer {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--c-bg-sidebar);
  border-radius: 12px 12px 0 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  max-height: 60vh; overflow-y: auto;
  transform: translateY(100%);
  transition: transform 0.25s ease;
  z-index: 2001;
}
.channel-drawer.open { transform: translateY(0); }

.channel-drawer-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.channel-drawer-title { flex: 1; font-weight: 600; font-size: 14px; }
.channel-drawer-new   { /* .btn .btn-primary .btn-sm */ }
.channel-drawer-close {
  background: none; border: none; font-size: 20px;
  color: var(--c-text-muted); cursor: pointer; padding: 0 4px;
}
.channel-drawer-list  { list-style: none; margin: 0; padding: 8px 0; }
.drawer-channel-item  {
  padding: 10px 16px; display: flex; align-items: center;
  gap: 6px; cursor: pointer; font-size: 14px; color: var(--c-text-dim);
}
.drawer-channel-item:hover  { background: var(--c-bg-hover); color: var(--c-text); }
.drawer-channel-item.active { color: var(--c-text); font-weight: 500; }
.drawer-empty {
  padding: 16px; font-size: 13px; color: var(--c-text-muted); text-align: center;
}
```

---

### M6 — `irc-layout` and `main.css` overlap ☐

**File:** `styles/irc.css` + `../styles/main.css` (shared with Preact UI)

`layout.js` imports both. Audit for duplicated rules (flex layout on `#app`,
body reset, button reset) between the two files. Move anything vanilla-specific
out of `main.css` to prevent cross-contamination with the Preact build.

The `irc-layout` uses CSS Grid. Document the layout explicitly:
```css
.irc-layout {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  grid-template-rows: 1fr;
  height: 100vh;
  overflow: hidden;
  padding-bottom: 0;  /* no longer needs status bar compensation */
}
.irc-layout-mobile {
  grid-template-columns: 1fr;
}
```
The tab bar is a fixed overlay (not in the grid flow) on mobile:
```css
.tab-bar {
  display: none;
}
.tab-bar-mobile {
  display: flex;
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--c-bg-sidebar);
  border-top: 1px solid rgba(255,255,255,0.07);
  z-index: 100;
}
/* Main content needs bottom padding on mobile to clear tab bar */
.irc-layout-mobile .irc-main {
  padding-bottom: 52px;
}
```

---

## Phase N — Terminology & Copy

### N1 — Channel framing: consistent language throughout ☐

| Location | Current | Revised |
|---|---|---|
| Sidebar section header | "Channels" | "My Channels" |
| Sidebar empty state | "No channels" | "No channels yet — press + to start" |
| Sidebar "+" button tooltip | "New Channel (Ctrl+K)" | unchanged ✓ |
| Now empty state (no channels) | "Create your first channel" | "Create your first channel — describe what's on your mind" |
| Now header active badge title | "Active channel" | "Your active channel" |
| Discover: no-channels banner | "Create a channel first" | "You need a channel before discovering peers. Your channel describes what you're thinking about — ISC finds others thinking similarly." |
| Compose header title | "✏️ New Channel" | "New Channel" (remove emoji from title) |
| Compose name placeholder | "What are you thinking about?" | unchanged ✓ |
| Settings channels section title | "Your Channels (N)" | "My Channels (N)" |
| Onboarding step | "Create a Channel" | "Create a Channel — describe what's on your mind" |

**Do not** rename "channel" to anything else (thought, topic, signal, etc.) —
it fits the IRC metaphor and is already used everywhere.

---

### N2 — Simplify similarity tier labels (covered in G5) ☐

See Phase G5.

---

### N3 — Post action labels: add text alongside icons ☐

Currently: `♡ <span class="like-count">3</span>` and `↩ 2` with no labels.
Users who don't recognise the symbols (screen readers, unfamiliar users) are
left guessing.

**Fix in `renderPostCard()`:**
```js
<button class="post-action-btn" data-action="like" ...>
  <span aria-hidden="true">♥</span>
  <span class="post-action-label">Like</span>
  <span class="like-count">${likes}</span>
</button>
<button class="post-action-btn" data-action="reply" ...>
  <span aria-hidden="true">↩</span>
  <span class="post-action-label">Reply</span>
  <span>${replies}</span>
</button>
${isOwn ? `
  <button class="post-action-btn post-action-delete" data-action="delete" ...>
    <span class="post-action-label">Delete</span>
  </button>
` : ''}
```

```css
.post-action-label { font-size: 12px; }
```

---

## Phase O — Code Quality & Remaining Gaps

### O1 — Fix `renderHeader()` inline style ☐

**File:** `utils/screen.js` → `renderHeader()` (~line 67):
```js
<div style="display:flex;align-items:center;gap:12px;min-width:0">
```
Replace with CSS class `.flex-row.gap-3.min-w-0` (classes added in M1).

---

### O2 — `index.js` fatal error handler: move inline styles to CSS ☐

**File:** `vanilla/index.js` — the `catch` block uses an extensive inline style
string. Add a `.fatal-error-screen` class to `irc.css` and use it instead.

---

### O3 — `screen.js:renderList()` and `renderGrid()` emoji icons ☐

`renderList()` and `renderEmpty()` hard-code `'📭'` as the default empty icon.
This is fine for general use but callers should always provide their own `icon`.
Add a lint note (JSDoc `@param` marked `@required`) to prevent the default from
being relied upon.

---

### O4 — Audit `postService.like()` and `postService.delete()` optional chains ☐

**File:** `services/index.js`:
```js
async like(postId) {
  await networkService.service?.likePost?.(postId);  // silently no-ops if not implemented
}
async delete(postId) {
  await networkService.service?.deletePost?.(postId);  // same
}
```
These use optional chaining on the network service's inner methods. If the
network layer doesn't implement them, the call silently succeeds (resolves
undefined) and the UI behaves as if it worked. Add an explicit check:
```js
async like(postId) {
  if (!networkService.service?.likePost) {
    logger.warn('postService.like: likePost not implemented in network layer');
    return;
  }
  await networkService.service.likePost(postId);
}
```

---

## Sequence, Dependencies & PR Grouping

```
Phase A (P0 bugs)       → standalone PR, ship immediately
Phase B (lifecycle)     → depends on A; enables C–N
Phase C (sidebar)       → depends on B; large structural PR
Phase D (video→chat)    → depends on B+C
Phase E (space→view)    → depends on B+C
Phase F (Now screen)    → depends on C; A7 is prerequisite
Phase G (Discover)      → depends on C
Phase H (Chats)         → depends on A6, C, D
Phase I (Compose)       → depends on B+C (params routing)
Phase J (Settings)      → depends on A5; A7 prerequisite
Phase K (Onboarding)    → depends on C
Phase L (Modal)         → depends on A2
Phase M (CSS)           → best done alongside C, F, G, H
Phase N (Copy/terms)    → alongside any screen PR
Phase O (code quality)  → ongoing, bundle with relevant screen PRs
```

**Recommended PR sequence:**
1. **PR-1:** Phase A (all P0 bugs — A1 through A8)
2. **PR-2:** Phase B + Phase L (lifecycle + modal fixes)
3. **PR-3:** Phase C + Phase M (sidebar redesign + full CSS overhaul) — largest PR
4. **PR-4:** Phase D (video→chat integration)
5. **PR-5:** Phase E (space view consolidation)
6. **PR-6:** Phase F + Phase N3 (Now screen + post action labels)
7. **PR-7:** Phase G (Discover screen)
8. **PR-8:** Phase H + Phase I (Chats + Compose)
9. **PR-9:** Phase J + Phase K (Settings + Onboarding)
10. **PR-10:** Phase N + Phase O (copy pass + code quality cleanup)

---

## Non-Goals (out of scope for this plan)

- Changing the network, embedding, or state management layers
- Adding new features not present in the current UI (search, threads, reactions)
- Switching away from vanilla JS to a framework
- Changing the E2E test suite beyond updating broken selectors caused by HTML restructuring
- Altering `services/channelSettings.js`, `services/peerProximity.ts`, or other
  specialized service files unless directly called out above
