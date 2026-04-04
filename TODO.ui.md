# ISC UI — Work Queue

Current branch: `main`. Tests run via `npx playwright test` against `http://localhost:3000`.

---

## Status Legend
- `[x]` Done
- `[ ]` Pending
- `[~]` In progress

---

## Completed (this sprint)

- [x] Node relay crash: removed duplicate `node.handle([TIER_PROTOCOL], ...)` in `apps/node/src/index.ts` — `registerTierNegotiation()` already registers the handler
- [x] Sidebar nav testids renamed `snav-{name}` → `nav-tab-{name}` so tests can find and click them on desktop
- [x] `updateSidebar()` now sets `btn.setAttribute('data-active', String(active))` — queryable by tests
- [x] `app.js` `initLayout()` wraps sidebar in `sidebarWithTabBar` proxy so every route change also calls `layout.updateTabBar(route)`, keeping mobile tab bar in sync
- [x] `now.js`: `renderNoChannels()` output wrapped in `<div data-testid="now-empty-state">` + hidden `<div data-testid="now-empty-cta">`
- [x] `chats.js`: `renderEmptyConv()` wrapped in `<div data-testid="empty-conversations">`
- [x] `waitHelpers.ts`: `waitForNavigation()` rewritten to use screen-level testids instead of `nav-tab-{name}[data-active="true"]`
- [x] `browser-flows.spec.ts`: full rewrite — `createChannel()` helper, Channel Management, Posts & Feed, Navigation, Accessibility, Discovery suites all updated to match actual UI

---

## E2E Test Fixes — 7 Remaining Failures

### 1. `createChannel()` helper timing  *(fixes "can like a post" + "Channel screen shows neighbor panel")*

**Root cause**: `saveBtn` handler in `channelEdit.js` runs `await networkService.createChannel(...)` then sets `actions.setActiveChannel()` then closes the modal. The helper currently waits for `[data-testid="irc-layout"]` which is **always in the DOM** — it returns immediately after clicking save, before the async create resolves, so `activeChannelId` is not yet set when the next step runs.

**File**: `tests/e2e/browser-flows.spec.ts`

```ts
async function createChannel(page: any, name: string, description: string) {
  await page.click('[data-testid="new-channel-btn"]');
  await page.waitForSelector('[data-testid="channel-edit-body"]', { timeout: 5000 });
  await page.fill('[data-testid="channel-edit-name"]', name);
  await page.fill('[data-testid="channel-edit-description"]', description);
  await expect(page.locator('[data-testid="channel-edit-save"]')).toBeEnabled({ timeout: 3000 });
  await page.click('[data-testid="channel-edit-save"]');
  // Replace `waitForSelector('irc-layout')` with modal-detach wait:
  await page.waitForSelector('[data-testid="channel-edit-body"]', { state: 'detached', timeout: 15000 });
}
```

---

### 2. `navigates between all main tabs`  *(Navigation suite)*

**Root cause**: Sidebar guards `/channel` click: if `!getState().activeChannelId` → fires `isc:new-channel` event instead of navigating. No channel exists yet when the test runs, so `waitForNavigation(page, 'channel')` waits forever for `[data-testid="channel-screen"]` that never appears.

**File**: `tests/e2e/browser-flows.spec.ts`

```ts
test('navigates between all main tabs', async ({ page }) => {
  await createChannel(page, 'Nav Test', 'A channel for testing tab navigation across all screens');
  for (const tab of ['now', 'channel', 'chats', 'settings'] as const) {
    await page.click(`[data-testid="nav-tab-${tab}"]`);
    await waitForNavigation(page, tab);
    await expect(page.locator(`[data-testid="${tab}-screen"]`)).toBeVisible();
  }
});
```

---

### 3. `app container renders on mobile viewport`  *(PWA Features suite)*

