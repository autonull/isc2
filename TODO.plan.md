# ISC Development Plan — Prioritized & Sequenced

**Generated**: 2026-03-19
**Source**: Complete synthesis of TODO.md (§1–§17), COMPLETION_PLAN.md, ROADMAP.md
**Current state**: Vanilla UI complete, E2E tests passing, SHA-256 stub embeddings, branch `fix-ui-e2e-crashes-12052808057943733772`

---

## Sequencing Principles

1. **Unblock real semantics first** — everything meaningful about ISC depends on real embeddings; SHA-256 stub makes the app a toy
2. **Security before users** — XSS must be fixed before any real users touch the app
3. **Network viability before UX polish** — bootstrap nodes + persistence make the network real; without them, UX improvements have nothing to run on
4. **Cold-start perception before cold-start engineering** — demo mode and ghost peers are fast wins that make the app feel inhabited before real peers exist
5. **Governance earlier than the roadmap assumes** — embedding model selection is contested the moment there's a community; lightweight governance must exist in Phase 1 of protocol work, not Phase 4 DAO
6. **Defer speculative until core is proven** — ZK proofs, distributed shards, policy density maps are right answers to future problems, not current ones

---

## Explicit Non-Decision: No 1:1 Video Calls

**§15, §17**: `COMPLETION_PLAN.md` puts video call testing at P1. This is wrong priority.
Video is a solved problem (Zoom, FaceTime). It does not differentiate ISC and does not leverage semantic proximity.
The right bet is **Vibe Rooms** (Phase 8): audio-only WebRTC mesh that auto-forms from dense semantic clusters, with natural entry/exit as you drift. That is what only ISC can offer.
1:1 video infrastructure already exists in `apps/browser/src/video/` — it is not being deleted, just not prioritized.

---

## Phase 0 — Foundation (Days 1–3) ⚡ Do Nothing Else First

These three changes transform the app from demo to real product.

### P0.1 — Activate Real Embeddings ★ CRITICAL BLOCKER
**§3, §14, COMPLETION_PLAN.md §1.1** | **Effort**: ~5 hours

Every semantic feature is broken without this. "AI ethics" and "machine learning morality" never match under SHA-256. This single change transforms ISC from toy to real.

- Add `@xenova/transformers` to browser deps — adapter already exists at `packages/adapters/src/browser/model.ts`, needs activation
- Create `EmbeddingService` singleton with lazy loading + IndexedDB cache
- Replace SHA-256 stub with `pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')` (384-dim)
- Add loading indicator during first model download (~22MB)
- Fallback to stub if model fails to load (offline resilience)

**Done when**: `cosine("AI ethics", "machine learning morality") > 0.7`

---

### P0.2 — XSS / Content Sanitization ★ SECURITY PREREQUISITE
**§4** | **Effort**: ~2 hours

A single XSS in a P2P app with no central takedown mechanism is reputational catastrophe. Must precede any real user traffic.

- Wrap all user-generated content renders with DOMPurify
- Audit surface: channel names, descriptions, chat messages, peer display names, away messages
- Add CSP headers in Vite config
- Add Playwright test: `<script>alert(1)</script>` in channel description does not execute

**Done when**: No user-controlled string executes as code in any surface

---

### P0.3 — Bootstrap Peer Pool
**§1, §14** | **Effort**: ~4 hours

Without at least one always-online relay, new users see an empty network. One reliable relay changes the entire first-run experience.

- Deploy minimal relay node using `apps/node` as Docker container
- Hardcode relay multiaddrs into `packages/network` bootstrap list
- Verify new browser tab connects within 5 seconds of opening

**Done when**: Fresh browser tab peers with relay node without any manual configuration

---

## Phase 1 — Real Network (Week 1–2)

### P1.1 — ServiceWorker / SharedWorker Persistence
**§2** | **Effort**: ~1 day

Transforms ISC from "tab that disconnects" to "communication tool." Enables async message receipt, DHT presence while backgrounded, notification delivery.

- Implement SharedWorker wrapping libp2p node so DHT presence survives tab backgrounding
- Message queue: deliver messages received while tab was hidden on next focus
- ServiceWorker scaffold for push notifications (encrypted payload via minimal push relay)

---

### P1.2 — Real Cross-Tab / Cross-Device Message Delivery
**§2** | **Effort**: ~1 day | **Depends on**: P1.1

Currently localStorage-simulated. Wire actual libp2p DataChannel for true P2P delivery.

- Replace localStorage message bus with libp2p DataChannel events
- Verify messages flow between two real browser tabs on separate devices/networks
- Cross-device integration test: two machines, same channel, bidirectional messages

---

### P1.3 — Onboarding Flow + First-Run Experience
**§5** | **Effort**: ~1 day | **Depends on**: P0.1

"What are you thinking about right now?" is the most important UX question. First impression determines activation.

