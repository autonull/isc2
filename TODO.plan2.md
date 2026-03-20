# ISC Development Plan 2 — Post Phase 3

**Generated**: 2026-03-19
**Source**: Full codebase analysis after TODO.plan.md Phases 0–3 completion
**Current branch**: `fix-ui-e2e-crashes-12052808057943733772`

---

## What Phases 0–3 Delivered

| Item | Status | Notes |
|------|--------|-------|
| Real embeddings (Xenova/all-MiniLM-L6-v2) | ✅ | Core value unlocked |
| XSS sanitization (DOMPurify) | ✅ | Security prerequisite done |
| Bootstrap relay pool | ✅ | New users see real network |
| SharedWorker / ServiceWorker persistence | ✅ | Tab background survives |
| Real libp2p DataChannel messaging | ✅ | True P2P, not localStorage |
| Onboarding flow (3-step) | ✅ | Preact components in `src/screens/onboarding/` |
| File / media transfer | ✅ | `enhancedFileTransfer.ts` (simplified from original) |
| Demo mode | ✅ | `demoMode.ts` (simplified) |
| Ghost peers | ✅ | `ghostPeers.ts` (simplified) |
| Sleeping state / away messages | ✅ | `sleepingState.ts` (simplified) |
| Invite links + `#join/PEER_ID` | ✅ | `inviteLinks.ts` (simplified) |
| Chaos mode / serendipity slider | ✅ | `chaosMode.ts` (simplified) |
| Space View (2D semantic map) | ✅ | `SpaceView.tsx` — **Preact component only** |
| Multilingual embedding support | ✅ | `multilingual.ts` + `LanguageSelector.tsx` |
| Configurable embedding model | ✅ | Settings UI |
| Channel UI improvements (mixer board) | ✅ | `mixerPanel.js` reworked |
| Conversation history embeddings | ✅ | `services/` layer |
| Relationship persistence by consent | ✅ | Protocol + IndexedDB |
| Node admin UI + simulator | ✅ | `admin-ui.html`, `admin-api.ts`, `simulator.ts` |
| Node README | ✅ | 209 lines |

---

## Common Sense Validation

**Is this worth building?**

Yes — with clear eyes.

**What is genuinely new:** Every major platform routes information by social graph, engagement signal, or opaque recommendation. ISC routes by *meaning*. That is architecturally new, not just a product differentiator. The layout is the algorithm; there is no engagement optimization to corrupt it. No server sees your content. Ephemeral by default. These are real, verifiable properties, not marketing.

**What the successful first session looks like:** User types "I've been thinking about how cities could reduce loneliness." Embedding runs locally. Space View appears — their dot, a few others nearby. They hover over one — "Urban psychology and shared spaces in dense cities · 0.81." They click it. Someone in Helsinki says "I was just reading about the Finnish approach to lobby design." They talk for 20 minutes. At the end: "Preserve this connection?" — yes. Next day, their Thought Twin notification arrives. That sequence is achievable today with the implemented code. The only missing piece is Space View wired into the UI.

**The honest risks:**
- **Cold start is the existential risk.** Semantic matching requires critical mass to deliver on the promise. The answer is vertical-first launch (AI researchers) where critical mass is small (~hundreds, not millions) and semantic density is high.
- **22 MB model on first load.** ~5–10s on fast broadband, 30–60s on mobile 3G. This is not just a performance issue — it is the first UX moment. It needs design, not just a spinner.
- **WebRTC reliability.** ~15–20% of browser-to-browser connections fail in real networks due to symmetric NAT. The relay fallback is essential and must be fast.
- **The promise only lands if the embeddings are good.** all-MiniLM-L6-v2 is genuinely good (not just "good enough") for general English — cosine("AI ethics", "machine learning morality") ≈ 0.72. Edge cases: polysemous terms ("model", "network", "field") can produce surprising matches. This is a feature ("the space has roads, deserts, and cliffs") but users will occasionally be confused.

**Verdict on form-follows-function:** The core loop — describe thought → find nearby thinkers → talk directly — is tight and valuable. Every feature in this plan should be evaluated against that loop. Features that make the loop more likely to succeed (Space View, demo mode, onboarding) are essential. Features that add depth after the loop succeeds (Thought Twin, Time Capsule, Bridge Moment) drive retention. Features that extend the loop to new surfaces (TUI, relay node) expand reach. Cut anything that does none of these.

---

## Critical Gap Discovered in Analysis

**The Space View component (`SpaceView.tsx`) and multilingual components (`LanguageSelector.tsx`, `TranslatedText.tsx`) are Preact components.** The active UI is Vanilla JS. These components are not wired into the live application. Users cannot see Space View.

This is the most important thing to fix before any other discovery UX work, because Space View is the differentiating visual metaphor that only ISC can offer.

---

## Sequencing Principles (Updated)

1. **Wire what exists before building what's next** — Several Phase 2–3 services exist as standalone files but are not invoked from the Vanilla UI. Fix wiring before adding features.
2. **The first 30 seconds are the product** — A 22 MB model loading blank screen kills the app. Demo peers must be visible in <1 second. Everything else follows from this.
3. **Space View is the differentiating experience** — The semantic map is what only ISC can offer. It must be the default landing screen, not buried behind a nav item.
4. **The UI must be intuitive without explanation** — ISC maps to proven patterns: email (async messages), IM (real-time chat), IRC (channel-based presence). Users already know how these work. No tooltips, no help overlays, no onboarding copy that explains what a "channel" is. If a feature requires explanation, the feature needs redesign.
5. **Form follows function** — Every feature must either (a) make the core loop more likely to succeed (describe thought → find nearby thinkers → talk), (b) give the loop more depth after it succeeds, or (c) extend it to new surfaces. Cut anything that does none of these.
6. **Don't waste battery or data** — Debounce embedding computation (1500ms after last keystroke, or on blur). Reduce DHT polling when tab is hidden or low battery. Show data-size warning before 22 MB download on mobile.
7. **CLI is deprioritized indefinitely** — Not a user-facing surface. Omit from Getting Started, READMEs, and user-facing docs entirely.
8. **TUI is the server/terminal surface** — A real terminal UI unlocks server deployments and SSH contexts. Currently a placeholder.
9. **Discovery UX is the retention mechanism** — Bridge Moment, Thought Twin, Convergence Events are what turn first-time users into advocates.
10. **Privacy hardening before high-stakes launch** — Forward secrecy and metadata resistance before pitching to journalists, activists, or clinicians.