**Root cause**: `waitForAppReady()` calls `page.waitForSelector('[data-testid="sidebar"]')` which defaults to `state: 'visible'`. On mobile, `applyMobileLayout()` adds class `hidden` to the sidebar wrapper div, making the `<aside data-testid="sidebar">` CSS-invisible. The selector waits for visibility and times out.

**File**: `tests/e2e/utils/waitHelpers.ts`

```ts
export async function waitForAppReady(page: Page, timeout?: number): Promise<void> {
  await page.waitForSelector('[data-testid="irc-layout"]', { timeout });
  await page.waitForSelector('[data-testid="sidebar"]', { state: 'attached', timeout });
  //                                                       ^^^^^^^^^^^^^^^^^^^
  // DOM presence is sufficient; sidebar is CSS-hidden on mobile but still in DOM.
}
```

---

### 4. `each main screen has exactly one h1`  *(Accessibility suite)*

**Root cause**: Same as #2 — no active channel → channel tab opens modal → `waitForNavigation(page, 'channel')` times out.

**File**: `tests/e2e/browser-flows.spec.ts`

```ts
test('each main screen has exactly one h1', async ({ page }) => {
  await createChannel(page, 'H1 Test', 'A channel for accessibility heading count testing');
  for (const tab of ['now', 'channel', 'chats', 'settings']) {
    await page.click(`[data-testid="nav-tab-${tab}"]`);
    await waitForNavigation(page, tab);
    const h1Count = await page.locator('h1').count();
    expect(h1Count, `${tab} screen should have 1 h1`).toBe(1);
  }
});
```

> **Verify**: `channel.js` `renderHeader()` renders `<h1 class="channel-screen-title">` — confirmed, exactly one h1 per screen.

---

### 5. `status bar is visible`  *(Accessibility suite)*

**Root cause**: Test uses `[data-testid="status-bar"]`. Actual testid in sidebar (line 70 of `sidebar.js`): `data-testid="sidebar-status"`.

**File**: `tests/e2e/browser-flows.spec.ts`

```ts
test('status bar is visible', async ({ page }) => {
  await expect(page.locator('[data-testid="sidebar-status"]')).toBeVisible();
});
```

---

### 6. `UI Health Checks › all tabs are clickable`  *(ui-health.spec.ts)*

**Root cause**: `beforeEach` does `page.goto('/')` then `page.evaluate(() => localStorage.setItem(...))`. The app has already initialized and shown the onboarding modal before the `evaluate` runs. Modal overlay intercepts all subsequent clicks.

**File**: `tests/e2e/ui-health.spec.ts`

```ts
test.beforeEach(async ({ page }) => {
  page.on('console', msg => { ... });
  page.on('pageerror', error => { ... });

  // Must run BEFORE page.goto so the app reads it during init:
  await page.addInitScript(() => {
    localStorage.setItem('isc-onboarding-completed', 'true');
  });
  await page.goto('/');
});
```

---

### 7. `save button disabled until name and description meet minimums`  *(Channel Management suite)*

**Affected by Feature A below** — once description becomes optional the test assertions must be updated. See Feature A section.

---

## Feature A — Optional Channel Description

**Design intent**: Getting started should be frictionless. A name alone is enough to place the user in semantic space. The description is a refinement, not a requirement. If description is blank, the name is used as the embedding text.

### Changes

#### `apps/browser/src/services/channelService.ts`
- Remove the `description.length < 10` hard error.
- Before passing to `channelManager.createChannel()`, compute `effectiveDescription`:
  ```ts
  const effectiveDescription = input.description?.trim() || input.name.trim();
  ```
  Pass `effectiveDescription` as the description. This ensures the embedding is always non-empty (name is the minimum meaningful signal) and the channel's stored `description` field reflects what was actually embedded.

#### `apps/browser/src/vanilla/components/channelEdit.js`

1. **`validate()` function** — remove description length check:
   ```js
   function validate() {
     const name = nameInput.value.trim();
     saveBtn.disabled = name.length < 3;
   }
   ```

