# ISC Open Protocol Specification

> **The open specification for the Infinite Semantics Canvas — enabling third-party clients, native
> implementations, and academic research**

**Version:** 2.0  
**Protocol:** ISC v2.0  
**License:** MIT  
**Specification:** This document is authoritative. When the reference implementation and this
document diverge, this document takes precedence.

> **Quick summary for the impatient:** ISC is a P2P network where peers announce where they are in a
> shared semantic space (an "embedding"). Other peers discover those announcements and connect
> directly to chat. The "semantic space" is defined by an embedding model — everyone shares the same
> geometry. The wire protocol runs over libp2p, DHT for discovery, and WebRTC/WebTransport for
> direct messaging.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Peer Identity](#2-peer-identity)
3. [The Semantic Space](#3-the-semantic-space)
4. [Discovery Protocol](#4-discovery-protocol)
5. [Direct Messaging](#5-direct-messaging)
6. [Social Features](#6-social-features)
7. [Security Tiers](#7-security-tiers)
8. [Rate Limits](#8-rate-limits)
9. [Data Persistence](#9-data-persistence)
10. [Error Handling](#10-error-handling)
11. [Versioning and Compatibility](#11-versioning-and-compatibility)
12. [Implementor's Guide](#12-implementors-guide)

---

## 1. Overview

### 1.1 What ISC Is

ISC (Infinite Semantics Canvas) is a decentralized, serverless social platform built around the
principle of **semantic proximity** — the idea that people whose expressed thoughts are semantically
similar should be able to find and talk to each other directly, without intermediaries.

The key properties:

- **No accounts** — identity is a keypair generated in the browser
- **No servers** — all communication is peer-to-peer via WebRTC/WebTransport
- **No algorithms** — the "feed" is the semantic map itself
- **Ephemeral by default** — no persistence unless you explicitly preserve a connection
- **Offline-capable** — IndexedDB caches your state; network syncs on reconnect

### 1.2 How a Session Works

```
1. You open isc.network
2. Your browser generates an Ed25519 keypair (peer ID)
3. You type a channel description: "AI ethics and political philosophy"
4. Your device runs the text through an embedding model → a 384-dimensional vector
5. The vector is hashed via LSH → ~32 bucket keys
6. Your announcement is published to the DHT at /isc/announce/<modelHash>/<bucketKey>
7. Other peers query those same bucket keys
8. Your vectors are compared (cosine similarity)
9. If similarity > 0.55, the peer appears as a match
10. You click to connect → direct WebRTC/WebTransport stream opens → chat
```

### 1.3 Architecture Layers

```
┌─────────────────────────────────────────┐
│  User Interface (browser / TUI / native) │
├─────────────────────────────────────────┤
│  Service Layer (channelService,          │
│    networkService, chatService, etc.)    │
├─────────────────────────────────────────┤
│  Protocol Handlers (/isc/chat, /isc/announce, etc.) │
├─────────────────────────────────────────┤
│  libp2p (DHT, WebRTC, WebTransport)     │
├─────────────────────────────────────────┤
│  Transport (QUIC, UDP, WebSocket)        │
└─────────────────────────────────────────┘
```

---

## 2. Peer Identity

### 2.1 Keypairs

Every peer generates an **Ed25519 keypair** on first use. The public key is the peer's identity;
there is no PKI, no certificate authority, and no username.

```
Key generation: Web Crypto API (SubtleCrypto)
Algorithm: Ed25519 ( Edwards-curve digital signature)
Derivation: BIP-39 seed phrase → Ed25519 keypair
Storage: IndexedDB (default) or in-memory (ephemeral mode)
```

### 2.2 Peer ID Format

libp2p peer IDs are multihash base58btc-encoded. Example:
`12D3KooWKimXnYQKWPaHKAeGdQPLsKnDsgJJDzVYYqBFCxdpMXKm`

The ISC peer ID IS the libp2p peer ID. All protocol negotiation uses this ID.

### 2.3 Invite Links

You can share your location in semantic space via an invite link:

```
https://isc.network/?peer=<peerID>&relay=<relayURL>
```

Opening this link from any ISC client dials the peer directly. If direct connection fails, it falls
back to the specified relay.

---

## 3. The Semantic Space

### 3.1 Embedding Models

ISC uses transformer-based sentence embedding models to convert channel descriptions into vectors.
The **canonical model** for the public (Tier 2) network is:

| Model              | Dimensions | Size  | Notes                           |
| ------------------ | ---------- | ----- | ------------------------------- |
| `all-MiniLM-L6-v2` | 384        | 22 MB | Canonical; good general English |

The model registry at DHT key `/isc/model_registry` lists all approved models. Only peers using
registry-listed models can participate in Tier 2. Tier 0 and 1 networks can use any model.

**Canonical model selection is governed by the [GOVERNANCE.md](GOVERNANCE.md) process.** Model
changes require a 2-week RFC period and maintainer multisig approval.

### 3.2 Vector Representation

The embedding output is a normalized 384-dimensional float32 vector. Representation varies by device
tier:

| Device Tier | Quantization | Accuracy Loss |
| ----------- | ------------ | ------------- |
| High        | float32      | 0%            |
| Mid         | int8 scalar  | <1%           |
| Low         | int8 + PCA   | <2%           |
| Minimal     | int4         | <5%           |

### 3.3 LSH (Locality-Sensitive Hashing)

ISC uses **seeded random-projection LSH** to map vectors into bucket keys for DHT routing. The RNG
seed is the SHA-256 hash of the model output on a fixed test corpus — all peers using the same model
produce identical bucket assignments.

```
numHashes: 32 (High), 24 (Mid), 16 (Low), 8 (Minimal)
bucketBits: 32
LSH function: random projection → sign(dot product)
bucketKey: 32-character binary string
```

This means all peers using the same model publish to and query from the same DHT key space,
regardless of where they are in the world.

### 3.4 Semantic Distance

Similarity between peers is measured by **cosine similarity**:

```
similarity(a, b) = dot(a, b) / (|a| × |b|)
```

Cosine similarity of 1.0 = identical vectors; 0.0 = orthogonal; -1.0 = opposite.

---

## 4. Discovery Protocol

### 4.1 Announcements

A peer announces their channel to the DHT by publishing to each of their LSH bucket keys:

```
DHT key:   /isc/announce/<modelHash>/<bucketKey>
TTL:       300 seconds (5 minutes)
Format:    CBOR-encoded SignedAnnouncement (see §4.3)
```

The announcement is refreshed every 150 seconds (half the TTL).

### 4.2 DHT Key Schema

The complete key schema for the ISC network:

| Data             | Key Pattern                                | TTL       |
| ---------------- | ------------------------------------------ | --------- |
| Channel announce | `/isc/announce/<modelHash>/<lshBucketKey>` | 300s      |
| Delegation       | `/isc/delegate/<peerID>`                   | 300s      |
| Mute             | `/isc/mute/<peerID>`                       | no expiry |
| Blocklist (T1/2) | `/isc/blocklist/<peerID>`                  | no expiry |
| Model registry   | `/isc/model_registry`                      | 14 days   |
| Posts            | `/isc/post/<modelHash>/<lshBucketKey>`     | 86400s    |
| Profile          | `/isc/profile/channels/<peerID>`           | 30 days   |
| Follows          | `/isc/follow/<peerID>`                     | no expiry |

### 4.3 Announcement Payload

```typescript
interface SignedAnnouncement {
  v: 2; // protocol version
  tier: 0 | 1 | 2; // security tier
  peerID: string; // libp2p peer ID
  channelID: string; // local channel identifier
  model: string; // "modelName@sha256:hash"
  vec: number[]; // embedding vector
  lshKeys: string[]; // LSH bucket keys
  ttl: number; // seconds (default 300)
  ts: number; // Unix ms timestamp
  signature?: Uint8Array; // ed25519; T1/2 only
  rlnProof?: string; // hex; Tier 2 only
}
```

### 4.4 Query Protocol

To find nearby peers, query each LSH bucket key:

```
GET /isc/announce/<modelHash>/<bucketKey>
  → returns: SignedAnnouncement[]
  → filter: same model, same tier, not self
  → filter: T1/2 signature valid
  → rank by: cosine similarity to your vector
  → return top N candidates
```

### 4.5 Match Thresholds

| Cosine Similarity | Label      | Behavior             |
| ----------------- | ---------- | -------------------- |
| 0.85+             | Very Close | Auto-dial enabled    |
| 0.70–0.85         | Nearby     | Standard candidate   |
| 0.55–0.70         | Orbiting   | Manual dial required |
| <0.55             | Distant    | Filtered out         |

### 4.6 Hot-Cluster Routing

When an LSH bucket contains more than 8 peers, it becomes a **hot cluster**. Peers in hot clusters
switch from DHT to Gossipsub pubsub for that bucket:

```
Gossipsub topic: /isc/gossip/1.0/<lshBucketKey>
TTL in Gossipsub: 60 seconds
Threshold to switch: > 8 peers
Threshold to revert: < 4 peers
```

This reduces DHT write amplification in dense semantic regions (e.g., "AI", "politics", "music").

### 4.7 Bootstrap

New peers find the network via:

1. **Hardcoded bootstrap peers** (default ISC relays)
2. **DNS TXT record** `_isc._tcp.bootstrap.isc.network` (if available)
3. **Invite link** or manual peer ID entry

---

## 5. Direct Messaging

### 5.1 Connection Establishment

After a DHT match, the initiating peer dials the target directly:

```
1. Initiate libp2p stream: /isc/chat/1.0
2. Send greeting message (JSON/CBOR)
3. Stream: raw encrypted payload (WebRTC DTLS or WebTransport QUIC)
4. Heartbeat: every 30 seconds
5. Close: graceful FIN, or TCP timeout after 90s silence
```

### 5.2 Chat Message Format

```typescript
interface ChatMessage {
  v: 2; // protocol version
  tier: 0 | 1 | 2;
  peerID: string;
  ts: number; // Unix ms
  sig?: Uint8Array;
  channelID: string;
  msg: string; // user text
}
```

All messages carry the common header. The `msg` field is the user-visible text.

### 5.3 Encryption

- **Transport layer**: WebRTC uses DTLS 1.2; WebTransport uses QUIC (inherently encrypted)
- **Application layer**: All Tier 1/2 messages are signed with ed25519; Tier 0 messages have no
  application-layer signature
- **Forward secrecy**: not yet implemented (Phase E work)

### 5.4 Group Chats

Group chats form automatically when 3+ peers are all pairwise similar > 0.85:

```
Formation: highest lexicographic peerID initiates
Room ID: uuid_v4, published to /isc/group/<roomID>
Topology: full mesh (WebRTC/WebTransport)
Max size: 8 peers
Exit: graceful prompt when similarity drops below 0.55
```

---

## 6. Social Features

### 6.1 Posts

Posts are content published to the DHT. They follow the same LSH bucket routing as channel
announcements, so posts in the same semantic neighborhood are discoverable.

```
DHT key: /isc/post/<modelHash>/<lshBucketKey>
TTL: 86400 seconds (1 day)
Format: CBOR-encoded Post
```

Posts support replies, likes, and reposts — all stored at DHT keys derived from the post ID.

### 6.2 Follows

Follow relationships are stored at `/isc/follow/<peerID>`. Following someone does not affect
semantic matching — it is purely a social signal. Follows do not expire (manual unfollow required).

### 6.3 Mutes

Mute events are personal — stored locally and optionally published to the DHT. Muted peers never
appear in your match results, but the muted peer does not know they are muted.

### 6.4 Relationship Persistence

When two peers have a meaningful conversation, either can propose to preserve the relationship:

- Sends signed `contact_preserved` event
- Other peer must accept
- Bilateral consent required for the relationship to be stored
- Preserved relationships survive ephemeral sessions and are stored in IndexedDB

---

## 7. Security Tiers

The ISC protocol has three security tiers. Every network is configured with one tier. Peers with
mismatched tiers reject each other before any protocol negotiation begins.

### 7.1 Tier 0 — Trusted (LAN / Private)

- **Use case**: Intranets, private groups, corporate deployments
- **Crypto**: None (no signatures, no RLN)
- **Trust model**: All peers are pre-trusted (physical or social trust)
- **Rate limits**: None
- **DHT**: Flat Kademlia (no supernode hierarchy)
- **Protocol identifier**: `/isc/tier/1.0` → `{ tier: 0, networkID: "..." }`

### 7.2 Tier 1 — Federated

- **Use case**: Inter-community bridges, universities, open-source collectives
- **Crypto**: ed25519 signing only
- **Trust model**: Reputation + vouch chains
- **Rate limits**: Moderate
- **Features**: Peer scoring, vouch protocol, Gossipsub hot-cluster routing
- **Protocol identifier**: `/isc/tier/1.0` → `{ tier: 1, networkID: "..." }`

### 7.3 Tier 2 — Public

- **Use case**: Open global Internet
- **Crypto**: ed25519 signing + RLN zero-knowledge proofs
- **Trust model**: Adversarial (Sybil/spam possible; mitigated by RLN)
- **Rate limits**: Strict (RLN-enforced)
- **Features**: Merkle model registry, signed blocklists, RLN anti-Sybil
- **Protocol identifier**: `/isc/tier/1.0` → `{ tier: 2, networkID: "..." }`

### 7.4 Tier Negotiation

On every new connection, the `/isc/tier/1.0` identify extension is exchanged. If tiers don't match,
the connection is closed with error `tier-mismatch`. There is no downgrade path — tier mismatch is a
hard rejection.

---

## 8. Rate Limits

Rate limits prevent spam and Sybil attacks. Tier 0 has no limits.

| Operation          | Tier 1 | Tier 2           |
| ------------------ | ------ | ---------------- |
| DHT Announce       | 20/min | 5/min (RLN slot) |
| DHT Query          | 60/min | 30/min           |
| Chat Dial          | 50/hr  | 20/hr            |
| Delegation Request | 30/min | 10/min           |
| Vouch Request      | 5/hr   | 2/hr             |

**Tier 2 RLN**: Rate Limiting Nullifiers use halo2/SNARK WASM proofs (~150ms on mid-tier hardware).
Peers generate a proof that "I have not exceeded my epoch quota" without revealing identity.
Exceeding the quota means no new announcements until the next epoch.

**Reputation multiplier**: Tier 2 peers above 100 reputation receive up to 2× base limits. Peers
below 50 reputation are restricted to 0.5×.

---

## 9. Data Persistence

### 9.1 Local Storage (IndexedDB)

The browser client stores:

| Data                   | Retention                               |
| ---------------------- | --------------------------------------- |
| Keypair                | Permanent (until explicitly deleted)    |
| Channels               | Until deleted by user                   |
| Message history        | Until deleted by user (ephemeral: none) |
| Match history          | 90 days                                 |
| Peer proximity history | Permanent                               |
| Cached DHT entries     | TTL-based                               |

### 9.2 Ephemeral Mode

Opening the app in ephemeral mode generates a keypair stored **only in memory** (no IndexedDB).
Closing the tab permanently deletes the keypair and all messages. No trace remains.

### 9.3 CRDT Merge Strategy

When multiple peers update the same channel simultaneously (e.g., both editing the description):

- **Strategy**: Last-Write-Wins with `(timestamp, peerID)` tiebreaker
- **Vector clocks**: each peer maintains `{peerID: sequenceNumber}` for conflict detection
- **Follow relationships**: OR-Set semantics — add and remove operations coexist; existence = add
  without matching remove

---

## 10. Error Handling

### 10.1 Connection Errors

| Error                   | Recovery                                    |
| ----------------------- | ------------------------------------------- |
| Direct dial fails       | Try circuit relay #1, #2, #3                |
| All relays fail         | Show: "Cannot connect — check your network" |
| Stream timeout          | Retry once after 5s                         |
| Heartbeat timeout (90s) | Close stream, show: "Connection lost"       |

### 10.2 DHT Errors

| Error             | Recovery                         |
| ----------------- | -------------------------------- |
| Key not found     | Normal — no peers in that bucket |
| Quota exceeded    | Back off 60s, retry              |
| Invalid signature | Drop, block peer                 |
| Model mismatch    | Drop, block peer                 |
| Tier mismatch     | Reject immediately, no retry     |

### 10.3 Protocol Errors

| Code                 | Meaning                       | Action                    |
| -------------------- | ----------------------------- | ------------------------- |
| `TIMEOUT`            | Stream unresponsive           | Retry once                |
| `INVALID_SIGNATURE`  | Message tampered              | Block peer                |
| `MODEL_MISMATCH`     | Different embedding model     | Block peer                |
| `RATE_LIMITED`       | Exceeded quota                | Back off                  |
| `RLN_QUOTA_EXCEEDED` | Tier 2 RLN violated           | Back off until next epoch |
| `NAT_UNREACHABLE`    | Direct NAT traversal failed   | Try circuit relay         |
| `TIER_MISMATCH`      | Security tier incompatibility | Reject, no retry          |
| `REPUTATION_TOO_LOW` | Below threshold               | Deprioritize in results   |

---

## 11. Versioning and Compatibility

### 11.1 Wire Protocol Versioning

The ISC wire protocol uses **semver** via libp2p protocol strings:

```
/isc/chat/1.0
/isc/announce/1.0
/isc/delegate/1.0
/isc/post/1.0
/isc/follow/1.0
/isc/dm/1.0
/isc/vouch/1.0       (Tier 1/2)
/isc/score/1.0       (Tier 1/2)
/isc/gossip/1.0     (Tier 1/2, hot clusters)
/isc/tier/1.0       (identify extension, all tiers)
```

### 11.2 Version Negotiation

Protocol versions are negotiated via libp2p multistream-select. The tier extension is sent in
identify **before** any other protocol negotiation. This means:

- Peers know the tier mismatch before wasting time on protocol negotiation
- Within a compatible tier, peers negotiate the highest mutually supported protocol version
- A v1 client connecting to a v2 peer negotiates down to the v1 protocol subset

### 11.3 Upgrade Path

Protocol upgrades follow a **grace period** model:

1. New version is published
2. Old clients continue to work (backward compatibility)
3. After `gracePeriodDays`, old clients are gently nudged to upgrade
4. Old version is deprecated after `deprecationPeriodDays`

### 11.4 Model Versioning

Embedding model changes use a separate governance process ([GOVERNANCE.md](GOVERNANCE.md)) with a
longer timeline (minimum 30 days from proposal to deployment). During the migration window, both old
and new model shards coexist in the DHT.

---

## 12. Implementor's Guide

### 12.1 Minimum Viable Client

A minimal ISC client needs:

1. **Identity**: Generate an Ed25519 keypair (Web Crypto API or libsodium)
2. **Embedding**: Load the embedding model (22 MB, cached in IndexedDB after first run)
3. **DHT**: Use libp2p with kad-dht service
4. **Announce**: Compute LSH hash of your channel's embedding; publish to DHT
5. **Query**: Query your LSH bucket keys; compute cosine similarity; rank results
6. **Chat**: Dial matched peers via `/isc/chat/1.0`; display messages

### 12.2 Libraries

| Layer         | Recommended Library                                               |
| ------------- | ----------------------------------------------------------------- |
| Keypair       | Web Crypto API (built-in)                                         |
| Embeddings    | `@xenova/transformers` (WASM, browser-native)                     |
| P2P           | `libp2p` (JavaScript, browser-compatible via WebRTC/WebTransport) |
| Serialization | `CBOR` (preferred), JSON (fallback)                               |
| DHT           | `@libp2p/kad-dht` (bundled with libp2p)                           |

### 12.3 Test Vectors

Reference cosine similarity scores for validation:

```
cosine("AI ethics", "machine learning morality") > 0.70
cosine("cats", "quantum physics") < 0.20
cosine("jazz music", "classical music") > 0.60
cosine("I love jazz", "jazz music") > 0.75
```

### 12.4 Reference Implementation

The canonical reference implementation is the ISC browser app at `apps/browser/`. The service layer
(`apps/browser/src/services/`) is framework-agnostic TypeScript and can be reused for native
clients.

### 12.5 Network Constants

```typescript
const DEFAULT_TTL = 300; // seconds
const HOT_CLUSTER_TTL = 60; // seconds
const HOT_CLUSTER_THRESHOLD = 8; // peers per LSH bucket
const MIN_SIMILARITY = 0.55; // minimum for match
const MAX_GROUP_SIZE = 8; // peers per group chat
const HEARTBEAT_INTERVAL = 30000; // ms
const STREAM_TIMEOUT = 90000; // ms
const CACHE_WARM_ONLINE = 5; // minutes offline before cache refresh
```

### 12.6 Interoperability Requirements

For a client to interoperate with the ISC public network (Tier 2):

- Must use a model from the approved registry at `/isc/model_registry`
- Must implement RLN proof generation (Tier 2)
- Must verify signatures on incoming Tier 1/2 messages
- Must respect rate limits
- Must implement circuit relay fallback for NAT traversal

### 12.7 Related Specifications

- [PROTOCOL.md](PROTOCOL.md) — detailed technical implementation guide
- [SECURITY.md](SECURITY.md) — cryptographic threat model and privacy guarantees
- [GOVERNANCE.md](GOVERNANCE.md) — model selection and registry governance
- [SOCIAL.md](SOCIAL.md) — complete social layer specification
- [DELEGATION.md](DELEGATION.md) — delegation protocol for low-capability devices