- 3-step onboarding:
  1. Name/identity (no email, no password)
  2. First channel description — show embedding preview as you type
  3. "Scanning for thought neighbors" — live DHT query, cosine scores arriving in real time
- Skip if user already has channels (returning user detection)
- Hero copy: "Open a Tab. Type what you're thinking about. Meet people closest to your thought. No account. No download. No algorithm."

---

### P1.4 — File / Media Transfer
**§2** | **Effort**: ~2 days | **Depends on**: P1.2

Chunked, encrypted blob transfer over WebRTC DataChannel. Voice notes, images, documents over zero-infrastructure channel.

- Chunked transfer with progress indicator
- Encryption via existing libp2p noise protocol
- MIME type detection, preview for images
- Reject files over configurable size limit (default: 50MB)

---

## Phase 2 — Cold-Start Perception (Week 2–3)

Fast, high-leverage wins that make the network feel inhabited before critical mass exists.

### P2.1 — Demo / Simulation Mode
**§1** | **Effort**: ~half day

Inject ~10 realistic synthetic peers on first load so semantic matching UI is tangible before real peers exist. Flagged clearly as demo.

- Seed synthetic peer profiles covering diverse topics
- Inject as fake DHT responses when real peer count < 3
- Banner: "Showing demo peers — real peers will replace these as network connects"
- Auto-dismiss when real peers arrive

---

### P2.2 — Ghost Peers
**§1, §5** | **Effort**: ~half day

"3 peers were thinking near here an hour ago." Solves cold-start perception and adds temporal depth. Prerequisite for Space View.

- Store last-seen timestamp alongside peer records in IndexedDB
- Render expired-but-recent peers (within 4 hours) as dimmed with elapsed time label
- Ghost peers appear in Space View as translucent points with timestamp

---

### P2.3 — Sleeping State / Away Messages
**§1** | **Effort**: ~half day

Solves the problem where two peers who'd be perfect matches keep just barely missing each other because their online hours don't overlap.

- On `beforeunload`: prompt "Stay visible while you sleep? (4 hours)"
- Publish sleep record with higher TTL:
  ```json
  { "type": "sleep", "vec": [...], "channelID": "...", "awayUntil": 1741420000, "message": "back in a few hours" }
  ```
- On return: surface messages left by peers during sleep
- Show sleeping peers with moon icon in peer list; different from ghost (intentional vs. expired)

---

### P2.4 — Shareable Invite Links + QR Codes
**§1** | **Effort**: ~half day

`#join/PEER_ID` bypasses DHT cold-start by dialing known peer directly. Viral distribution and in-person handoff.

- Parse `#join/<PEER_ID>` on load and attempt direct dial
- Generate share link button in peer profile view
- QR code generation using `qrcode` library — "QR identity card" for conferences, protests, clinics

---

### P2.5 — Chaos Mode
**§5** | **Effort**: ~half day | **Depends on**: P0.1

Perfect match optimization is a local maximum trap. Users who derive most long-term value from ISC are slightly out of place — near enough to communicate, far enough to introduce new ideas.

- Add "serendipity" slider to Settings (maps to cosine threshold spread parameter)
- **Default intentionally higher than "comfortable"** — not left to user to configure up
- In-app explanation: "A wider range means more unexpected connections. ISC works best when you're slightly outside your comfort zone."
- System should explain why serendipity serves long-term interests better than perfect matching

---

## Phase 3 — Semantic Quality & Space View (Week 3–5)

### P3.1 — Space View (2D Semantic Map)
**§5** | **Effort**: ~2–3 days | **Depends on**: P0.1, P2.2

"You are here, in thought-space." `apps/net-sim` is already close — polish it into real Space View.
Space View has no algorithmic curation. Layout is the algorithm. Users immediately understand this and trust it.

- Run UMAP or t-SNE projection in-browser on locally observed peer vectors
- Self as glowing point, live peers as colored points, ghost peers dimmed/translucent
- Dense clusters as brighter/warmer regions
- Click peer point → open conversation
- Thought drift trail: breadcrumb showing your vector position history
- "In February, you were thinking near [peer A]. In March, your paths diverged."

---

### P3.2 — Multilingual Embedding Support
**§3, §17** | **Effort**: ~1 day | **Depends on**: P0.1

The roadmap treats ISC as an English-only app. This is a mistake to correct from day one.
`multilingual-e5-small` (~120MB, fits browser High tier budget) lets a Portuguese speaker match with a Japanese speaker based on meaning. Language stops being a barrier to finding intellectual kin.

- Add `Xenova/multilingual-e5-small` as selectable model in Settings
- LSH namespace prefixed by model hash (protocol already supports this per §3)
- Language auto-detect on channel description input; suggest multilingual model
- Document model tradeoffs (size, precision, cross-lingual coverage) in Settings UI
- Alternative candidate: `paraphrase-multilingual-MiniLM-L12-v2` (~480MB, better quality, may be too large)