---

## Phase A — Reality Check & Wiring (Days 1–3) ⚡ Do First

Before building anything new, validate that what exists actually functions and wire the unconnected parts.

### A0 — First 30 Seconds UX ★ MOST IMPORTANT MOMENT
**Effort**: ~half day | **Prerequisite for everything else**

The 22 MB model download is not a loading problem — it is the first user experience. How it is handled determines whether the user stays. Simulate it: you land on the page, nothing happens for 10 seconds, no feedback, just a spinner. You leave. That must not happen.

**The right sequence:**
1. App shell loads instantly (HTML + CSS, no JS bundle delay — Vite handles this)
2. **Immediately show Space View with demo peers** — no model needed for this; demo peers have pre-computed embeddings baked into the JS bundle (a few KB of JSON)
3. Simultaneously begin model download in background
4. Unobtrusive progress at bottom of Space View: `Downloading semantic model (22 MB, once only) ▓▓▓░░░░░ 38%`
5. When model finishes: demo peers smoothly transition to real network; progress bar disappears
6. If model fails: demo peers stay, user can still explore the experience — they just can't initiate real connections

**Implementation:**
- Pre-compute embeddings for demo peer profiles at build time using Node.js + `@xenova/transformers`; serialize as `demoEmbeddings.json` (~5 KB); include in bundle
- UMAP project those pre-computed vectors once (also at build time) → store 2D coordinates in same JSON — no in-browser projection needed for initial render
- Model download: use `EmbeddingService.preload()` which already exists; track progress via the `progress_callback` in `pipeline()` options of `@xenova/transformers`
- Progress display: a single `<div class="model-progress">` element at the bottom of Space View — not a modal, not a blocker

**Done when:** Tab opens → Space View with demo peers appears in <1 second → model progress visible → real peers integrated on completion → no visible jump or reload

### A1 — Space View Integration Into Vanilla UI ★ CRITICAL
**Effort**: ~1 day

`SpaceView.tsx` is a Preact component. The live UI is Vanilla JS. Users see no Space View.

