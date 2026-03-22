# ISC — Development Plan

---

## Screen Structure

| Screen | Route | Purpose |
|--------|-------|---------|
| **Now** | `/now` | Home dashboard — aggregated view across all active channels. Unread counts, latest message per channel, convergence events, bridge moments, network status. Default route. |
| **Channel** | `/channel` | Individual channel view — message stream for the active channel, compose bar, neighbor panel. The IRC channel window. |
| **Chats** | `/chats` | 1:1 direct messages. E2E encrypted WebRTC. |
| **Settings** | `/settings` | Profile, identity, thought twins, bridge moments, preferences. |

**ChannelEdit** is a modal, not a screen. No route. Triggered by:
- Sidebar `+` button → open empty (create new channel)
- Channel header edit button or sidebar channel item → open pre-filled (edit existing)
- `Ctrl+K` keyboard shortcut → open empty (create new channel)

One component, two call sites. The form is identical — name, description, spread/breadth.
On save: embed the description, announce to DHT, subscribe to new gossipsub bucket topics.
On cancel: no changes.

The sidebar channel list is the primary navigation between channels. Clicking a channel sets
it as active and navigates to `/channel`. The Now screen (`/now`) is the default route.

---

## What Went Wrong and Why

This section exists so the same mistakes are not made again.

### The core confusion: two mental models collided

ISC is **IRC with semantic channel discovery**. That is the correct mental model, stated
precisely:

> You describe what you are thinking about. That description is your channel.
> Your channel places you in a neighborhood of semantic space.
> Everyone whose channel lands in your neighborhood hears what you post — in their channel.
> You do not need to know they exist. They do not need to know you exist.
> The description is the address. The neighborhood is the channel.

What got built instead treated ISC as **a smarter Twitter**: posts have their own embeddings,
posts route individually by their own semantic content, a global feed is populated by broadcast
and filtered/ranked per-message. This is precisely what ISC is not. It shares none of the
novel properties and is indistinguishable in design from ordinary IRC with a similarity score
bolted on afterwards.

The confusion was encoded directly into the network layer. `browser.ts setupPubSub()` subscribed
to a single global topic `isc:posts:global`. Every post from every peer went to every connected
peer regardless of their channel. The semantic layer existed only for peer discovery (Discover
screen) but was entirely absent from content delivery (Now screen) — the two most important
halves of the system were built with different mental models.

### Why the UI is wrong

The Now screen was designed using Twitter/TikTok vocabulary:

- **"For You" feed** — implies algorithmic curation from a global pool. There is no global
  pool. You receive messages from your semantic neighborhood.
- **"Relevance" sort** — implies per-message semantic ranking. Messages are not individually
  embedded for routing. The channel is the semantic unit, not the post.
- **"Precision" slider** — implies filtering individual messages by how close they are to your
  interests. It should control channel announcement spread, not message filtering.
- **Unified feed across all channels** — conflates separate neighborhoods into one stream.

The result teaches users the wrong thing about what ISC is.

### Why the Discover screen is being removed

The Discover screen was a separate action — press a button, get a list of peers, decide to
chat. This is the Tinder/Twitter frame: browse strangers, initiate contact. It is not the ISC
frame.

In ISC, creating a channel IS discovery. The neighborhood populates itself. Peers reveal
themselves through their messages. No separate browsing step exists because none is needed.
The one genuine value of Discover — seeing peers who are in your neighborhood but haven't
posted yet (the IRC user list equivalent) — belongs as a panel within the channel view, not
as a separate screen requiring navigation and a manual trigger.

The Discover screen is removed. Its functionality is redistributed to where it logically belongs.

---

## Functionality Redistribution (nothing is lost)