Write `LANGUAGE.md` alongside this work (see Documentation section).

---

### P3.3 — Model Upgrades / Configurable Embedding Model
**§3** | **Effort**: ~half day | **Depends on**: P3.2

Make embedding model configurable so communities can run domain-specific models (medical, legal, code) for higher-precision matching in specialized contexts.

- Model selector in Settings (currently two: all-MiniLM-L6-v2, multilingual-e5-small)
- Model registry infrastructure already supports signing and announcing model manifests
- LSH key prefix per model — peers on different models still discoverable, just in different namespaces

---

### P3.4 — Channel UI Improvements (Mixer Board Style)
**§5** | **Effort**: ~1 day

- In-place editable name/description (click to edit, blur to save)
- In absence of description, name serves as description — hide description field until user explicitly triggers editing; when erased, hide it again
- Mini-slider for "specificity" (controls cosine threshold for this channel)
- Status indicators: # new messages, ping time to matched peers
- Archive/hide button: remove from active list, keep in IndexedDB trash — not permanent delete

---

### P3.5 — Embed Conversation History
**§3** | **Effort**: ~half day | **Depends on**: P0.1

Re-embed user's outgoing message patterns over time, not just static profile bio. Matching improves as people use it.

- Maintain rolling embedding of last N (20) outgoing messages per channel
- Blend: 70% channel description + 30% recent outgoing messages
- Show "your expressed position" drift indicator in channel card
- Privacy: stays local, never announced separately

---

### P3.6 — Relationship Persistence by Consent
**§12** | **Effort**: ~half day | **Depends on**: P1.2

After meaningful encounter, two peers can mutually sign a "contact preservation" event. Preserves relational fact without violating ephemerality principle.

- UI: "Preserve this connection?" prompt after N messages exchanged
- Both peers must consent; stores signed mutual acknowledgment, not message content:
  ```json
  {
    "type": "contact_preserved",
    "peerA": "QmX...",
    "peerB": "QmY...",
    "similarity_at_time": 0.84,
    "channel_model": "all-MiniLM-L6-v2",
    "timestamp": ...,
    "sig_a": ...,
    "sig_b": ...
  }
  ```
- Stored in IndexedDB; surfaces on next session as "Preserved connection from [date]"
- Note in UI: "This preserves only the fact that you connected, not what you said."

---

## Phase 4 — Discovery & Matching UX (Week 5–7)

### P4.1 — Bridge Moment UI
**§5** | **Effort**: ~1 day | **Depends on**: P1.1

"You've been thinking near [anonymous peer] for 11 days. Your channels are ~0.67 similar."
The fact that encounter was preceded by 11 days of unknowing proximity makes it feel meaningful rather than random.

- Track peer proximity history in IndexedDB: peer ID, cosine score, first/last seen
- Surface prompt after 7+ days near a peer (0.55–0.70 similarity) without initiating contact
- UI: subtle banner "You've been near [🌀 Anonymous Peer] for 11 days · 0.67 · [Reach out] [Dismiss]"
- Target range 0.55–0.70: close enough to have something to say, different enough for it to matter

---

### P4.2 — "Your Thought Twin"
**§5** | **Effort**: ~half day | **Depends on**: P4.1

Weekly/monthly surface of the peer with highest accumulated semantic similarity across all channels over time.
"For the past 6 weeks, this peer has been thinking about nearly identical things as you, without knowing you exist."
This is the story people will tell about ISC. The feature that makes people text their friends "you need to try this."

- Compute accumulated similarity (average cosine × duration) across all observed peers
- Weekly in-app notification: "Your Thought Twin this week"
- Never reveal identity until both peers consent to connect (uses P3.6 consent mechanism)

---

### P4.3 — Thought Bridging (Local AI Feature)
**§6** | **Effort**: ~2 days | **Depends on**: P0.1

When two peers at 0.60–0.75 similarity initiate conversation, compute vector midpoint, reverse-lookup nearest natural language concept.
Runs entirely locally — no API call, no surveillance. Embedding model doing what it already does, but backward: vector → concept rather than concept → vector.

- Pre-build static concept bank: ~10,000 phrase embeddings indexed by meaning (one-time build, ship as static asset)
- On conversation initiate: compute midpoint vector, k-NN lookup in concept bank
- Prompt: "They're thinking about [paraphrase of their channel]. You're thinking about [yours]. A bridge might be: 'How does [bridging phrase] relate to your thinking?'"
- Opt-in toggle in Settings

Write `BRIDGES.md` alongside this work (see Documentation section).

---

### P4.4 — Convergence Events
**§5** | **Effort**: ~1 day | **Depends on**: P1.1, P3.1