2. **`saveBtn` click handler** — remove the `description.length < 10` guard:
   ```js
   if (name.length < 3) {
     showError(errorEl, 'Channel name must be at least 3 characters.');
     return;
   }
   // No description check — service layer handles fallback to name
   ```

3. **Form hint text** — update to communicate optional status:
   - Label: `"Description"` → `"Description (optional)"`
   - Hint: `"This is what gets embedded. Your text is processed locally — nothing leaves your device."` → `"If left blank, your channel name is used as the semantic fingerprint. Processed locally — nothing leaves your device."`
   - Name hint: `"3–50 characters"` stays.

4. **Placeholder text** for description textarea — update to something less demanding:
   - Current: `"What are you thinking about right now? Be specific — this is your semantic fingerprint."`
   - New: `"Optional. The more you say, the more precisely you'll be matched."`

#### `tests/e2e/browser-flows.spec.ts` — update validation test

The `save button disabled until name and description meet minimums` test currently expects save to be disabled with a 26-char description after a short name. After this change, save is enabled as soon as name ≥ 3 chars:

```ts
test('save button is disabled until name meets minimum', async ({ page }) => {
  await page.click('[data-testid="new-channel-btn"]');
  await page.waitForSelector('[data-testid="channel-edit-body"]', { timeout: 5000 });

  const saveBtn = page.locator('[data-testid="channel-edit-save"]');
  await expect(saveBtn).toBeDisabled();

  await page.fill('[data-testid="channel-edit-name"]', 'Hi'); // < 3 chars
  await expect(saveBtn).toBeDisabled();

  await page.fill('[data-testid="channel-edit-name"]', 'Valid name'); // ≥ 3 chars, no description
  await expect(saveBtn).toBeEnabled();

  await page.click('[data-testid="channel-edit-cancel"]');
});
```

Also update the `createChannel()` helper calls that pass a long description — they still work fine (description is still used when provided). No other test changes needed.

---

## Feature B — Delete Channel Button in Channel Header

**Design intent**: Channel management should be available from within the channel itself, not only from Settings. A 'Delete' button in the channel header (near the title) lets the user remove the active channel without leaving the screen.

### Changes

#### `apps/browser/src/vanilla/screens/channel.js` — `renderHeader()`

Add a delete button inside `.header-channel-identity`, visible only when `activeChannel` exists. Place it after the `channel-title-row` div, before the description paragraph, or inline in the title row as a ghost icon button.

Recommended placement: as a ghost icon button at the end of `channel-title-row`:

```js
function renderHeader(activeChannel, connected, connLabel) {
  // ... existing relation pills, breadth badge ...

  return `
    <div class="screen-header channel-header" data-testid="channel-header">
      <div class="header-channel-identity">
        ${activeChannel
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
        ...
      </div>
    </div>
  `;
}
```

#### `apps/browser/src/vanilla/screens/channel.js` — `bind()` function

Add a delegated click handler for `.channel-delete-btn`:

```js
// In bind(container):
bindDelegate(container, '[data-testid="channel-delete-btn"]', 'click', async () => {
  const { activeChannelId, channels } = getState();
  const channel = channels?.find(c => c.id === activeChannelId);
  if (!channel) return;

  const confirmHtml = `
<div class="modal-header"><h2 class="modal-title">Delete channel?</h2></div>
<div class="modal-body">
  <p>Are you sure you want to delete <strong>#${escapeHtml(channel.name)}</strong>?</p>
  <p class="text-muted">This cannot be undone.</p>
</div>
<div class="modal-actions">
  <button class="btn btn-ghost" data-action="cancel">Cancel</button>
  <button class="btn btn-danger" data-action="confirm" data-testid="confirm-delete-channel">Delete</button>
</div>`;

  const overlay = modals.open(confirmHtml);

  overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => modals.close());
  overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
    modals.close();
    try {
      await networkService.deleteChannel(activeChannelId);
      toasts.success('Channel deleted');
      window.location.hash = '#/now';
    } catch (err) {
      toasts.error('Failed to delete channel');
    }
  });
});
```

#### `apps/browser/src/vanilla/styles/irc.css` (if needed)

Add style for `.btn-danger-ghost` if not already present:

```css
.btn-danger-ghost {
  color: var(--color-error, #e55);
  background: transparent;
  border: none;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.btn-danger-ghost:hover {
  opacity: 1;
}
```

Check first — this class may already exist in the stylesheet.

#### `tests/e2e/browser-flows.spec.ts` — add test to Channel Management suite

```ts
test('can delete active channel from channel header', async ({ page }) => {
  await createChannel(page, 'Deletable', 'A channel that will be deleted from the header');
  await page.click('[data-testid="nav-tab-channel"]');
  await waitForNavigation(page, 'channel');

  await page.click('[data-testid="channel-delete-btn"]');
  await page.waitForSelector('[data-testid="modal-overlay"]', { timeout: 3000 });
  await page.click('[data-testid="confirm-delete-channel"]');

  await waitForToast(page, 'Channel deleted', 3000);
  // Should navigate back to Now screen
  await waitForNavigation(page, 'now');
  await expect(page.locator('[data-testid="now-screen"]')).toBeVisible();
});
```

---

## Feature C — Block Peer Entry Points

**Context**: `modals.showPeerProfile(peer)` in `modal.js` is fully implemented — it renders a peer profile modal with Block/Unblock buttons that correctly call `moderationService.block/unblock`. Settings already lists and unblocks peers. The gap is that nothing calls `showPeerProfile()` from the main surfaces.

Two entry points needed:

### C1. Author popover in Channel screen → Peer Profile

`showAuthorPopover()` in `channel.js` (line 873) is a custom inline popover with only "Message →" and "Close". It should include a "View Profile" path that opens the full peer profile modal, which has block/unblock.

**File**: `apps/browser/src/vanilla/screens/channel.js` — `showAuthorPopover()`

The peer object must be looked up from state before calling `showPeerProfile`:
```js
function showAuthorPopover(postCard, peerId, authorName) {
  // ... existing popover HTML ...
  // Add to popover innerHTML:
  // <button class="btn btn-sm btn-ghost author-popover-profile" data-peer-id="${peerId}">View Profile</button>

  popover.querySelector('.author-popover-profile')?.addEventListener('click', () => {
    popover.remove();
    const peer = networkService.getMatches?.()?.find(p => p.peerId === peerId)
      ?? { peerId, identity: { name: authorName, bio: '' }, similarity: null, online: false };
    modals.showPeerProfile(peer);
  });
}
```

`modals` is already imported in `channel.js`.

### C2. Chat "⋮" More menu → Block Peer

The chat header's more button opens a modal with "Send File" and "Send Photo". Add "Block Peer" with confirmation.

**File**: `apps/browser/src/vanilla/screens/chats.js` — click handler for `[data-chat-more]`

Add a third item to the more menu modal:
```js
<button class="chat-more-item danger" data-action="block-peer" data-testid="block-peer-action">
  <span class="chat-more-icon">🚫</span>
  <span class="chat-more-label">Block Peer</span>
  <span class="chat-more-desc">Stop receiving messages from this person</span>
</button>
```

Handler:
```js
overlay.querySelector('[data-action="block-peer"]')?.addEventListener('click', () => {
  modals.close();
  // reuse peer profile modal for block confirmation flow
  const peer = networkService.getMatches?.()?.find(p => p.peerId === peerId)
    ?? { peerId, identity: { name: '?', bio: '' }, similarity: null };
  modals.showPeerProfile(peer);
});
```

`networkService` and `modals` are already imported in `chats.js`.

### Tests

Add to `browser-flows.spec.ts` under a new "Moderation" suite:
```ts
test.describe('Moderation', () => {
  test('author popover offers View Profile button', async ({ page }) => {
    await createChannel(page, 'Feed Test', 'A channel for moderation testing');
    // inject a post from a different peer then check popover
    // (can be done by injecting via ISC.feedService or checking the element exists after post)
  });

  test('chat more menu has block peer option', async ({ page }) => {
    await injectMatches(page, [{ peerId: 'e2e-block-test-0001', name: 'Eve', similarity: 0.8 }]);
    await injectChatMessages(page, 'e2e-block-test-0001', [{ content: 'Hello', fromMe: false }]);
    await page.click('[data-testid="nav-tab-chats"]');
    await waitForNavigation(page, 'chats');
    await forceRerender(page, 'chats');
    const convItem = page.locator('[data-peer-id]').first();
    if (await convItem.count() > 0) {
      await convItem.click({ force: true });
      await page.click('[data-testid="chat-more-btn"]');
      await page.waitForSelector('[data-testid="block-peer-action"]', { timeout: 3000 });
      await expect(page.locator('[data-testid="block-peer-action"]')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });
});
```

---

## Feature D — Space View: Fix Initial-Render Bug + Use Real Canvas

**Context**: Two separate "space" code paths exist in `channel.js`:

1. **`handleViewChange` event** (when user picks "🌌 Space" from the dropdown): replaces `#now-feed` with a `<canvas>` and calls `initSpaceCanvas` with real UMAP projection of **peers**. This works correctly.

2. **`renderSpacePosts()` / `renderSpacePosts()`** (called during initial `render()` and `update()` when `settings.viewMode === 'space'`): renders HTML `.space-post` cards with fake pseudo-random positioning based on post ID hash. The user marker is hardcoded to center (50%, 50%). This is the broken path — it only runs when the view was persisted as 'space' from a previous session.

**The fix (intentionally minimal — space view will be expanded later):**

In `bind()`, after setting up `handleViewChange`, immediately trigger canvas initialization if the current persisted viewMode is already 'space':

**File**: `apps/browser/src/vanilla/screens/channel.js` — `bind(container)`

```js
// At the end of the view-change setup block in bind():
const { activeChannelId, channels } = getState();
const activeChannel = channels?.find(c => c.id === activeChannelId);
const initialViewMode = activeChannel
  ? channelSettingsService.getSettings(activeChannel.id).viewMode
  : 'list';

if (initialViewMode === 'space') {
  // Trigger the same canvas init path as the dropdown would
  document.dispatchEvent(new CustomEvent('isc:channel-view-change', { detail: { mode: 'space' } }));
}
```

This reuses the existing working path. No new canvas code needed.

Also: `renderSpacePosts()` and `renderUserMarker()` should NOT be called from `renderPosts()` when `viewMode === 'space'` anymore (since canvas takes over). Replace with a loading placeholder that `bind()` replaces immediately:

```js
// In renderPosts():
if (viewMode === 'space') {
  return `<div class="space-canvas-placeholder" data-testid="space-canvas-placeholder">
    <canvas id="space-canvas" class="space-canvas" data-testid="space-canvas"></canvas>
  </div>`;
}
```

> **Note**: Keep `renderSpacePosts` in file but unused for now — space view will be substantially expanded soon. The canvas currently shows PEER positions; post positions in space will be addressed in the upcoming space expansion.

---

## Misc Edge Cases

### M1. Settings: "Thought Twin" and "Bridge Moments" placeholders never resolve

`apps/browser/src/vanilla/screens/settings.js` renders two divs that say `"Loading…"` but no code ever populates them:
- `<div id="thought-twin-container">Loading…</div>`
- `<div id="bridge-moment-list">Loading…</div>`

Both services are fully implemented: `thoughtTwin.ts` (`getThoughtTwin()`, `shouldShowThoughtTwinNotification()`) and `peerProximity.ts` (`getBridgeMomentCandidates()`).

**Fix**: In settings.js `bind()`, after the DOM is ready, load and render both:
```js
import { getThoughtTwin } from '../../services/thoughtTwin.ts';
import { getBridgeMomentCandidates } from '../../services/peerProximity.ts';

// In bind():
const twin = await getThoughtTwin();
const twinEl = container.querySelector('#thought-twin-container');
if (twinEl) {
  twinEl.innerHTML = twin
    ? `<div class="thought-twin-card">
         <span class="twin-name">${escapeHtml(twin.identity?.name ?? 'Anonymous')}</span>
         <span class="twin-sim">${Math.round(twin.similarity * 100)}% match</span>
       </div>`
    : '<p class="text-muted">Meet more people to discover your thought twin.</p>';
}

const bridges = getBridgeMomentCandidates();
const bridgeEl = container.querySelector('#bridge-moment-list');
if (bridgeEl) {
  bridgeEl.innerHTML = bridges.length
    ? bridges.map(b => `
        <div class="bridge-moment-item" data-peer-id="${escapeHtml(b.peerId)}">
          <span>${escapeHtml(b.identity?.name ?? 'Unknown')}</span>
          <span class="bridge-sim">${Math.round(b.avgSimilarity * 100)}% match · ${b.sessionCount} sessions</span>
          <button class="btn btn-sm btn-primary" data-action="start-chat"
                  data-peer-id="${escapeHtml(b.peerId)}">Say hi →</button>
        </div>`).join('')
    : '<p class="text-muted">Bridge moments appear when you share semantic space with a peer across multiple sessions without having connected.</p>';
}
```

Add delegated click handler in settings `bind()` for `[data-action="start-chat"][data-peer-id]` → navigate to chats.

### M2. Identity Import broken

Settings has an Export button (works). Import has a `<input type="file">` but the file `change` handler that calls `identityService.import()` is never bound.

**File**: `apps/browser/src/vanilla/screens/settings.js` — `bind()`

Find the import input and wire it:
```js
container.querySelector('#identity-import-input')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await identityService.import(data);
    toasts.success('Identity imported — reloading...');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    toasts.error('Import failed: ' + err.message);
  }
});
```

> Verify the input's actual `id` attribute in settings.js before implementing.

### M3. Now screen: neighbor count is global, not per-channel

`renderChannelRow()` in `now.js` reads `discoveryService.getMatches()` for EVERY channel row, showing the same count on all. This is technically correct (global peer matches), but implies a per-channel relationship. Consider either:
- Removing the neighbor count from channel rows (or moving it to a single header-level indicator), or
- Labeling it more accurately: "X peers in your network" not "X neighbors" on each row

Low priority cosmetic issue — no code change yet, just note it.

### M4. `isc:send-file` / `isc:send-photo` events never handled

Chats "⋮" more menu dispatches `isc:send-file` event but nothing listens for it. `enhancedFileTransfer.ts` is complete. This is a larger feature — defer until a dedicated file-sharing pass.

**For now**: Either remove the "Send File" / "Send Photo" buttons from the more menu, or leave them with a not-yet-implemented toast:
```js
overlay.querySelector('[data-action="send-file"]')?.addEventListener('click', () => {
  modals.close();
  toasts.info('File sharing coming soon');
});
```

This prevents the silent no-op that currently confuses users.

### M5. Serendipity mode has no discoverable UI trigger  `[x] Done`

**Implemented**: A "✦ Serendipity" toggle button in the Now screen header (next to the network badge).
- Shows chaos level percentage when active (e.g., "✦ 50%")
- Toggles between 0% (off) and 50% (on) on click
- Dispatches `isc:toggle-chaos` event to sync with existing settings toggle
- Re-renders the Now screen to reflect updated state

### M6. Reply button creates a quoted post, not a threaded reply  `[x] Done`

**Fixed**: Changed `postService.reply(...)` → `postService.replyToPost(...)` in the ChannelScreen submit handler.
The `replyToPost` method properly creates a post with `replyTo` set to the parent post ID, stores it in IndexedDB,
and returns the reply. Reply context UI (compose-reply-context) was already working.

Also removed the unnecessary `isc:reply-post` event dispatch from `#handleReply` — the class-based screen handles
reply state directly via `#replyTo` and `#setReplyContext`, avoiding a route re-render that was clearing the visual reply context.

> This requires verifying that `networkService.createPost()` or `postService.create()` accepts a `replyToId` parameter. May need a small addition to the post creation signature.

### M7. Channel screen: relation pills have no hover cursor

`relation-pill` elements in the channel header are clickable (they open channelEdit), but `cursor: pointer` is not set. Check `irc.css` for `.relation-pill` — add `cursor: pointer` if absent.

---

## Execution Order

1. **`tests/e2e/utils/waitHelpers.ts`** — fix `waitForAppReady` mobile sidebar visibility (fix #3)
2. **`tests/e2e/browser-flows.spec.ts`** — fix `createChannel()` helper (fix #1, unblocks #2 and #4)
3. **`tests/e2e/browser-flows.spec.ts`** — fix `navigates between all main tabs` (fix #2)
4. **`tests/e2e/browser-flows.spec.ts`** — fix `each main screen has exactly one h1` (fix #4)
5. **`tests/e2e/browser-flows.spec.ts`** — fix `status bar is visible` selector (fix #5)
6. **`tests/e2e/ui-health.spec.ts`** — fix `beforeEach` to use `addInitScript` (fix #6)
7. **Verify**: run `npx playwright test tests/e2e/browser-flows.spec.ts tests/e2e/ui-health.spec.ts`
8. **`apps/browser/src/services/channelService.ts`** — relax description validation, apply name fallback (Feature A)
9. **`apps/browser/src/vanilla/components/channelEdit.js`** — relax `validate()`, update hint/placeholder text (Feature A)
10. **`tests/e2e/browser-flows.spec.ts`** — update validation test for optional description (Feature A)
11. **`apps/browser/src/vanilla/screens/channel.js`** — add delete button to `renderHeader()` and handler in `bind()` (Feature B)
12. **`apps/browser/src/vanilla/styles/irc.css`** — add `.btn-danger-ghost` if not present (Feature B)
13. **`tests/e2e/browser-flows.spec.ts`** — add channel header delete test (Feature B)
14. **`apps/browser/src/vanilla/screens/channel.js`** — fix `showAuthorPopover()` to add View Profile entry point (Feature C1)
15. **`apps/browser/src/vanilla/screens/chats.js`** — add Block Peer to chat more menu (Feature C2)
16. **`apps/browser/src/vanilla/screens/channel.js`** — fix space view initial-render bug in `bind()`, replace `renderSpacePosts` with canvas placeholder (Feature D)
17. **`apps/browser/src/vanilla/screens/settings.js`** — wire Thought Twin + Bridge Moments (M1)
18. **`apps/browser/src/vanilla/screens/settings.js`** — wire identity import file input (M2)
19. **`apps/browser/src/vanilla/screens/chats.js`** — replace silent no-op for file send with "coming soon" toast (M4)
20. **`apps/browser/src/vanilla/screens/channel.js`** — fix reply to pass `replyToId` through post creation (M6)
21. **Final**: `npx playwright test` — full suite

---

## Notes

- `bindDelegate` is imported from `../utils/screen.js` and already used in `channel.js` — use it for the delete button handler.
- `modals` is already imported in `channel.js`.
- `networkService` is already imported in `channel.js`.
- `toasts` is already imported in `channel.js`.
- After Feature A, `channel.description` will always be a non-empty string (set to name if blank) — no UI needs to defensively handle empty description.
- The Settings screen's existing channel delete path (`delete-channel-btn`) is unaffected by Feature B.
- `createChannel()` test descriptions must be ≥ 10 chars only until Feature A lands; after that only name ≥ 3 chars is required. Update descriptions in existing test calls after Feature A is complete.
- `modals.showPeerProfile()` already has full block/unblock/start-chat UI — the only missing piece (Feature C) is entry points to call it.
- Space view canvas (Feature D) already does real UMAP — the bug is only in the initial-render path when `viewMode='space'` is persisted from settings.
