# ISC Web UI — Phase 2: Semantic Attention Networks & Relay Testing

**Status**: Plan approved 2026-03-23
**Purpose**: Phase 2 supersedes TODO.ui.md. Rolls forward incomplete items, adds strategic features, and addresses E2E test gaps for multi-user relay scenarios.

---

## Summary

### Key Findings from Code Audit

1. **E2E relay testing**: All relay-aware tests are `test.fixme`. Multi-user tests inject state synthetically rather than routing through actual relay. No passing test verifies messages traverse relay between two browser contexts.

2. **"Space view in Now panel"**: Doesn't exist. The Space view dropdown only lives in the Channel screen. The user's expectation of a bird's-eye semantic map on the home dashboard is a *new feature*.

3. **Settings organization**: 11 sections on one 2500px-tall page with no navigation. Needs tabs.

---

## Part 1: E2E Tests — Multi-User Relay Coverage

### Current State

`semantic-routing.spec.ts` has all relay+WebRTC scenarios marked `test.fixme`. `multi-context.spec.ts` uses synthetic state injection via `window.ISC` debug API. Channel isolation tests exist but verify absence of injection, not active routing suppression.

### T0. Verify Carried-Forward E2E Items (TODO.ui.md)

Run full E2E suite. Document pass/fail status. Fix any remaining failures from:
- E2E fixes #1, #2, #4 (createChannel timing, nav test, h1 accessibility)
- Feature A (optional description) — verify save button enables on name ≥ 3 chars, no description
- Feature C1 (author popover → View Profile)
- Feature C2 (chat more menu → Block Peer)
- M4 (file sharing "coming soon" stub)
- M6 (reply threading with parentId)

**File**: `tests/e2e/browser-flows.spec.ts`, `tests/e2e/utils/waitHelpers.ts`

```sh
npx playwright test tests/e2e/browser-flows.spec.ts tests/e2e/ui-health.spec.ts
```

### T1. Semantic Attention Network E2E Tests

**New test suite**: `tests/e2e/semantic-attention.spec.ts` — 4 passing tests + 1 fixme

These tests use state injection (same pattern as multi-context tests) but cover scenarios not
previously tested.

#### T1a. Channel Overlap — Two Users Discover Each Other

```
Alice creates #distributed-systems
Bob creates #p2p-networks
Inject Alice as Bob's match with similarity 0.8
Inject Bob as Alice's match with similarity 0.8

Assert: Alice navigates to Discover, sees Bob
Assert: Bob navigates to Discover, sees Alice
Assert: Both show similarity ≥ 0.7
```

**Why this matters**: Positive case for semantic attention — similar channels → mutual discovery

#### T1b. Channel Non-Overlap — Different Topics Isolated

```
Alice creates #distributed-systems
Carol creates #sourdough-baking
Do NOT inject Carol into Alice's matches

Assert: Alice navigates to Discover, Carol NOT visible
Assert: Carol's posts do NOT appear in Alice's feed
Assert: Alice's posts do NOT appear in Carol's feed
```

**Why this matters**: Negative case — different topics don't interfere

#### T1c. Semantic Attention Diversity — User with 3 Channels Sees Segmented Neighborhoods

```
User creates #ai-ethics, #jazz-music, #climate-science

Inject matches:
  Alice (AI focus, sim 0.9)
  Bob (jazz focus, sim 0.85)
  Carol (climate focus, sim 0.92)
  Dave (AI + climate bridge, sim 0.7 to both)

Switch to #ai-ethics → neighbors panel shows [Alice, Dave]
Switch to #jazz-music → neighbors panel shows [Bob]
Switch to #climate-science → neighbors panel shows [Carol, Dave]
```

**Why this matters**: Positive case — curating diverse channels creates different semantic spaces

#### T1d. Block Peer — Blocked User Posts Disappear End-to-End

```
Inject Alice and Bob into matches, inject posts from both

Click Alice's author popover → "View Profile" → "Block"
Confirm block in modal

Assert: Alice no longer appears in Discover
Assert: Alice's posts no longer appear in feed
Assert: Block persists across navigation and re-render
```

**Why this matters**: Negative case — moderation works end-to-end