"7 unconnected people posted semantically identical thoughts in the past hour. No algorithm selected this. They independently converged."
Semantic equivalent of a Twitter trend — except causally clean. No engagement optimization, no retweet cascades.
The most shareable thing ISC can produce. A screenshot tells ISC's story better than any description.

- Detect when ≥5 unconnected peers post within 0.05 cosine of each other in <1 hour window
- Surface as in-app notification + visual pulse in Space View
- Generate shareable "convergence card" (screenshot-able summary with similarity scores)

---

### P4.5 — Semantic Time Capsule / Thought Drift Visualization
**§3, §5** | **Effort**: ~1 day | **Depends on**: P3.1

"Your thinking has moved 23° toward [topic cluster] since last month."
Deep personal value, irreplaceable local history, powerful retention. No other platform shows you how your mind moves.

- Store time-series of each channel's embedding history in IndexedDB (one snapshot per edit)
- Space View: show trail/spiral of historical positions for selected channel
- Surface: "Since January, your [channel] has drifted toward [nearest cluster label]"
- This history is stored locally and is irreplaceable — creates long-term retention by construction

---

## Phase 5 — Platform Expansion (Week 7–10)

### P5.1 — iOS/Android PWA Hardening
**§8** | **Effort**: ~half day

- Proper `manifest.webmanifest` with icons, theme color, `display: standalone`
- `beforeinstallprompt` handler with "Add to Home Screen" UI prompt
- Encrypted push notification scaffold via web-push (payload relayed through minimal push server)

---

### P5.2 — Browser Extension
**§8** | **Effort**: ~3 days

Persistent background libp2p node across all tabs; delivers notifications; leap from "web app" to "network citizen."

- Manifest V3 extension with Service Worker background script
- Persistent libp2p node; injects peer ID into any open ISC tab
- Badge count for unread messages
- Shared identity across tabs — one peer ID regardless of how many ISC tabs are open

---

### P5.3 — Headless Node / Docker Image
**§8** | **Effort**: ~1 day

Community-run nodes prevent network from dying when tabs close. Institutional deployment target.

- Polish `apps/node` into documented, one-command Docker deploy
- `docker run ghcr.io/isc2/node --name "My Relay" --announce`
- Health endpoint, Prometheus metrics, graceful shutdown
- README: framed as "community intellectual infrastructure," not just "relay server"

---

### P5.4 — Electron Desktop App
**§8** | **Effort**: ~2 days

For always-on relay case. Hospitals, law firms, research labs, and militaries running ISC on intranet want a system-tray app always connected — not a browser tab.

- Wrap browser app in Electron with system-tray presence
- Auto-start on login option
- Intranet deployment mode: configure custom bootstrap relay, disable public DHT
- Signed installers for macOS, Windows, Linux

---

### P5.5 — Deniable Identity / Ephemeral Mode
**§4** | **Effort**: ~1 day

Allow ephemeral identities with no persistence so participation leaves no trace in any storage.
For whistleblowers, activists, abuse survivors, clinicians — this is the entire product.

- "Ephemeral session" toggle at startup: generates in-memory keypair only, no IndexedDB writes
- Warns user: "This session leaves no trace. Closing this tab erases your identity permanently."
- No contact preservation, no channel history, no sleep announcements
- Separate from metadata resistance (P6.2) — this is about local storage, not network observation

---

### P5.6 — Lurk Mode
**§12** | **Effort**: ~2 hours

Join channels without including them in your thought vector. Useful for perspective-taking, arguing with alternative views, escaping echo chambers.

- Toggle in channel options: "Lurk (don't include in my thought vector)"
- Lurked channels appear in sidebar with 👁 icon
- Excluded from embedding blend computation (P3.5)

---

### P5.7 — Semantic Subscription (Region of Thought-Space)
**§3** | **Effort**: ~2 days | **Depends on**: P0.1, P1.1

"Follow ideas, not identities." Subscribe to a region of embedding space rather than to a person.
Architecturally natural (persistent DHT query with similarity threshold) but UX concept is radical.

- UI: "Subscribe to region" saves current channel embedding + threshold as subscription
- Background: poll DHT for new content landing within threshold
- Notification when new content enters subscribed region — regardless of who posts it
- You discover people you'd never know to follow; information routes to those most likely to find it valuable by construction

---

## Phase 6 — Privacy Hardening (Week 10–14)

Do these before any high-stakes use case launch (activists, journalists, clinicians, abuse survivors).

### P6.1 — Forward Secrecy
**§4** | **Effort**: ~2 days

- Rotate session keys per-conversation (Double Ratchet or similar)
- Past messages cannot be decrypted if long-term key is compromised
- Key rotation is transparent to UX

---

### P6.2 — Metadata Resistance / IP Privacy
**§4** | **Effort**: ~3 days