| Was in Discover | Moves to |
|-----------------|----------|
| Peer list (who's in my neighborhood) | Now screen — neighbor panel (right sidebar) |
| Similarity score per peer | Neighbor panel |
| "Chat" / DM button | Neighbor panel + clicking any message sender |
| Peer profile modal | Neighbor panel + message sender tap |
| Bridge Moment banner | Settings / Profile screen |
| Convergence events | Now screen header (local notification banner) |
| "You need a channel" warning | Now screen empty state (already partially there) |
| Network status badge | Now screen header (already present) |
| Auto-discovery on session start | Triggered automatically on channel create/edit |

---

## Phase 0 — Blocking Bug Fixes

Do these first. They are independent of the routing changes and unblock testing.

### ✅ 0.1 Chat send button broken after conversation opens

**COMPLETED** — `bindChatInputHandlers()` moved from `bind()` to end of `openChat()`.

**File:** `apps/browser/src/vanilla/screens/chats.js`

`bindChatInputHandlers(container)` is called once in `bind()` when `#chat-input` and
`#chat-send` do not exist yet (no active chat). When `openChat()` later sets
`chatPanel.innerHTML`, new elements have no event listeners.

Fix: remove the `bindChatInputHandlers(container)` call from `bind()`. Call it at the end of
`openChat()`, after panel HTML is rendered.

### ✅ 0.2 Remove Discover screen crash rather than fix it

**ACKNOWLEDGED** — Not fixing; file will be deleted in Phase 3.

The `discover.js:416` crash (`const { channels } = channelService.getAll()`) is moot — the
file is being deleted in Phase 3. Do not invest time fixing it.

---

## Phase 1 — Core Network: Semantic Channel Routing

The central fix. Four coordinated changes to the network layer.

### ✅ 1.1 Extend the DHT interface with generic put/get

**File:** `packages/network/src/types.ts`

Add to the `DHT` interface:

```ts
put(key: string, value: Uint8Array, ttl: number): Promise<void>;
get(key: string, count: number): Promise<Uint8Array[]>;
```

**File:** `packages/network/src/libp2p-dht.ts`

`Libp2pDHT` already uses `networkAdapter.announce(key, bytes, ttl)` and
`networkAdapter.query(key, count)` internally. Implement `put` and `get` as direct wrappers —
the adapter already supports arbitrary keys.

**File:** `packages/network/src/dht.ts`

`InMemoryDHT` needs a second store for messages (used in dev/fallback mode):
`Map<string, Array<{ value: Uint8Array, expiresAt: number }>>`.
Implement `put` (append to key's list, enforce TTL) and `get` (return unexpired values for key).

### ✅ 1.2 Fix `createPost()` — route by channel embedding

**File:** `packages/network/src/browser.ts`

The channel is the semantic unit. Messages carry no independent routing embedding.
When a post is created, store it in the DHT under the **channel's** LSH bucket keys:

```ts
if (channel.embedding) {
  const hashes = lshHash(channel.embedding, 'allminilm', 20, 32);
  const payload = new TextEncoder().encode(JSON.stringify(post));
  for (const hash of hashes.slice(0, 5)) {
    await this.dht.put(`/isc/post/allminilm/${hash}`, payload, POST_TTL);
  }
}
```

`POST_TTL`: 24 hours default. The post contains no routing embedding — just its content,
author, channelId, and timestamp. Remove the per-post `this.embedding.compute(content)` call
that was being done for routing; it served the wrong model.

Simultaneously publish to per-channel gossipsub topics for real-time delivery (Phase 2).

Remove the `this.networkAdapter.publish('isc:posts:global', data)` call entirely.

### ✅ 1.3 Add `fetchMessagesForChannel(channel)` — pull from DHT

**File:** `packages/network/src/browser.ts`

Query the DHT for messages in the active channel's neighborhood. This handles offline
delivery — messages posted while you were away.

```ts
async fetchMessagesForChannel(channel: ChannelData): Promise<PostData[]> {
  if (!channel.embedding) return this.posts.filter(p => p.channelId === channel.id);

  const hashes = lshHash(channel.embedding, 'allminilm', 20, 32);
  const seen = new Map<string, PostData>();

  for (const hash of hashes) {
    const results = await this.dht.get(`/isc/post/allminilm/${hash}`, candidateCap);
    for (const bytes of results) {
      try {
        const post = JSON.parse(new TextDecoder().decode(bytes)) as PostData;
        if (!seen.has(post.id)) seen.set(post.id, post);
      } catch { /* skip malformed */ }
    }
  }

  // Own posts always included regardless of DHT state
  const local = this.posts.filter(p => p.channelId === channel.id);
  for (const p of local) seen.set(p.id, p);

  return [...seen.values()].sort((a, b) => b.createdAt - a.createdAt);
}
```

No cosine similarity filtering of individual messages. They are in the neighborhood or they
are not — that determination happens at the channel level, not the message level.

### ✅ 1.4 Remove the global gossipsub subscription

**File:** `packages/network/src/browser.ts`

Delete `setupPubSub()` and its call in `initialize()`. Replace with `subscribeChannelBuckets()`
per channel (Phase 2). The `isc:posts:global` topic is abandoned.

---

## Phase 2 — Real-Time: Per-Channel Gossipsub

DHT handles persistence and offline delivery. Gossipsub handles real-time delivery between
peers who are online simultaneously. They use the same LSH keys — same neighborhood, different
transport.

### ✅ 2.1 Subscribe to channel bucket topics on channel create/restore

**File:** `packages/network/src/browser.ts`

```ts
private subscribeChannelBuckets(channel: ChannelData): void {
  if (!this.networkAdapter?.subscribe || !channel.embedding) return;
  const hashes = lshHash(channel.embedding, 'allminilm', 20, 32);
  for (const hash of hashes.slice(0, 5)) {
    this.networkAdapter.subscribe(
      `/isc/gossip/allminilm/${hash}`,
      (data: Uint8Array) => this.receiveChannelMessage(data)
    );
  }
}
```

Call in `createChannel()` after channel is persisted, and in `initialize()` for each restored
channel once embeddings are confirmed present.

### ✅ 2.2 Publish to channel bucket topics on post

**File:** `packages/network/src/browser.ts`

Called from `createPost()` alongside the DHT `put`:

```ts
private async publishToChannelBuckets(channel: ChannelData, post: PostData): Promise<void> {
  if (!this.networkAdapter?.publish || !channel.embedding) return;
  const hashes = lshHash(channel.embedding, 'allminilm', 20, 32);
  const payload = new TextEncoder().encode(JSON.stringify(post));
  for (const hash of hashes.slice(0, 5)) {
    await this.networkAdapter.publish(`/isc/gossip/allminilm/${hash}`, payload);
  }
}
```

### ✅ 2.3 Handle incoming real-time messages

**File:** `packages/network/src/browser.ts`

```ts
private receiveChannelMessage(data: Uint8Array): void {
  try {
    const post = JSON.parse(new TextDecoder().decode(data)) as PostData;
    if (this.posts.some(p => p.id === post.id)) return;
    this.posts.unshift(post);
    this.events.onPostCreated?.(post);
  } catch { /* skip malformed */ }
}
```

`onPostCreated` already dispatches `isc:refresh-feed`, which the Now screen listens to.

### ✅ 2.4 Re-subscribe when channel description is edited

**File:** `packages/network/src/browser.ts`

Editing a channel description changes its embedding and therefore its LSH hashes. Add
`unsubscribeChannelBuckets(channel: ChannelData)` that mirrors `subscribeChannelBuckets`.
In the channel update flow: unsubscribe old topics → recompute embedding → subscribe new topics.

---

## Phase 3 — Rename, Restructure, Remove Discover

### ✅ 3.1 Rename: now.js → channel.js

**File:** `apps/browser/src/vanilla/screens/now.js` → rename to `channel.js`

Update all imports, route registrations, and event handler references accordingly.
Route: `/channel`. The screen title becomes the active channel name, not "Now."

### ✅ 3.2 Create the new Now home screen

**New file:** `apps/browser/src/vanilla/screens/now.js`

The Now screen is the default route (`/now`) and the first screen users see. It aggregates
across all active channels. Contents:

- **Per-channel summary rows** — for each active channel: channel name, latest message
  preview, unread message count, neighbor count. Clicking a row navigates to `/channel`
  and sets that channel as active.
- **"No channels yet" empty state** — "What are you thinking about? Create a channel to
  start." with a link to `/compose`. This replaces the equivalent banner that was on Discover.
- **Convergence events** — if any active channel has a convergence event, surface it here
  as a dismissable banner. Relevant to the user's overall state, not to any one channel.
- **Network status** — connection state, peer count across all channels.

This screen is intentionally read-only. Composing happens in the Channel screen. The Now
screen is for orientation and navigation.

### ✅ 3.3 Delete discover.js

**File:** `apps/browser/src/vanilla/screens/discover.js` — delete.

### ✅ 3.4 Update route registrations

**File:** `apps/browser/src/app.js`

- Register `/now` → new `now.js` (home dashboard). Set as default route.
- Register `/channel` → `channel.js` (renamed from now.js).
- Remove `/discover` registration.
- Remove `/compose` registration entirely — ChannelEdit is a modal, not a route.

### ✅ 3.5 Update sidebar nav

**File:** `apps/browser/src/vanilla/components/sidebar.js`

Nav strip becomes four items: Now (`⌂`), Channel (`#`), Chats (`◷`), Settings (`⚙`).
Remove the Discover button. Remove any Compose nav button.

Clicking a channel in the sidebar channel list sets it active and navigates to `/channel`.
The Channel nav button navigates to `/channel`. If no channel is active yet, open the
ChannelEdit modal directly rather than redirecting to a now-deleted `/compose` route.

### ✅ 3.6 Clean up router event handlers

**File:** `apps/browser/src/vanilla/router.js`

- Remove the `isc:discover-peers` event handler (lines 257–269).
- Remove the `isc:new-channel` handler that navigated to `/compose` — replace with a call
  to open the ChannelEdit modal instead.
- Remove the `isc:need-channel` handler that navigated to `/compose` — same replacement.
- Update the `isc:refresh-feed` handler to target `/channel` (was `/now`).
- Update the `isc:reply-post` handler to navigate to `/channel` (was `/now`).
- Remove all references to `#/discover`, `/discover`, `#/compose`, `/compose`.

### ✅ 3.7 Update Chats screen

**File:** `apps/browser/src/vanilla/screens/chats.js:52`

Remove `<a href="#/discover">Find Peers</a>`. Replace with `<a href="#/channel">Open Channel</a>`
— peers are found by being in the channel, not by separate browsing.

### ✅ 3.8 Add neighbor panel to Channel screen

**File:** `apps/browser/src/vanilla/screens/channel.js`

Add a right-side panel showing peers currently in the active channel's semantic neighborhood
(from DHT announcements). Per peer: name, channel description snippet, similarity indicator,
DM button (fires `isc:start-chat`). This is the IRC user list, semantically scoped.

Collapsed by default on mobile. Visible by default on desktop.

Data source: `discoveryService.getMatches()` filtered to the active channel's neighborhood.
Refresh on `isc:refresh-feed` and on a 30s timer.

### ✅ 3.9 Add DM action to message senders in Channel screen

**File:** `apps/browser/src/vanilla/screens/channel.js`

Clicking a post author opens a small popover: their channel description and a DM button.
Fires `isc:start-chat`. Peer contact flows naturally from reading, not from a separate screen.

### ✅ 3.10 Create ChannelEdit modal component

**New file:** `apps/browser/src/vanilla/components/channelEdit.js`

Replaces `screens/compose.js`. A modal (uses the existing `modals` infrastructure) with:

- **Name field** — short label for the channel (shown in sidebar, Channel header, Now rows)
- **Description field** — the semantic fingerprint. Placeholder: "What are you thinking
  about right now?" This is what gets embedded. Make its importance clear in the UI.
- **Breadth control** — replaces "spread/precision." A simple slider or segmented control:
  Narrow / Balanced / Broad. Controls LSH announcement spread. Tooltip explains: "Narrow
  finds closer matches; Broad casts wider into thought-space."
- **Save / Cancel** buttons.

On save:
1. Embed the description (async — show a spinner)
2. If editing: unsubscribe old channel bucket topics
3. Announce to DHT under new LSH keys
4. Subscribe to new gossipsub bucket topics
5. Close modal, update sidebar, navigate to `/channel`

On create vs. edit: the component receives an optional existing `channel` object. If present,
pre-fill and label the modal "Edit Channel." If absent, empty form labeled "New Channel."

**Delete `apps/browser/src/vanilla/screens/compose.js`** once ChannelEdit modal is complete
and all call sites are updated.

### ✅ 3.11 Update all call sites for channel create/edit

Replace every reference to `onNavigate('/compose')` or `window.location.hash = '#/compose'`
with a call to open the ChannelEdit modal:

- Sidebar `+` button → `channelEdit.open()` (create)
- Sidebar channel item long-press or edit icon → `channelEdit.open(channel)` (edit)
- Channel screen header edit button → `channelEdit.open(activeChannel)` (edit)
- Now screen "Create a channel" CTA → `channelEdit.open()` (create)
- `Ctrl+K` keyboard shortcut → `channelEdit.open()` (create)
- `isc:new-channel` and `isc:need-channel` events → `channelEdit.open()` (create)

### ✅ 3.13 Move Bridge Moment to Settings / Profile screen

**File:** `apps/browser/src/vanilla/screens/settings.js`

Add a "Thought Connections" section. Call `getBridgeMomentCandidates()` (already in
`peerProximity.ts`) on load. Show: "You've been thinking near [peer] for N days — say hello?"
with a DM button. Relationship insight, not a discovery banner.

---

## Phase 4 — Channel Screen Correctness

Complete the Channel screen (renamed from Now) so it accurately reflects its purpose.

### ✅ 4.1 Channel name as primary header

The active channel name and description are the dominant header. The user always knows which
semantic neighborhood they are in. No screen title "Now" or "For You."

### ✅ 4.2 Remove Relevance sort option

Remove **Relevance** from the Channel screen's sort controls. Messages are not ranked by
per-message semantic similarity — they are in the neighborhood or they are not.
Keep: Recent, Activity.

### ✅ 4.3 Remove Precision control from Channel screen

Precision controls channel announcement spread (how tightly the channel clusters in the DHT).
It belongs in channel editing (Compose screen), not in the message view. Remove it from the
Channel screen. Add it to `compose.js` labeled: "Neighborhood breadth — how broadly your
channel reaches into semantic space."

### ✅ 4.4 Async message loading with loading state

`fetchMessagesForChannel()` is async (DHT query). The Channel screen must handle this:
render a loading indicator immediately on navigation, update the message list when the
query resolves. The existing `update(container)` hook is the right place.

### ✅ 4.5 Show sender's channel description on each message

Each received message displays the sender's channel name alongside it. The reader sees that
the sender is in "CAP theorem and partition tolerance" while they are in "distributed systems
consensus" — connected because those descriptions are semantically near each other. This
makes the neighborhood legible and tangible.

---

## Phase 5 — Profile / Settings Enhancements

### ✅ 5.1 Bridge Moment section

Implemented as part of Phase 3.8. Data already exists in `peerProximity.ts`.

### ✅ 5.2 Thought Twin

The peer who has been most consistently in your semantic neighborhood across all channels
over time. Computed from `peerProximity.ts` accumulated data. Surface once sufficient history
exists (e.g., 7+ days of co-presence). One entry, updated weekly.

### ✅ 5.3 Ephemeral identity and session controls

Already designed in the system (ephemeral-session localStorage flag). Make it accessible in
Settings with a clear explanation of what it does: "Start fresh — new identity, no history,
no persistence." Useful for privacy-sensitive users.

---

## Phase 6 — Tests

### ✅ 6.1 Remove all Discover screen tests

Remove or archive:
- Any test that navigates to `/discover`
- Any test using `[data-testid="discover-peers-btn"]` or `[data-testid^="match-card-"]`
- The multi-context tests for "Alice appears in Bob's Discover screen" and "Bob can start
  a chat with Alice from the Discover screen"

Tests that inject matches via `injectMatches()` and verify the neighbor panel in the
Channel screen are still valid — same data, new location.

### ✅ 6.2 Update screen navigation in all remaining tests

All tests navigating to `/now` that expect the channel message stream should navigate to
`/channel` instead. Tests navigating to `/now` for the home dashboard are correct.
Audit every `nav-tab-now` reference in the test suite and verify intent.

### ✅ 6.3 Unit tests: channel-based message routing

**New file:** `packages/network/tests/channel-routing.test.ts`

Core invariants to test against `InMemoryDHT`:

1. Post created in channel A is stored under channel A's LSH keys
2. Post is NOT stored under keys from a semantically distant channel B
3. `fetchMessagesForChannel(channelA)` returns the post
4. `fetchMessagesForChannel(channelC)` — where C is semantically similar to A — also returns
   the post (shared LSH buckets)
5. `fetchMessagesForChannel(channelB)` — semantically distant — does not return it

This is the critical correctness invariant for the entire system.

### ✅ 6.4 Unit tests: gossipsub subscription lifecycle

- Creating a channel subscribes to the correct topics (derived from channel embedding)
- Editing a channel description unsubscribes old topics, subscribes new ones
- No subscriptions persist for deleted channels

### ✅ 6.5 Integration test: two channels, same neighborhood

Two browser contexts with semantically similar channel descriptions. Context A posts a message.
Verify it appears in Context B's Now screen. Verify it does NOT appear in Context C whose
channel description is semantically distant.

This is the definitive end-to-end correctness test.

**File:** `tests/e2e/semantic-neighborhood.spec.ts`

### ✅ 6.6 Integration test: relay bootstrapping fixture

Add a Playwright `globalSetup` that starts `apps/node` as a local relay before the suite
runs, and tears it down after. Required for any cross-context integration test to work.

**Implemented via `playwright.config.ts` webServer entries** — the relay (`apps/node`) is
started automatically by Playwright on port 9091 before the test suite runs.

---

## Phase 7 — Dev Infrastructure: Relay Node

The system cannot function across browser contexts without a bootstrap relay. Not optional.

### ✅ 7.1 `pnpm dev:relay` script

Root-level script that starts `apps/node` as a local relay on a well-known port. Document
that local multi-browser development requires both `pnpm dev` and `pnpm dev:relay` to be
running.

### ✅ 7.2 `docker-compose.yml`

```yaml
services:
  relay:
    build: ./apps/node
    ports:
      - "9000:9000"  # libp2p
      - "9091:9091"  # admin
```

### ✅ 7.3 Hardcode local relay in dev builds

When `NODE_ENV=development`, seed the bootstrap peer list with `localhost:9000`. No manual
configuration required for local two-browser testing.

### ✅ 7.4 Document relay requirement clearly in README

State explicitly:
- Single-browser use: works standalone
- Cross-browser messaging: requires at least one relay node
- `pnpm dev:relay`: starts a local one
- Public relay addresses belong in the production config

---

## Priority Order

| Phase | What | Effort | Notes |
|-------|------|--------|-------|
| 0 | Bug fix: chat send | Hours | Independent, do now |
| 1 | DHT post routing | 2–3 days | Core of everything |
| 2 | Per-channel gossipsub | 1–2 days | Do alongside Phase 1 |
| 7 | Dev relay | Hours | Before cross-browser testing |
| 3 | Rename Now→Channel, new Now home, ChannelEdit modal, remove Discover+Compose | 3–4 days | Requires Phase 1+2 working |
| 4 | Channel screen correctness | 1–2 days | Alongside Phase 3 |
| 5 | Profile/Settings additions | 1 day | After Phase 3 |
| 6 | Tests | Ongoing | Alongside each phase |

Phases 1 and 2 are one work session — the `browser.ts` and DHT interface changes are tightly
coupled. Phase 7 must be done before any integration testing of Phases 1–2. Phases 3 and 4
proceed together once routing is verified working.

---

## Deferred (valid, not urgent)

All items below are from prior planning. They are correct directions. They are deferred until
the core routing works. Building features on a broken foundation is how this situation arose.

**Embeddings:** Verify real embeddings (Xenova/all-MiniLM-L6-v2) are active and not stubbed
with SHA-256. If stubbed, "distributed systems" and "consensus algorithms" will never match.
This is a prerequisite for any meaningful cross-peer testing, not a feature.

**Cold start / demo mode:** Ghost peers and synthetic demo content for the Now screen when
the neighborhood is empty. Implement after the real routing is working so demo content can
accurately reflect the live system behavior.

**Space View:** 2D UMAP/t-SNE projection of the semantic neighborhood. Compelling, earns its
own nav slot when built. Implement after the neighborhood itself is correctly defined.

**Multilingual models:** Correct direction, Phase 2+ per PROTOCOL.md.

**XSS / content sanitization:** DOMPurify on all user-generated content. Must happen before
any public deployment. Non-negotiable.

**Predator routing problem:** Documented in prior TODO. Must be addressed before public launch.
The semantic routing that enables serendipitous discovery is the same routing that enables
precision targeting of vulnerable users. No clean solution exists; the tension must be stated
honestly in documentation and partially mitigated technically.

**Video/audio, file transfer, bridge integrations, Nostr/ActivityPub:** Post-core.