#### T1e. Relay Dependency Test (fixme)

```ts
test.fixme('Alice and Bob route through relay when direct WebRTC fails', async ({ browser }) => {
  // Expected behavior (when WebRTC in headless Chromium works):
  // 1. Start relay at :9090
  // 2. Create two isolated contexts, configure them to use relay
  // 3. Alice posts on #distributed-systems
  // 4. Relay receives message via circuit relay + gossipsub
  // 5. Bob (behind symmetric NAT) receives post via relay within 5 seconds
  // 6. Bob's feed shows Alice's post

  // Currently blocked by: headless Chromium + WebRTC STUN negotiation limitations
  // When unblocked: connect to TEST_RELAY_ADDR, await stable WebRTC before posting
  // See semantic-routing.spec.ts for scaffolding (comment at line 47)
});
```

**Files to create/modify:**
- `tests/e2e/semantic-attention.spec.ts` (new)
- `tests/e2e/utils/waitHelpers.ts` (add helpers if needed)

---

## Part 2: Space View in the Now Screen

### What the User Expected

A **Semantic Map** on the home dashboard — a bird's-eye 2D projection showing:
- All user's channels as colored anchor nodes
- Discovered peers as dots around them, sized by similarity
- The semantic topology of the user's "attention network"

This makes ISC's core concept — semantic proximity — visually immediate.

### N1. Semantic Map Panel in Now Screen

**Design**: Collapsible canvas panel between header and channel list.

- **Collapsed state**: "Your 3 channels span 3 distinct regions" (one-liner)
- **Expanded state**: UMAP/PCA canvas showing all channels + all peer matches
- **Only shown** when user has ≥ 2 channels (otherwise no topology to display)
- **Interactions**:
  - Click peer dot → navigate to Discover, filtered to that peer
  - Click channel node → set active channel, navigate to Channel screen
  - Collapse/expand toggle persisted to `localStorage('isc:semantic-map-collapsed')`

**Implementation approach**: Extract `initSpaceCanvas` from channel.js into a shared utility module.
Reuse canvas logic but pass all-channels + all-peers dataset instead of per-channel posts.

**Files**:
- `apps/browser/src/vanilla/utils/spaceCanvas.js` (new — extract from channel.js)
- `apps/browser/src/vanilla/screens/now.js` (add renderSemanticMap, bindSemanticMap)
- `apps/browser/src/vanilla/styles/irc.css` (.semantic-map-panel styles)
- `apps/browser/src/vanilla/screens/channel.js` (import spaceCanvas from utils)

**HTML in now.js:**
```js
// In render(), between renderHeader and renderChannelRows:
${channels.length >= 2 ? renderSemanticMap(channels, matches) : ''}
```

---

## Part 3: Settings — Tab Organization

### Current State

11 sections on one 2500px-tall page. No navigation. Hard to discover specific settings.

### S1. Settings Tabs

**5-tab structure:**

| Tab | Sections | Rationale |
|-----|----------|-----------|
| **Profile** | Profile + Identity + Thought Connections | "Who am I" |
| **Network** | Discovery + Advanced (Serendipity) | "How I connect" |
| **Appearance** | Appearance & Preferences + Share | "How it looks" |
| **Channels** | My Channels | "What I'm thinking about" |
| **Privacy** | Moderation + Danger Zone + About | "Safety and control" |

**Implementation**: Minimal, no component library.

1. Add `<div class="settings-tabs">` with 5 `<button data-tab="X">` buttons in `render()`
2. Add `data-settings-tab="X"` attribute to each `<section>` (e.g., `<section data-settings-tab="profile">`)
3. In `bind()`, wire tab-click handler:
   - Remove `active` class from all tab buttons
   - Add `active` to clicked button
   - Hide all `[data-settings-tab]` sections
   - Show only sections matching `[data-settings-tab="tabName"]`
   - Save `tabName` to `localStorage('isc:settings-tab')`
4. On first load, check localStorage and activate that tab (default: "profile")

**CSS additions to irc.css:**
```css
.settings-tabs {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color);
}

.settings-tab {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.2s;
}

.settings-tab.active {
  color: var(--text-primary);
  border-bottom: 2px solid var(--accent-color);
}

[data-settings-tab] {
  display: none;
}

[data-settings-tab].active {
  display: block;
}
```