IP address via WebRTC is the primary deanonymization vector. This unlocks high-stakes use cases.

- `--relay-only` mode: all traffic routed through relay nodes, hiding participant IPs from each other
- Optional Tor/I2P pluggable transport interface
- Warn users in Settings when direct (IP-exposing) WebRTC connections are active
- Note: ISC's current privacy is strong-by-architecture but not adversarially hardened. This changes that.

---

### P6.3 — Sealed Sender
**§4** | **Effort**: ~2 days

- Encrypt sender identity inside message payload (Signal-style)
- Relay nodes cannot observe social graph even in transit

---

### P6.4 — Semantic Spam Resistance
**§4** | **Effort**: ~1 day | **Depends on**: P0.1

Spam is structurally expensive in ISC because spammers can't fake semantic coherence cheaply.

- Embedding-based rate limiting: peers whose announced content consistently fails to match interested peers are deprioritized
- Local reputation score per peer; mute/block events propagate semantic feedback
- Rate limits per LSH bucket per time window

---

### P6.5 — Predator Routing Mitigations
**§4** | **Effort**: ~2 days | **Depends on**: P6.4

This is the hardest design tension in the system. The feature that enables beautiful serendipitous connection is exactly what enables precision predation. Malicious actors can craft channel descriptions to land near vulnerable clusters (grief, addiction, loneliness, financial desperation, radicalization).
There is no clean solution. But partial mitigations are implementable and should be.

- **Minimum TTL before contact initiation**: peer must have been in a semantic neighborhood long enough to establish presence before they can dial peers in it — prevents rapid targeting
- **Cluster-level abuse detection**: if many mute/block events originate from encounters in a specific semantic region, temporarily quarantine that region from new contact initiation
- **Local manipulation classifiers**: lightweight pattern detection on incoming messages for manipulation signatures (urgency escalation, isolation requests, financial asks)
- Write `PREDATOR_ROUTING.md` documenting the fundamental tension honestly — this must be stated plainly, not minimized

---

### P6.6 — ZK Proximity Proofs
**§4** | **Effort**: ~1 week (research-heavy)

Zero-knowledge proof that "my vector is within 0.80 of yours" without revealing either vector.
Enables matching with full anonymity, not just pseudonymity. Privacy primitive no existing platform offers.
Deferred because it is genuinely hard and blocks nothing else. Do after P6.1–P6.5.

- Research current ZK SNARK approaches for inner product / cosine similarity
- Proof of concept before full integration

---

## Phase 7 — Protocol & Governance (Month 4–6)

### P7.1 — Governance Framework for Model Decisions ★ EARLIER THAN ROADMAP SUGGESTS
**§9, §17** | **Effort**: ~2 days (design doc + process)

The roadmap defers governance to Phase 4 DAO. This is too late.
Embedding model selection is the most consequential governance decision in the system — it determines which semantic geometry everyone shares. It also carries deep political and ethical weight: whose theory of meaning gets to organize global thought-routing infrastructure? A model trained predominantly on English web text routes differently than one trained on Mandarin social media or Arabic news.

This will become contested the moment there is a community. A lightweight process now prevents crisis later.

- Write `GOVERNANCE.md`:
  - Two-week RFC period + maintainer multisig for embedding model changes
  - Signed model registry with model manifests
  - Acknowledge the semantic monoculture problem: global interoperability requires shared coordinates; shared coordinates require shared cultural assumptions baked into model; this is political, not just technical
- Establish model governance before any community-facing launch

---

### P7.2 — Protocol Versioning
**§9** | **Effort**: ~1 day

- Semver'd wire protocol with negotiation
- Network can evolve without hard forks

---

### P7.3 — Community Bootstrap Node Registry
**§9** | **Effort**: ~1 day

- DNS-over-HTTPS or DHT-resident list of known-good bootstrap nodes, maintained by community
- No single company controls it
- Connects to Supernode as Community Infrastructure narrative (see P7.6)

---

### P7.4 — Open Protocol Spec
**§9** | **Effort**: ~3 days

What makes this a protocol rather than an app.

- Human-readable spec document separate from implementation
- Enables third-party implementations: mobile-native, embedded, CLI, AI agents
- Reference implementation is `apps/browser`; spec is authoritative

---

### P7.5 — Nostr Keypair Import/Export
**§7** | **Effort**: ~1 day

- secp256k1 ↔ ed25519 bridge identity layer
- Users bring existing decentralized identity; immediate access to large Nostr user base

---

### P7.6 — Supernode as Community Infrastructure
**§9** | **Effort**: ~2 days (framing, docs, incentive design)

Reframe supernodes as "community intellectual infrastructure" — not "relay server."
Universities, libraries, foundations can run supernodes as public good.
They get: credibility ("we contribute to open semantic web"), priority access and better matching for their community, governance role in protocol.
This framing attracts institutional support, press coverage ("university runs public semantic relay"), and a class of high-uptime supernodes far more reliable than individual volunteers.