**Implementation:**
- Create `apps/browser/src/vanilla/screens/space.js` — do not try to run the Preact component in vanilla context, write fresh vanilla canvas code (the Preact component is a reference, not reusable)
- **Dimensionality reduction:** Use [`umap-js`](https://github.com/PAIR-code/umap-js) (npm: `umap-js`, ~50 KB, browser-compatible, maintained by Google PAIR). For <500 peers, `t-SNE` (from `ml-matrix`) is also fine — both are O(n²) which is acceptable at this scale. UMAP preserves global structure better; prefer it.
  ```js
  import { UMAP } from 'umap-js';
  const umap = new UMAP({ nComponents: 2, nNeighbors: 15, minDist: 0.1 });
  const embedding2d = umap.fit(peerVectors); // [[x,y], [x,y], ...]
  ```
- **Canvas rendering:** `requestAnimationFrame` loop, 2D canvas context. Normalize UMAP output to [0,1], scale to canvas dimensions (minus padding). Each peer = a filled circle. Self = larger, accent-colored circle. Ghost peers = lower opacity. Demo peers = dashed border.
- **Interaction:** `mousemove` → hit-test circles → show peer's channel description in a `<div>` tooltip positioned at cursor. `click` → dispatch `isc:open-chat` custom event with peer ID.
- **Re-projection:** Re-run UMAP when peer set changes (debounced 2s). Animate transition using linear interpolation between old and new 2D coordinates over 300ms.
- Wire into router: `space` route → Space View screen
- Add "Space" nav item to sidebar — make it the default landing screen (not Discover)
- Feed real peer vectors from `matchesState` (already has embeddings; just pass `matches.map(m => m.vec)`)

**Done when:** Opening the browser → Space View visible in <1s with demo peers → real peers appear as network connects → click on peer dot → chat opens

### A2 — Phase 2–3 Service Integration Audit
**Effort**: ~half day

Services exist but may not be called from the Vanilla UI. Audit each:

| Service | File | Called from Vanilla UI? | Where to wire |
|---------|------|------------------------|---------------|
| Demo mode | `demoMode.ts` | Verify active on cold start | `app.js` init, before network ready |
| Ghost peers | `ghostPeers.ts` | Verify shown in Space View + peer list | Space View render + `discover.js` |
| Sleeping state | `sleepingState.ts` | Verify `beforeunload` prompt fires | `app.js` window event |
| Invite links | `inviteLinks.ts` | Verify `#join/PEER_ID` parsed on load | `app.js` init, check `location.hash` |
| Chaos mode | `chaosMode.ts` | Verify slider in settings wires to threshold | `settings.js` slider → `networkService.setCosineSpread()` |
| Multilingual | `multilingual.ts` | Verify language detection on description input | `mixerPanel.js` description field `input` event |
| Background sync | `backgroundSync.ts` | Verify SharedWorker stays connected | `app.js` init, `navigator.serviceWorker` |
| Message queue | `messageQueue.ts` | Verify offline messages delivered on focus | `app.js` `visibilitychange` event |

For any service not wired: wire it. Don't leave dead code.

**Battery note:** Channel description re-embedding on every keystroke would drain battery on mobile. Re-embed only on `blur` (user finishes typing) or after 1500ms debounce — not on every `input` event. The `multilingual.ts` language detection can run on `input` (it's cheap — just regex/n-gram, not model inference). The embedding itself must wait.

### A3 — End-to-End Semantic Match Validation
**Effort**: ~2 hours

Real embeddings are activated, but "activated" ≠ "working correctly." Run explicit validation:

- Write `tests/integration/semantic-match.test.ts` with assertions:
  - `cosine("AI ethics", "machine learning morality") > 0.70`
  - `cosine("cats", "quantum physics") < 0.20`
  - `cosine("jazz music", "classical music") > 0.60`
  - `cosine("I love jazz", "jazz music") > 0.75`
- Verify model loads within 10 seconds on first run
- Verify IndexedDB cache serves it instantly on second load
- Verify fallback to stub if model fails to load
- **Done when**: Tests pass and cosine scores match intuition

### A4 — Error State Coverage
**Effort**: ~half day

Map every failure mode and ensure users see a helpful recovery path:

| Failure | Current behavior | Required behavior |
|---------|-----------------|-------------------|
| Embedding model fails to download | Unknown (crash?) | Banner: "Offline mode — matching by keyword only. Reconnect for semantic matching." |
| DHT query returns zero peers | Empty peer list, no explanation | "You're the first one here with this thought. Try broadening your channel description." |
| WebRTC connection drops mid-chat | Message silently fails | Banner in chat: "Connection lost — reconnecting…" with retry button |
| File transfer fails | Unknown | Progress bar turns red with "Failed — try again" |
| Tab backgrounded too long, SharedWorker dies | Unknown | On refocus: "You were away X minutes. N messages arrived." |
| Bootstrap relay unreachable | No peers ever | Specific error: "Can't reach bootstrap relay. Check your connection." |

- **Done when**: Every failure mode in the table shows a user-friendly message and a clear action

### A5 — Keyboard-First Navigation
**Effort**: ~half day

The IRC paradigm is keyboard-first. The Vanilla UI currently requires mouse for most actions. Keyboard shortcuts are a power feature, not help documentation — they should feel discovered rather than explained.

- `Tab` cycles sidebar items
- `Enter` opens selected channel/peer
- `Ctrl+K` opens command palette (channel search + actions)
- `Esc` closes modals, deselects
- `Ctrl+N` focuses compose
- `Ctrl+Space` triggers serendipity mode (chaos mode on)
- Arrow keys navigate peer list in Space View
- `/` focuses channel search (IRC convention, users who want this will find it)

### A6 — README Rewrite ★ DONE
**Effort**: ~half day | **Completed**

The existing README led with CLI quick start. Replaced with:
- Vision statement as opening — human experience first, not architecture
- Getting Started for: Web App, Terminal UI, Relay Node, Demo link
- CLI removed from user-facing documentation entirely
- Technical architecture sections preserved for contributors

---

## Phase B — Discovery UX (Week 1–2)

These are the features that turn ISC from a chat app into something irreplaceable. Execute in order — each builds on the previous.

### B1 — Bridge Moment UI
**§5, Plan 1 P4.1** | **Effort**: ~1 day | **Depends on**: A1, A3

"You've been thinking near [anonymous peer] for 11 days. Your channels are ~0.67 similar."

- Track peer proximity history in IndexedDB store `peer_proximity`: `{ peerId, firstSeen, lastSeen, avgCosine, sessionCount, contacted: false }`
- On each DHT match result: upsert this store — update `lastSeen`, recalculate rolling average cosine, increment `sessionCount`
- Surface banner after `sessionCount >= 3` AND `daysSinceFirstSeen >= 7` AND `0.55 <= avgCosine <= 0.70` AND `!contacted`
- Banner: subtle, non-intrusive — single line above the peer list in Discover, not a modal. `"You've been near 🌀 Peer-3f2a for 11 days · 0.67 · [Say hello] [Dismiss]"` — clicking "Say hello" sets `contacted = true` and opens chat; "Dismiss" also sets `contacted = true`
- Target range 0.55–0.70 deliberately excludes >0.70: very high similarity can feel uncanny and may not produce the best conversations; moderate overlap is the sweet spot for genuine encounter
- **Testing:** Add a `seedProximityHistory(days, peerId, cosine)` helper in tests that writes synthetic IndexedDB records, then assert banner renders

**Done when:** Simulated 7-day proximity history (3 sessions, avg 0.64 cosine) → banner appears in Discover → clicking "Say hello" opens chat

### B2 — Your Thought Twin
**§5, Plan 1 P4.2** | **Effort**: ~half day | **Depends on**: B1

Weekly surface of the peer with highest accumulated semantic similarity across all channels over time.

- Reuse the `peer_proximity` IndexedDB store from B1; compute `score = avgCosine * daysSinceFirstSeen` across all peers; top scorer is the Thought Twin
- Weekly trigger: store `lastThoughtTwinNotification` timestamp in `settings` store; on app open, if >7 days since last, compute and surface
- **Surface:** a distinct section at the top of Space View — the Twin's dot pulses with a slow glow (CSS `@keyframes` animation on the canvas overlay `<div>` positioned at the Twin's 2D coordinates)
- Notification text (in the existing notification system, not a browser push): `"Your Thought Twin this week: 18 days · 0.81 average · [Connect] [Acknowledge]"`
- "Connect" triggers the bilateral consent flow from relationship persistence (Phase 3): sends a signed `contact_preserved` event; connection only confirmed when peer also accepts
- Identity (peer ID) is shown only after bilateral consent — before that, the Twin is always anonymous

**Done when:** Simulated 3-week proximity history → correct Twin identified → pulsing highlight in Space View → notification surfaces on app open

### B3 — Convergence Events
**§5, Plan 1 P4.4** | **Effort**: ~1 day | **Depends on**: A3

"7 unconnected people independently arrived at nearly identical thoughts in the past hour. No algorithm selected this."
This is ISC's most shareable moment — a screenshot explains the concept without words.

**Detection — the non-obvious part:** The network is decentralized; there's no central observer. Each peer detects convergence from their own DHT view:
- Maintain an in-memory time-bucketed index: `Map<lshBucketKey, Array<{peerId, vec, seenAt}>>` — populated by DHT query results as they arrive
- Each LSH bucket key already represents a semantic neighborhood (~0.10 cosine radius by construction)
- On each DHT query result: sweep buckets; if any bucket contains ≥5 distinct peer IDs seen in the last 60 minutes → convergence detected locally
- This fires independently on each peer who happens to observe that LSH bucket — no coordination needed; the decentralized detection IS the point
- "Unconnected" heuristic: peers with `contacted: false` in `peer_proximity` count; this is imperfect but good enough

**Surface:**
- Subtle in-app notification: `"7 people arrived at the same thought in the last hour · [View]"`
- In Space View: convergence region dots pulse with warm glow (canvas overlay, CSS animation on positioned `<div>`)
- "View" → modal with convergence card

**Shareable card:**
- `<canvas>` rendered with: count, approximate shared concept (nearest concept bank label from B4, or the raw LSH bucket description if B4 isn't done), cosine spread, timestamp, `"Discovered in ISC · isc2.example"` watermark
- `canvas.toBlob()` → PNG download — no server required; the card is entirely self-contained

**Done when:** 7 simulated peers placed in same LSH bucket within 60-minute window → notification fires → card renders → PNG downloads correctly

### B4 — Thought Bridging (Local AI)
**§6, Plan 1 P4.3** | **Effort**: ~2 days | **Depends on**: A3

When two peers at 0.60–0.75 similarity initiate conversation, suggest a bridging concept. Runs entirely locally — no API call, no server.

**Concept bank build (one-time, offline):**
- Source phrases: Wikipedia Simple English article titles (~80K), filtered to noun phrases of 2–5 words → ~15K candidates. Run through same `all-MiniLM-L6-v2` model offline via Node.js script (`scripts/build-concept-bank.ts`). Deduplicate by cosine > 0.95. Result: ~8,000 phrases with 384-dim embeddings.
- Serialize as `public/concept-bank.bin` — a flat binary: 4-byte float32 per dimension × 384 dims × 8000 phrases = ~12 MB. At build time, also produce `public/concept-labels.json` (just the phrase strings, ~120 KB).
- Load lazily: only fetch when user opens a chat. Use `fetch()` → `ArrayBuffer` → `Float32Array`. Cache in memory for session lifetime (not IndexedDB — it's rebuilt each version).
- **k-NN search:** Flat cosine scan over 8,000 phrases. In WASM-optimized JS: 8,000 dot products at 384 dimensions ≈ 3M multiplications. On a modern device: <5ms. No ANN index needed at this scale.

**At conversation open:**
```js
const midpoint = vectorAdd(peerA.vec, peerB.vec).map(v => v / 2);
const normalized = normalize(midpoint);
const topK = conceptBank.search(normalized, 3); // returns [{phrase, cosine}]
// Only show if cosine > 0.55 (the bridge is meaningful) and similarity 0.60–0.75
```
- Display in chat header (single line, dismissable): `"You might explore: [phrase] · [×]"`
- Default: on. Toggle in Settings: "Show conversation bridges"
- Write `docs/BRIDGES.md`

**Done when:** Chat between two simulated peers at 0.65 similarity → concept bank fetches → bridge phrase appears in header → dismiss works → phrase is plausible to a human

### B5 — Semantic Time Capsule / Thought Drift
**§3, §5, Plan 1 P4.5** | **Effort**: ~1 day | **Depends on**: A1 (Space View)

"Your thinking has moved 23° toward [topic cluster] since last month."

This feature delivers unique long-term value: no other platform shows you how your own thinking evolves. It also creates powerful retention — the history is irreplaceable and lives only on the user's device.

**Storage:** IndexedDB store `channel_history`: `{ channelId, timestamp, vec: Float32Array, description: string }`. Write one record on each channel description save (not on every keystroke — same blur/debounce as embedding computation). Keep last 365 records per channel; prune on each write if over limit.

**Space View integration:** When a channel is selected in the mixer, overlay its historical 2D positions as connected dots with decreasing opacity into the past. The most recent position is the current Space View dot; earlier positions form a trail. Implementation: re-project historical vectors through the same UMAP instance (it can accept new points for projection without re-fitting via `umap.transform(vec)`).

**Drift label:** Compute `cosineSimilarity(earliest_vec, latest_vec)` → `driftAngle = Math.acos(cosine) * (180/Math.PI)`. Find nearest concept bank label for `latest_vec - earliest_vec` (the drift direction vector) — this names the direction of change. Surface in channel card: `"Since January, your thinking here drifted 18° toward [concept]"`.

**Replay:** A "play" button in the mixer panel plays back the drift animation in Space View — dots appearing in sequence over 3 seconds. Simple `setInterval`-based animation, no external dependency.

**Done when:** 30 snapshots simulated over synthetic timestamps → trail visible in Space View → drift label correct → replay animates correctly

---

## Phase C — Terminal & Relay Surfaces (Week 2–4)

The web app is the primary surface. This phase makes the terminal and relay surfaces real.

### C1 — TUI Real Implementation
**Effort**: ~2 days

A genuine terminal UI for ISC. Currently a placeholder. The TUI serves:
- Server deployments (headless Linux, SSH)
- Power users who live in the terminal
- Environments where a browser is unavailable

**Layout**: 3-pane design (matches browser IRC layout):
```
┌─────────────┬──────────────────────────────┬──────────────────┐
│ Channels    │ Messages / Feed              │ Peers            │
│─────────────│──────────────────────────────│──────────────────│
│ #ai-ethics  │ [10:42] PeerA: interesting   │ 🟢 PeerA  0.84  │
│ #music      │ [10:43] You: agreed          │ 🌀 PeerB  0.71  │
│ [+] New     │                              │ 👻 PeerC  0.61  │
│─────────────│──────────────────────────────│──────────────────│
│ Status: 🟢  │ > compose here               │ [Space View: N/A]│
└─────────────┴──────────────────────────────┴──────────────────┘
```

**Keybindings**: vi-like — `j/k` navigate lists, `Enter` open, `c` compose, `d` discover, `q` quit

**Implementation:**
- **Framework:** Use [`ink`](https://github.com/vadimdemedes/ink) (React for terminals, npm: `ink`) + [`@inkjs/ui`](https://github.com/vadimdemedes/ink-ui) for pre-built components (TextInput, Select, Spinner, Badge). Prefer over `blessed` (unmaintained since 2019) and `terminal-kit` (heavier). Ink's React model maps cleanly to the service layer's reactive state.
- **Service layer reuse:** `apps/browser/src/services/` is framework-agnostic TypeScript — the same `networkService`, `channelService`, `feedService`, and `chatService` instances work in Node.js (where TUI runs). The adapters (`packages/adapters/src/node/`) already provide Node.js-compatible storage and model loading. Import from services directly.
- **Model loading in terminal:** The 22 MB model download shows as an `ink` `<Spinner>` with progress text: `Downloading model... 38%`. Use the same `progress_callback` as the browser.
- **Space View in TUI:** Use [`drawille`](https://github.com/madbence/node-drawille) (Braille canvas in terminal) for a 2D scatter plot of peer positions. 80×24 Braille resolution gives ~160×96 effective pixels — enough for spatial intuition. Not beautiful, but gives the right mental model.
- **Model for TUI Node.js:** `packages/adapters/src/node/model.ts` — use file-system cache at `~/.isc/model/` instead of IndexedDB.

**Done when:** Full ISC session possible in terminal: channel created, peers discovered with cosine scores, message sent and received — no browser required.

### C2 — Node Relay Production Hardening
**Effort**: ~1 day | **Partially done** (README, admin UI, admin API exist)

The relay server has an admin UI and API. Close the remaining gaps:

- **Dockerfile:** Base `node:20-alpine`. Copy `apps/node/` and workspace packages, run `pnpm install --frozen-lockfile`, `CMD ["node", "dist/index.js"]`. Key ENV vars: `ISC_NAME` (display name), `ISC_PORT` (default 9090), `ISC_ADMIN_PORT` (default 9091), `ISC_ADMIN_TOKEN` (required, no default — fail-fast if missing), `ISC_ANNOUNCE` (true/false, whether to list in community registry)
- **docker-compose.yml:** Service + volume for identity persistence at `/data/identity.json` — without this, peer ID changes on every restart and the relay disappears from the DHT
- **Health endpoint:** `GET /health` → `{ status: "ok", peers: N, uptime: Xs, version: "x.y.z" }` — used by uptime monitors; already partially in `admin-api.ts`, just needs the route
- **Prometheus metrics:** Use [`prom-client`](https://github.com/siimon/prom-client) (npm, well-maintained). Expose `GET /metrics`. Track: `isc_connected_peers`, `isc_dht_operations_total`, `isc_bytes_relayed_total`, `isc_uptime_seconds`. Grafana dashboard JSON includable as `apps/node/grafana-dashboard.json`
- **Graceful shutdown:** On `SIGTERM`: call `node.stop()` (libp2p), wait for DHT departure announcement (~2s), then `process.exit(0)`
- **Rate limiting:** [`express-rate-limit`](https://github.com/express-rate-limit/express-rate-limit) on admin API; libp2p `connectionGater` for per-IP peer connection rate
- **TLS:** Document in `apps/node/README.md` — recommend Caddy reverse proxy (automatic HTTPS, single config line); include `Caddyfile` example

**Done when:** `docker compose up` → relay connects to DHT → health endpoint returns 200 → Prometheus metrics scraping works → `SIGTERM` shuts down cleanly

### C3 — Net-Sim Promotion to Public Demo
**§10, Plan 1 Net-Sim section** | **Effort**: ~1 day

`apps/net-sim` is almost a Space View. Polish it into a standalone interactive demo:

- 50 synthetic peers finding each other in embedding space, animated
- User can type any concept into a search box and watch where it lands in the semantic map
- "Click any peer to see their thoughts" — simulated channel descriptions
- Shareable via URL: `https://isc2.example/demo`
- Embeddable in README, blog posts, Hacker News comments as an `<iframe>`
- No ISC node required — pure client-side simulation with pre-computed embeddings

This is the clearest 30-second explanation of what ISC does. More effective than any text description.

**Done when**: Someone who has never heard of ISC can understand the concept by playing with the demo for 30 seconds.

---

## Phase D — Ephemeral Identity & Lurk Mode (Week 3–4)

Short-effort features that unlock specific high-value use cases and user types.

### D1 — Deniable Identity / Ephemeral Mode ★ HIGH STAKES
**§4, Plan 1 P5.5** | **Effort**: ~1 day

For whistleblowers, activists, abuse survivors, clinicians — this is the entire product.

- "Start anonymous session" toggle on splash/onboarding screen (not buried in settings)
- Generates in-memory keypair only: no IndexedDB writes, no localStorage
- Warns clearly: "Closing this tab permanently erases your identity and all messages. Nothing is saved anywhere."
- No contact preservation, no channel history, no sleep announcements, no thought drift
- Ephemeral peers shown with ◇ icon to other users (they know you're ephemeral, no false permanence expectations)
- **Separate from metadata resistance** (Phase E) — this is about local storage, not network observation

### D2 — Lurk Mode
**§12, Plan 1 P5.6** | **Effort**: ~2 hours

Join a channel for perspective without including it in your thought vector.

- Toggle in channel options: "Lurk (don't include in my vector)"
- Lurked channels shown in sidebar with 👁 icon
- Excluded from embedding blend computation
- Useful for: understanding alternative views, escaping echo chambers, research

### D3 — Semantic Subscription (Region of Thought-Space)
**§3, Plan 1 P5.7** | **Effort**: ~2 days | **Depends on**: A3

"Follow ideas, not identities." Subscribe to a region of embedding space.

- UI: "Subscribe to region" saves current channel embedding + threshold as subscription in IndexedDB
- Background DHT poll every N minutes for new content landing within threshold
- Notification when new content enters subscribed region, regardless of author
- Subscription management: list, edit threshold, delete
- Power use case: journalist subscribes to "investigative journalism ethics" region — any new post within 0.80 triggers alert regardless of who wrote it

### D4 — PWA Hardening + Mobile Layout
**§8, Plan 1 P5.1** | **Effort**: ~1 day

Mobile is not just "small screen" — it's a fundamentally different interaction model. The 3-pane IRC layout must collapse gracefully.

**PWA basics:**
- `manifest.webmanifest`: `display: standalone`, `theme_color`, icons at 192×192 and 512×512, `start_url: "/"`, `background_color`
- `beforeinstallprompt` event → deferred prompt stored → show subtle "Install ISC" banner after user has spent >2 minutes in app (not on first load)
- ServiceWorker caches app shell (HTML, CSS, JS bundle, demo embeddings JSON) → app loads offline instantly

**Mobile layout (this is the missing design work):**
- On screens < 768px wide: single-pane with bottom tab bar (Space | Channels | Chats | Settings)
- Space View: full-screen canvas, tap peer → slide-up sheet with name + cosine score + "Connect" button
- Channels (mixer): vertical list, tap to expand inline — no sidebar
- Chat: full-screen, swipe left to return
- Compose: floating action button (bottom right) → bottom sheet input
- The 3-pane layout is appropriate for desktop/TUI; mobile needs its own layout code. Add `isMobile()` utility: `window.innerWidth < 768` — render different DOM structure, not CSS-only transform.

**Battery/data on mobile:**
- Model download is 22 MB — show explicit confirmation dialog on mobile before downloading: `"ISC needs to download a 22 MB AI model (once only). Proceed on WiFi?"` with [Download] [Later] options. "Later" → use demo mode only.
- DHT polling interval: 30s on desktop, 60s when `document.hidden`, 120s on mobile low-battery (use `navigator.getBattery()` if available)

**Offline mode:**
- Without network: show cached channels, cached ghost peer positions in Space View, cached thought drift. A useful semantic journal even with no connection.
- Banner: `"No network — showing cached state"` — not an error, just context

**Done when:** App installs on iOS Safari and Android Chrome → mobile layout is usable without pinching/zooming → offline shows cached state

---

## Phase E — Privacy Hardening (Week 4–7)

Do these before any high-stakes use case launch (activists, journalists, clinicians).

### E1 — Forward Secrecy
**§4, Plan 1 P6.1** | **Effort**: ~2 days

- Rotate session keys per-conversation (Double Ratchet protocol)
- Past messages cannot be decrypted if long-term key is compromised
- Key rotation is transparent to UX — no user action required
- Add to `SECURITY.md`: "messages have forward secrecy — compromising your key today does not expose past conversations"

### E2 — Metadata Resistance / Relay-Only Mode
**§4, Plan 1 P6.2** | **Effort**: ~3 days

IP address via WebRTC is the primary deanonymization vector. Unlocks high-stakes use cases.

- `--relay-only` mode: all traffic routed through circuit relay nodes; participant IPs hidden from each other
- Settings toggle: "Privacy mode — use relay routing" (slower but hides IP)
- Warning in Settings when direct (IP-exposing) WebRTC connections are active: "⚠️ Direct connections expose your IP address to chat partners"
- Write `SECURITY.md` section: ISC's current privacy is strong-by-architecture but not adversarially hardened; relay-only mode changes that

### E3 — Sealed Sender
**§4, Plan 1 P6.3** | **Effort**: ~2 days | **Depends on**: E1

- Encrypt sender identity inside message payload (Signal-style)
- Relay nodes cannot observe social graph even in transit
- Backward-compatible — mixed sealed/unsealed sessions handled gracefully

### E4 — Semantic Spam Resistance
**§4, Plan 1 P6.4** | **Effort**: ~1 day | **Depends on**: A3

Spam is structurally expensive in ISC — spammers can't fake semantic coherence cheaply. Make this property explicit:

- Rate limit per LSH bucket per time window (already partially implemented in `peerRateLimiter.ts`)
- Local reputation score per peer: decays over time, lowered by mutes/blocks, raised by sustained coherent presence
- Mute/block events propagate semantic feedback to local reputation model
- Peers with reputation below threshold deprioritized in matching

### E5 — Predator Routing Mitigations
**§4, Plan 1 P6.5** | **Effort**: ~2 days | **Depends on**: E4

The hardest design tension. The feature that enables serendipitous connection enables precision predation. No clean solution, but mitigations are implementable:

- **Minimum TTL before contact initiation**: peer must be in a semantic neighborhood for ≥30 minutes before they can initiate contact with peers in it (configurable)
- **Cluster-level abuse detection**: if many mute/block events originate from encounters in a specific semantic region within 24 hours, temporarily quarantine that region from new contact initiation
- **Local manipulation classifiers**: lightweight pattern matching on incoming messages for manipulation signatures (urgency escalation, isolation requests, financial asks) — flag, not auto-block
- Write `docs/PREDATOR_ROUTING.md` — honest statement of the problem, mitigations, their limits, and the fundamental tension. Do not minimize.

---

## Phase F — Protocol & Ecosystem (Month 2–3)

### F1 — Governance Framework for Model Decisions ★ BEFORE COMMUNITY LAUNCH
**§9, Plan 1 P7.1** | **Effort**: ~2 days (design doc + lightweight process)

Embedding model selection is the most consequential governance decision in the system — it determines which semantic geometry everyone shares. This will be contested the moment there's a community.

- Write `docs/GOVERNANCE.md`:
  - Two-week RFC period for embedding model changes
  - Maintainer multisig for model registry updates
  - Acknowledge the semantic monoculture problem: global interoperability requires shared coordinates; shared coordinates embed cultural assumptions; this is political, not just technical
  - Whose theory of meaning gets to organize global thought-routing infrastructure?
- Model registry: signed manifests, LSH namespace prefix per model
- Establish governance process before any community-facing launch

### F2 — Protocol Versioning
**§9, Plan 1 P7.2** | **Effort**: ~1 day

- Semver'd wire protocol with negotiation handshake
- `x-isc-version` in libp2p protocol string: `/isc/chat/1.0.0`
- Older clients gracefully degraded, not broken
- Network can evolve without hard forks

### F3 — Community Bootstrap Node Registry
**§9, Plan 1 P7.3** | **Effort**: ~1 day

- DNS TXT record or DHT-resident list of known-good community bootstrap relays
- No single entity controls it — maintained by multisig or DAO-lite
- Browser queries DNS on startup before falling back to hardcoded relays
- Relay operators opt in by submitting a signed registration

### F4 — Open Protocol Spec
**§9, Plan 1 P7.4** | **Effort**: ~3 days

What makes this a protocol rather than an app:
- Human-readable spec document: `docs/PROTOCOL_SPEC.md` (separate from implementation, authoritative)
- Includes: DHT key schema, LSH parameters, channel announcement format, message wire format, rate limits, embedding model registry format
- Enables third-party implementations: native mobile, embedded, CLI, AI agents
- Reference implementation: `apps/browser` — spec is authoritative when they diverge

### F5 — Nostr Keypair Import/Export
**§7, Plan 1 P7.5** | **Effort**: ~1 day

- secp256k1 ↔ ed25519 bridge identity layer
- Users bring existing Nostr identity; immediate access to large Nostr user base
- `isc identity import --nostr <nsec>` in CLI
- Settings screen: "Import Nostr identity"

### F6 — AT Protocol / Bluesky Bridge
**§7, Plan 1 P7.7** | **Effort**: ~1 week

ISC as semantic layer on top of Bluesky's open social graph. Growth vector, not threat.
- Identity mapping: did:plc ↔ ISC peer ID
- Post translation: Bluesky post → ISC announcement (embed the text, announce to DHT)
- ISC brings meaning-based discovery to Bluesky's social graph; Bluesky brings existing social connections to ISC
- Spec the bridge in `docs/ATPROTO_BRIDGE.md` before implementing

---

## Phase G — Advanced / Speculative (Month 3+)

Revisit after Phase A–F are complete and there are real users providing feedback. These are right ideas for the right time.

### G1 — Vibe Rooms (Audio Mesh)
Audio-only WebRTC mesh auto-forming from dense semantic clusters. Natural entry/exit as you drift. This is the audio equivalent of IRC channels but organized by thought rather than topic label. The version of video calls that only ISC can offer.

### G2 — Semantic Content Routing
Posts propagate toward semantically interested peers; replacement for engagement-driven feeds. New message type on existing DHT routing, not a rewrite.

### G3 — Convergence Event Maps for Policy Research
Aggregate semantic density maps for governments and NGOs — understanding what populations focus on without individual surveillance. New form of democratic signal. Requires institutional partner first.

### G4 — ZK Proximity Proofs
Zero-knowledge proof that "my vector is within 0.80 of yours" without revealing either vector. Enables matching with full anonymity, not just pseudonymity. Deferred — genuinely hard, blocks nothing in Phases A–F.

### G5 — Domain-Specific Model Shards
`legal-bert`, `scibert` as community sub-networks. LSH keys prefixed differently. Better within-domain match quality + community sovereignty over model selection without forking protocol.

### G6 — Places (Collaborative Semantic Canvas)
Peers in a shared semantic neighborhood co-create a canvas; posts as nodes positioned by embedding, human-drawn edges for explicit conceptual relationships. Simultaneously: knowledge base, collaborative document, community space, research tool.

### G7 — Supernode Economics (Lightning Network)
Paying a supernode 2 satoshis for embedding computation becomes frictionless. Internet-native micropayment for compute, structurally aligned with value delivered. Implement only after institutional supernodes exist (Phase C3).

### G8 — Epistemic Bridging Across Political Divides
When two peers have proximate embeddings (0.65–0.75) but vocabulary suggesting ideological opposition: "Your thinking overlaps more than your words suggest. Similarity: 0.71." Empirical diplomacy. Attracts conflict resolution researchers and democracy-focused funders.

### G9 — CLI for Agent Automation _(speculative, not user-facing)_
If AI agents become first-class ISC peers (which the protocol supports), a minimal CLI pipe interface becomes useful for agent-to-ISC bridging: `llm-agent | isc chat --pipe <peer-id>`. This is not a user-facing feature and must not appear in user documentation. Implement only if there is a concrete agent deployment use case that demands it.

### G10 — Distributed Embedding Shards
Partition transformer layers across nearby trusted peers. Allows 1B+ parameter models across ordinary browsers. Requires homomorphic encryption or MPC. Active research area — track, don't implement yet.

---

## Documentation (Ongoing)

Write alongside development — compounds over time and unlocks academic partnerships, press, and grant funding.

| Doc | Phase | Content |
|-----|-------|---------|
| `docs/PHILOSOPHY.md` | During Phase B | Why semantic proximity is the right organizing principle; why thought-space navigation > graph-based networking; why ephemeral drift-based identity is more honest than persistent profiles |
| `docs/MODERATION.md` | During Phase B | How semantic coherence as first-line moderation works; why structurally superior to human moderation; where its limits are |
| `docs/BRIDGES.md` | Before B4 | Thought Bridging spec: midpoint vectors, concept banks, bridge suggestion generation, privacy model |
| `docs/PREDATOR_ROUTING.md` | Before E5 | Honest statement of the predation problem; mitigations; fundamental tension; must not minimize |
| `docs/LANGUAGE.md` | Before Phase F | Multilingual support plan; model candidates; civilization-scale argument for early multilingual support |
| `docs/GOVERNANCE.md` | Before F1 | Model RFC process; maintainer multisig; semantic monoculture problem |
| `docs/PROTOCOL_SPEC.md` | During F4 | Human-readable protocol spec separate from implementation |
| `docs/ATPROTO_BRIDGE.md` | Before F6 | AT Protocol bridge design; identity mapping; post translation |
| `docs/COLLECTIVE_INTELLIGENCE.md` | During Phase G | Dense semantic clusters as emergent collective attention; convergence events; what it means scientifically |

---

## Launch Strategy (Refined)

### Pre-launch Checklist (before inviting any real users)
- [ ] Phase A complete: Space View wired, all Phase 2–3 services active, error states covered
- [ ] Phase B2 (Convergence Events) complete: shareable moment exists
- [ ] Phase C4 (net-sim demo) complete: 30-second demo embeddable in posts
- [ ] Phase D1 (Ephemeral Mode) complete: activists/journalists have safe entry
- [ ] Phase F1 (Governance) drafted: model governance documented before community forms
- [ ] One relay deployed publicly with uptime > 99% over 7 days
- [ ] `docs/PHILOSOPHY.md` written

### Vertical-First Launch (from Plan 1, unchanged)

Do not launch broadly. One successful vertical creates proof-of-concept for the next.

**Priority verticals in order**:
1. **AI researchers** — small world (~few thousand globally), high semantic density, comfortable with browser tools, already value decentralization, will self-promote via papers
2. **Open-source developers** — supernode-curious, self-hosting ethos, write good channel descriptions, natural GitHub distributors
3. **Climate scientists and activists** — high urgency, globally siloed, desperate for cross-disciplinary connection, humanitarian framing attractive

**The pitch** (unchanged from Plan 1, still correct):
> "Open a browser tab. Type what you're thinking about. Meet the people closest to your current thought, anywhere on earth. No account. No download. No algorithm selecting who you see."

### Research Partnership
Partner with one computational social science lab to study ISC's network topology — they publish papers, ISC gets academic credibility. A Nature Human Behaviour or PNAS paper generates more sustained credible attention than any launch campaign, and is read by exactly the people who become ISC's most evangelistic early users.

---

## Entry-Point Status Summary

| Entry Point | Current State | Phase A Target | Fully Realized By |
|-------------|--------------|----------------|-------------------|
| **Web UI (browser)** | Working but Space View not wired; discovery UX features unconnected | Space View live; all Phase 2–3 services active | Phase B |
| **Node (relay)** | Admin UI + API exist; no Docker; no Prometheus | Docker + health endpoint | Phase C2 |
| **TUI** | Placeholder | — | Phase C1 |
| **Net-Sim / Demo** | Close to Space View demo | Promoted to standalone interactive demo | Phase C3 |
| **PWA (mobile)** | Works but not installable | Add to Home Screen prompt | Phase D4 |
| **CLI** | 23 command shells, mostly stubs | **Deprioritized indefinitely** — not a user-facing surface | Phase G (speculative) |
| **Browser Extension** | Not started | — | Post-Phase D |
| **Electron** | Not started | — | Post-Phase E |

---

## Open Design Tensions (Updated)

These are not resolved questions. They should inform every design decision:

| Tension | Stakes | Design Response |
|---------|--------|-----------------|
| Does high similarity predict good conversations, or just easy ones? | 0.92+ may route to comfortable but unproductive encounters | Chaos mode default intentionally high; empirical research with deployed system |
| The embedding space is culturally biased | English Wikipedia dominates; concepts from other traditions sparsely represented | Multilingual models (done); honest documentation; governance (F1) |
| The space is not neutral | Concepts discussed together in opposition still cluster near each other | UI language: "expressed contexts overlap" not "you are similar" |
| The space can be manipulated (semantic SEO) | Users craft channel descriptions to reach specific clusters | Coherence check; TTL ephemerality reduces incentive; transparency |
| The map becomes the territory | If ISC succeeds, people write to land near targets, not express actual thought | Ephemerality and chaos mode are partial defenses |
| The predator routing problem | Semantic routing enables precision predation; no clean solution | Phase E5 mitigations; honest documentation; minimum TTL before contact |
| The semantic monoculture problem | Global interoperability requires shared coordinates; shared coordinates require cultural assumptions | Governance framework (F1); per-community model shards (G5) |
| The forgetting problem | Fully ephemeral P2P has no archive; impaired collective memory | Opt-in archival; relationship consent (done); honest documentation |
| The filter bubble inversion | Perfectly working ISC with no chaos = most efficient echo chamber ever built | Chaos mode default high; disciplinary bridging (G8) |
| The topology is not flat | Dense regions (family, food, money) have many matches; sparse regions feel lonely | Detect sparse region; UI for "you're in a sparse region — try broader description" |
| The Space View is the algorithm | When layout IS the algorithm, the projection method (UMAP/t-SNE) becomes a political choice | Document projection method; allow community to propose alternatives via governance |
| **NEW: CLI as agent surface** | AI agents as ISC peers is in the spec but not designed — when this happens, it changes the semantic neighborhood composition | Design CLI `--pipe` mode now; `isc chat --pipe` before agents find their own way in |
| **NEW: The service simplification problem** | Phase 1–3 services were simplified during integration; "exists" ≠ "works" | Phase A audit; explicit validation tests for every service |

---

## Summary Table

| Phase | Effort | Key Milestone |
|-------|--------|---------------|
| **A** — Reality Check & Wiring (Days 1–3) | ~3.5d | Demo peers visible in <1s; Space View live; all services wired; semantic match validated |
| **B** — Discovery UX (Week 1–2) | ~5.5d | Bridge Moment, Thought Twin, Convergence Events, Thought Bridging, Thought Drift |
| **C** — Terminal & Relay Surfaces (Week 2–4) | ~4d | Real TUI (ink); production relay Docker + Prometheus; shareable net-sim demo |
| **D** — Ephemeral, Subscriptions & Mobile (Week 3–4) | ~5d | Deniable identity; lurk mode; semantic subscription; mobile layout + PWA |
| **E** — Privacy Hardening (Week 4–7) | ~10d | Forward secrecy; relay-only mode; predator routing mitigations |
| **F** — Protocol & Ecosystem (Month 2–3) | ~3w | Open protocol spec; governance; Nostr bridge; Bluesky bridge |
| **G** — Advanced (Month 3+) | open | Vibe rooms; ZK proofs; policy research tools; distributed shards |