**Files**:
- `apps/browser/src/vanilla/screens/settings.js`
- `apps/browser/src/vanilla/styles/irc.css`

---

## Part 4: Per-Channel Neighbor Filtering

### Current State

`NeighborsComponent` in `vanilla/components/neighbors.js` already filters peers by channel specificity.
When initialized with `channelId`, it reads `channelSettingsService.getSettings(channelId).specificity`
and uses it as a threshold. Each match is scored with `channelScore` based on global similarity + topic
overlap + recency + online status.

### N2. Heuristic Per-Channel Filtering `[x] Done`

**Already implemented** in `neighbors.js` `#computeNeighbors()`:
- Filters by `effectiveThreshold = Math.max(opts.threshold, channelSpecificity)`
- Scores each match with `#computeChannelScore()` for channel-specific relevance
- Sorts by `channelScore` when in channel mode

**In now.js**: Remove per-channel neighbor counts (confusing — they're all the same global count).
Replace with single header badge: "X peers in network" or omit if confusing.

---

## Part 5: Usability Issues

### M3. Misleading Global Neighbor Count `[x] Done`

**Already fixed**: now.js no longer shows neighbor counts on channel rows. The peer count
appears once in the Now screen header as "X peers in network", which accurately reflects
the global discovery state.

### M7. Relation Pills Missing Cursor

**Problem**: `.relation-pill` elements are clickable but lack `cursor: pointer`.

**Fix**: In irc.css, find `.relation-pill` and add `cursor: pointer`.

### U1. Cold Start UX — No Peers Found

**Problem**: New users see empty feed immediately — ISC's value is invisible without peers.

**Fix**: On Now screen, if no peers discovered after 30 seconds:

```js
const noPeersAfterDelay = matches.length === 0 && timeSinceChannelCreation > 30000;
if (noPeersAfterDelay) {
  return `<div class="cold-start-banner">
    💡 More useful with more people. <button data-action="share-link">Share Link</button>
    or <button data-action="learn-relay">Connect via Relay</button>
  </div>`;
}
```

**File**: `apps/browser/src/vanilla/screens/now.js`

### U2. Network Health Visibility

**Problem**: Status badge only shows "Online" / "Offline". Users don't know peer count or relay status.

**Fix**: Expand Now screen header status:
```
● Online · 4 peers
```

Or if 0 peers:
```
● Online · no peers found — share your link or check relay
```

**File**: `apps/browser/src/vanilla/screens/now.js` — `renderHeader()`

### U3. Reply Threading — Verify Implementation

**Problem**: Reply button creates quoted post, not threaded reply. Reply counts always 0.

**Verification**: Does compose form submit handler pass `replyToId` to post creation?
- Check: `channel.js` compose handler → `postService.create()` signature
- If missing, add `replyToId` parameter and wire through to network layer

**File**: `apps/browser/src/vanilla/screens/channel.js`

### U4. Cross-Channel Semantic Feed ("Your Space")

**Problem**: No aggregate view of all channels' posts blended semantically.

**Fix**: On Now screen, add "See All" / "Your Space" button:
```js
${channels.length > 1 ? `<button class="btn btn-primary" data-action="see-all">
  Your Space (all channels)
</button>` : ''}
```

Clicking navigates to Channel screen with `activeChannelId = null`. The feed already exists
(`feedService.getForYou()`); just need to surface it.

**Label**: "Your Space" suggests the semantic map concept and cross-channel blending.

**File**: `apps/browser/src/vanilla/screens/now.js`

---

## Part 6: Strategic Assessment

### Is ISC a Revolution?

**The case for revolution:**
- Semantic proximity discovery is novel and defensible (vs. Bluesky, Mastodon, Twitter)
- Privacy-by-architecture (local embeddings, no accounts) is a real differentiator
- "Meet your thought neighbors" is clear and compelling
- Semantic attention network (curating channels as topic antennas) is unique
- Thought Twin and Bridge Moments have no equivalent elsewhere

**The case for concern:**
- P2P cold start problem — ISC only works if others are present
- WebRTC + NAT traversal fails silently in corporate/mobile networks
- Embedding model is ~22MB download, takes seconds to initialize
- No "follow" mechanic — can only match by semantic proximity
- Posts are ephemeral (TTL-based) — no permanent archive
- **The UI doesn't make semantic space visible immediately** — new users see a blank feed

### The Most Important Unlock

**Make the semantic map the default view.** When a user creates their first channel and embedding
completes, show them *immediately* where they sit in semantic space relative to other channels or
reference points. Even a mock map with 5–10 public demo channels would create the "aha moment"
that ISC depends on.

Without this visibility, ISC is invisible. With it, the value proposition becomes legible in
seconds.

### Questions Driving Phase 3

1. **Autonomy vs. accessibility**: Does ISC serve power users (semantic richness) or general users
   (magic)? The current UI serves neither well.

2. **Relay strategy**: Should there be an official public relay? Self-hosted only? Embedded
   supernode mode in the browser?

3. **Content persistence**: Is ephemerality intentional (privacy-first) or a limitation to overcome?

4. **Community formation**: How do 1000 people thinking about "AI safety" form a *community* vs.
   1000 isolated 1:1 connections?

5. **Moderation at scale**: Beyond blocking individuals, how does ISC handle coordinated abuse or
   semantic pollution?

---

## Execution Roadmap

### Phase 2A — Foundations
1. Run E2E suite, document pass/fail
2. Fix remaining TODO.ui.md items (A, C1, C2, M4, M6)
3. Fix M3 (neighbor labels), M7 (cursor:pointer)

### Phase 2B — Settings Tabs (S1)
4. Add tab HTML + data-attributes to settings.js
5. Wire tab click handler in bind()
6. Add CSS to irc.css
7. Add E2E tests for tab navigation

### Phase 2C — Semantic Map (N1)
8. Extract spaceCanvas.js from channel.js
9. Add renderSemanticMap/bindSemanticMap to now.js
10. Add CSS to irc.css
11. Write E2E test for canvas rendering

### Phase 2D — Multi-User E2E Tests (T1a–T1e)
12. Create semantic-attention.spec.ts
13. Implement T1a–T1d (4 passing tests)
14. Add T1e as fixme with documentation

### Phase 2E — Usability Polish (U1–U4)
15. Cold start banner (U1) `[x]`
16. Network health visibility (U2) `[x]`
17. Reply threading verification (U3) — `[x]` Fixed `postService.reply` → `replyToPost`, removed redundant `isc:reply-post` event
18. "Your Space" cross-channel feed (U4) `[x]`
19. Per-channel neighbor filtering (N2) `[x]`
20. Serendipity mode UI trigger (M5) `[x]`

---

## Testing Checklist

```sh
# After Phase 2A:
npx playwright test tests/e2e/browser-flows.spec.ts tests/e2e/ui-health.spec.ts

# After Phase 2B:
npx playwright test --grep "Settings"

# After Phase 2C:
npx playwright test --grep "semantic.*map"

# After Phase 2D:
npx playwright test tests/e2e/semantic-attention.spec.ts

# Full suite before PR:
npx playwright test
```

---

## Files Changed

| File | Action | Items |
|------|--------|-------|
| `TODO.ui2.md` | Create | This document |
| `tests/e2e/semantic-attention.spec.ts` | Create | T1a–T1e |
| `apps/browser/src/vanilla/utils/spaceCanvas.js` | Create | N1 |
| `apps/browser/src/vanilla/screens/now.js` | Modify | N1, U1, U2, U4, M5 |
| `apps/browser/src/vanilla/screens/settings.js` | Modify | S1 |
| `apps/browser/src/vanilla/screens/channel.js` | Modify | N1 (import), N2 (neighbor filter), M6 (reply threading) |
| `apps/browser/src/vanilla/styles/irc.css` | Modify | S1 tabs, N1 map, M7 cursor, M5 serendipity |
| `tests/e2e/browser-flows.spec.ts` | Modify | Settings tab tests |

---

**Plan approved**: 2026-03-23
**Ready to implement**: Phase 2A onward