- Publish institutional supernode guide (setup, governance participation, public good framing)
- Design governance participation incentive (supernodes get vote weight in model RFC process)
- Connect to Supernode Economics (Phase 8) — Lightning micropayments come after institutions are running nodes

---

### P7.7 — AT Protocol / Bluesky Bridge
**§7** | **Effort**: ~1 week

ISC positioned as semantic layer on top of Bluesky's open social graph. Growth vector, not threat.

- Design identity mapping and post translation layer
- Interop spec exists in ROADMAP.md but isn't designed — plan it now, implement Phase 7 end
- ISC brings meaning-based discovery to Bluesky's social graph

---

## Phase 8 — Advanced / Speculative (Month 6+)

Revisit after network has real users and proven semantics. All of these are right ideas, wrong time.

### Semantic Infrastructure
- **Semantic content routing** — posts propagate toward semantically interested peers; replacement for engagement-driven feeds; long-term moat; new message type on existing DHT routing, not a rewrite
- **Semantic multicast** — `PUT /isc/broadcast/<modelHash>/<lshHash>` → message propagates to all peers in LSH bucket; community announcements, emergency broadcasts, semantic newsletters
- **Topic clustering + named communities** — automatically surface emergent "semantic neighborhoods" and give them discoverable labels; decentralized subreddits, no human moderation needed
- **Domain-specific model shards** — legal-bert, scibert as community sub-networks; LSH keys prefixed differently; two advantages: (1) better within-domain match quality, (2) community sovereignty over model selection without forking protocol; model registry already supports this

### Social Features
- **Vibe rooms** — audio-only WebRTC mesh in semantic neighborhood; voice rooms auto-forming from dense semantic clusters, enter and exit naturally as you drift; preferred over 1:1 video (§15)
- **Channel forking** — `derivedFrom` field in Channel schema; enables semantic lineage; communities trace how shared concept fragmented into specialized sub-discussions:
  ```json
  { "id": "ch_labor_impacts_7f3a", "name": "AI ethics: labor focus", "derivedFrom": "ch_ai_ethics_9b2f" }
  ```
- **Relation ontology extension** — current 10 relation tags fixed for Phase 1; community extension mechanism for model shards without forking protocol (scientific: replicates, contradicts, extends; legal: applies_to, overrides, defines)

### Discovery Modes
- **Disciplinary bridging mode** — optional filter intentionally surfacing peers from different inferred disciplines (detected by vocabulary distribution) who are nonetheless semantically proximate; biologist studying network resilience and city planner studying transit failure will never find each other on Twitter; vocabularies disjoint, but mental models — redundancy, cascade failure, critical nodes — land in nearly same semantic neighborhood; ISC is first system that would find and introduce them; worth stating explicitly as design goal, not just emergent property
- **Epistemic bridging across political divides** — when two peers have proximate embeddings (0.65–0.75) but surface vocabulary suggesting ideological opposition, surface: "Your thinking overlaps more than your words suggest. Similarity: 0.71."; empirical diplomacy; not about being nice — about discovering actual shared semantic ground; could attract attention from conflict resolution researchers, democracy-focused funders
- **Opt-in live semantic heartbeat mode** — channel embedding continuously updated based on what you're reading, writing, dwelling on; privacy-extreme-sensitive; design question: should ISC try to close gap between private thought and announced channel, or honor that gap? Current design correctly treats announcement as intentional; only reconsider with explicit user consent

### Public Benefit / Civic Tech
- **Aggregate semantic density maps for policy feedback** — governments and NGOs understand what citizens are focused on without surveillance; aggregate statistics over vectors, not surveillance of individuals; zero individual tracking; new form of democratic signal — not polling (requires active participation), not social media scraping (requires surveillance), but passive semantic aggregation from consenting, privacy-preserving network; policy researchers would find this data extraordinary
- **Supernode economics** — Lightning Network integration; paying supernode 2 satoshis for embedding computation becomes frictionless; internet-native micropayment for compute, structurally aligned with value delivered

### Platform & Interoperability
- **ActivityPub gateway** — ISC channels federate to Mastodon/Pixelfed and vice versa; ISC as privacy-preserving on-ramp to Fediverse
- **IPFS content pinning** — anchor long-form content to IPFS CIDs announced via ISC's DHT; semantic index over IPFS content
- **Matrix bridge** — institutional/intranet adoption where Matrix is already deployed
- **IEML / Semantic Web ontologies** — alternate embedding interfaces; IEML (Internet Epistemological Markup Language) and RDF/OWL-based embeddings for communities with formal ontology requirements

### Advanced / Research
- **Places (persistent collaborative semantic canvas)** — peers in shared semantic neighborhood co-create a canvas; posts as nodes positioned by embedding, human-drawn edges for explicit conceptual relationships; simultaneously: knowledge base, collaborative document, community space, research tool; node graph accumulated over time is distributed knowledge artifact exportable as semantic ontology
- **Distributed embedding shards (speculative)** — partition transformer layers across nearby trusted peers (Peer A: layers 1–3, Peer B: layers 4–6); allows 1B+ parameter models across ordinary browsers; requires homomorphic encryption or MPC; active research area
- **Relationship persistence by consent (enhanced)** — build on P3.6 to allow optional archival by trusted institutions with user consent; addresses the Forgetting Problem (fully ephemeral P2P produces no archive; society communicating primarily through ISC would have dramatically impaired collective memory; TTL model is right default for privacy, but system should acknowledge the tradeoff explicitly)

---

## Documentation (Ongoing, Parallelizable)

Write alongside development — they compound over time and unlock academic partnerships, press, and grant funding.

| Doc | When | Content |
|-----|------|---------|
| `PHILOSOPHY.md` | During Phase 1 | Why semantic proximity is right organizing principle; why thought-space navigation > graph-based networking; why ephemeral drift-based identity is more honest than persistent profiles; foundation for grant applications, academic partnerships, press |
| `MODERATION.md` | During Phase 2 | How semantic coherence as first-line moderation works; why structurally superior to human moderation; where its limits are; ISC's approach — spam and harassment structurally disadvantaged because they don't match semantic neighborhood — is post-human-moderator future of content governance; distinctive and publishable argument |
| `LANGUAGE.md` | Before P3.2 | Plan and timeline for multilingual support; model candidates and tradeoffs; LSH shard strategy for multilingual namespacing; civilization-scale argument for why this must happen early |
| `BRIDGES.md` | Before P4.3 | Thought Bridging spec: how midpoint vectors are computed, how concept banks work, how bridge suggestions generated locally, privacy model |
| `COLLECTIVE_INTELLIGENCE.md` | During Phase 4 | How dense semantic clusters represent emergent collective attention; how convergence events work; what it means scientifically that network self-organizes semantically without any central signal |
| `PREDATOR_ROUTING.md` | During Phase 6 | Dedicated honest threat model for predator routing problem; mitigations (TTL floor, cluster quarantine, manipulation classifiers); acknowledgment that there is no clean solution — the feature that enables serendipitous connection is the same feature that enables precision predation; must be stated plainly, not minimized |
| `GOVERNANCE.md` | During Phase 7 | Model RFC process; maintainer multisig; semantic monoculture problem and political/ethical dimensions of model selection |

---

## Net-Sim as Marketing Tool

**§10** — `apps/net-sim` is already almost Space View. Before any public launch, invest 1–2 days polishing it into an embeddable, shareable network simulation showing 50 peers finding each other in embedding space.
Embed in blog posts, Hacker News comments, README, conference slides.
No description competes with a 30-second interactive demo. This is the clearest statement of what ISC is.

---

## Use Cases: Design and Demo Targets

**§10** — These are not vague aspirations. Each is a concrete deployment scenario that should inform design decisions and demo preparation.

| Use Case | Key Property | Design Implication |
|----------|-------------|-------------------|
| **Disaster / crisis communications** | ISC works over LAN/mesh with no internet; browser tabs on same WiFi during infrastructure failure still form ISC network | Offline/local-first mode; LAN peer discovery via mDNS |
| **Intranet-isolated organizations** | Hospitals, law firms, research labs, militaries; zero cloud required; single relay on intranet + browsers = entire deployment; no data leaves building | Electron app (P5.4); local-only bootstrap config |
| **Academic / research self-organization** | Semantic matching across paper abstracts and bios; researchers in overlapping fields find each other across institutional silos | Domain-specific models (Phase 8); university supernode partnership |
| **AI agents as first-class peers** | LLM-backed agent with peer ID, bio embedding, WebRTC DataChannel is already supportable by protocol; human-AI and AI-AI coordination over same network | Protocol spec (P7.4); agent SDK |
| **Crisis coordination infrastructure** | Someone in Lagos needs flood relief; doctor in London has training; logistics coordinator in Accra available — all three land within 0.80 of each other within minutes of crisis emerging, without knowing each other or any central dispatcher | Semantic multicast (Phase 8); OCHA / Red Cross partnership potential |
| **Distributed peer review** | Embed paper abstract; find researchers whose channels land within 0.80; offer review to most semantically proximate peers | Semantic subscription (P5.7); academic launch vertical |
| **Semantic alerting for journalists** | Alert fires when idea journalist cares about moves through semantic neighborhood, regardless of who carries it | Semantic subscription (P5.7); configurable threshold per subscription |

---

## Launch Strategy

**§10** — Do not launch broadly. Vertical-first: within a single vertical, matching quality is excellent, cold-start problem shrinks, demos are compelling. One successful vertical creates proof-of-concept for the next.

**Priority verticals** (in order):

1. **AI researchers** — small world (~few thousand globally), high semantic density, already value decentralization, comfortable with browser tools, will self-promote via papers
2. **Open-source developers** — supernode-curious, self-hosting ethos, write good channel descriptions, natural GitHub distributors
3. **Climate scientists and activists** — high urgency, globally siloed, desperate for cross-disciplinary connection, humanitarian framing attractive

**Research partnership**: Partner with one computational social science lab to study ISC's network topology. They run analysis on aggregate anonymized DHT data, publish papers ("Semantic Self-Organization in Decentralized Social Networks"), ISC gets academic credibility and a community of researchers who promote it by publishing with it. A Nature Human Behaviour or PNAS paper generates more sustained, credible attention than any launch campaign — and is read by exactly the people who become ISC's most evangelistic early users.

**The pitch** (first sentence of everything):
> "Open a browser tab. Type what you're thinking about. Meet the people closest to your current thought, anywhere on earth. No account. No download. No algorithm selecting who you see."

---

## Open Design Tensions

**§13** — These are not resolved questions. They are active constraints that should inform every design decision. Document them; don't pretend they don't exist.

| Tension | Stakes | Design Response |
|---------|--------|-----------------|
| **Does high similarity predict good conversations, or just easy ones?** | 0.92+ similarity may route to comfortable but unproductive encounters; 0.70–0.80 may be optimal | Chaos mode (P2.5); empirical research with deployed system |
| **The embedding space is culturally biased** | English Wikipedia and web text dominate most models; concepts from other intellectual traditions sparsely represented | Multilingual models (P3.2); honest documentation; governance (P7.1) |
| **The space is not neutral** | Concepts discussed together even in opposition cluster near each other; embedding encodes discourse about ideas, not ideas themselves | UI language: "your expressed contexts overlap 0.82" not "you are 82% similar" |
| **The space can be manipulated (semantic SEO)** | Someone wanting to reach certain users can craft channel description to land near them through learned associations | Coherence check; TTL ephemerality reduces incentive; transparency about what score means |
| **The map becomes the territory** | If ISC succeeds, people write channel descriptions to land near people they want to meet, not to express actual thought; same dynamic that destroyed Twitter hashtags | Ephemerality and fuzzy spread parameter are partial defenses; UI language that maintains epistemic humility |
| **The predator routing problem** | Semantic routing that enables serendipitous connection enables precision predation; no clean solution | P6.5 mitigations; honest documentation; minimum TTL before contact |
| **The semantic monoculture problem** | Global interoperability requires shared coordinates; shared coordinates require cultural assumptions baked into one model | Governance framework (P7.1); per-community model shards (Phase 8); explicit acknowledgment |
| **The forgetting problem** | Fully ephemeral P2P produces no archive; society communicating primarily through ISC has impaired collective memory | Opt-in archival by trusted institutions; relationship persistence by consent (P3.6); honest documentation |
| **The filter bubble inversion** | Perfectly working ISC with no chaos could be the most efficient echo chamber ever built | Chaos mode default high (P2.5); disciplinary bridging (Phase 8) |
| **The topology is not flat** | Dense regions (family, food, money) have plentiful matches; sparse regions (Lie algebras, Austronesian phonology) feel lonely | Detect sparse region; help user find better-expressed channel description; UI for "you're in a sparse region" |
| **The space has roads, deserts, and cliffs** | Bridge vectors (network, model, system) match across communities due to ambiguity; polysemy creates unexpected routing; ineffable experiences have no stable address | Visible disambiguation prompts for polysemous terms; acknowledge limits honestly |

---

## Summary Table

| Phase | Effort | Key Milestone |
|-------|--------|---------------|
| **0** — Foundation (Days 1–3) | ~11h | Semantic matching works; safe for real users |
| **1** — Real Network (Week 1–2) | ~4d | True P2P delivery + file transfer; first user can join |
| **2** — Cold-Start Perception (Week 2–3) | ~2.5d | Network feels inhabited; chaos mode; invite links |
| **3** — Semantic Quality & Space View (Week 3–5) | ~6d | Visual metaphor realized; multilingual; relationship consent |
| **4** — Discovery UX (Week 5–7) | ~5.5d | Differentiated features; viral moments |
| **5** — Platform Expansion (Week 7–10) | ~8.5d | Mobile, extension, Docker, Electron, subscriptions |
| **6** — Privacy Hardening (Week 10–14) | ~11d | High-stakes use cases unlocked; predator routing mitigated |
| **7** — Protocol & Governance (Month 4–6) | ~3w | Protocol not just app; governance before community scale |
| **8** — Advanced (Month 6+) | open | Speculative, post-traction |
