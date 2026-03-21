# ISC Protocol Specification

**Version:** 2.0 (March 2026) **Status:** Complete **Backward-compatible:** Tier 0–2 negotiation; v1
clients fall back gracefully via multistream. **License:** MIT (part of autonull/isc)

> **Purpose**: Detailed P2P networking, DHT, and communication protocol specifications. For threat
> model, privacy guarantees, and cryptographic details see [SECURITY.md](SECURITY.md). For relation
> ontology see [SEMANTIC.md](SEMANTIC.md). For delegation see [DELEGATION.md](DELEGATION.md). For
> social layer see [SOCIAL.md](SOCIAL.md).

---

## 1. Security Tiers

Every ISC network declares a **security tier** during the libp2p `identify` handshake via extension
`/isc/tier/1.0`. The tier is immutable per network ID (derived from the bootstrap peer list +
genesis hash). Peers reject connections to mismatched tiers.

| Tier  | Name      | Use Case                                                       | Crypto Overhead                   | Trust Model                                | Mandatory Features                                                 |
| ----- | --------- | -------------------------------------------------------------- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| **0** | Trusted   | Intranets, private LANs, corporate / invite-only groups        | None (all disabled)               | All peers pre-trusted (physical or social) | No signatures, no RLN, no scoring                                  |
| **1** | Federated | Inter-community bridges, universities, open-source collectives | ed25519 signing only              | Reputation + vouch chains                  | Signed announces, peer scoring, gossipsub                          |
| **2** | Public    | Open global Internet                                           | Full (ed25519 + RLN zk + scoring) | Adversarial (Sybil/spam possible)          | RLN quotas, vouch chains, signed blocklists, Merkle model registry |

### Negotiation Flow

On every new connection:

1. Peer sends `tier` in the identify extension `/isc/tier/1.0`.
2. If tiers do not match → reject with error code `tier-mismatch`.
3. **Tier 0 networks never accept Tier 1/2 peers, and vice-versa.** There is no downgrade or
   bridging path — isolation is the security guarantee.

In Tier 0 all `signature`, `rlnProof`, and reputation fields are **omitted** from every message.
Rate limits are removed. The entire crypto stack is bypassed (no Web Crypto API calls on the hot
path).

---

## 2. Protocol Constants

```typescript
// Core protocols (all tiers)
const PROTOCOL_ANNOUNCE = '/isc/announce/1.0';
const PROTOCOL_CHAT = '/isc/chat/1.0';
const PROTOCOL_DELEGATE = '/isc/delegate/1.0';
const PROTOCOL_POST = '/isc/post/1.0';
const PROTOCOL_FOLLOW = '/isc/follow/1.0';
const PROTOCOL_DM = '/isc/dm/1.0';

// Tier negotiation (all tiers, sent in identify)
const PROTOCOL_TIER = '/isc/tier/1.0';

// Tier 1/2 only
const PROTOCOL_VOUCH = '/isc/vouch/1.0';
const PROTOCOL_SCORE = '/isc/score/1.0';

// Hot-cluster mesh (Tier 1/2, activated when LSH bucket density > threshold)
const PROTOCOL_GOSSIP = '/isc/gossip/1.0';
```

---

## 3. Device Tiers

Device tiers are **orthogonal to security tiers** — they describe hardware capability, not trust
level. They govern LSH precision, vector quantization, connection limits, and delegation behavior.

| Device Tier | Target         | Model                            | Vec Quantization | ANN Index        | Max Connections | numHashes | Relations   | Delegation    |
| ----------- | -------------- | -------------------------------- | ---------------- | ---------------- | --------------- | --------- | ----------- | ------------- |
| **High**    | Desktop/laptop | `all-MiniLM-L6-v2` (22 MB)       | None (float32)   | HNSW (10k)       | 100             | 32        | All (max 5) | Can serve     |
| **Mid**     | Modern phone   | `paraphrase-MiniLM-L3-v3` (8 MB) | int8 (scalar)    | HNSW lite (5k)   | 50              | 24        | Root + 2    | Limited serve |
| **Low**     | Budget phone   | `gte-tiny` (4 MB)                | int8 + PCA       | Linear scan (2k) | 20              | 16        | Root only   | Can request   |
| **Minimal** | Constrained    | Word-hash fallback               | int4             | Hamming (500)    | 10              | 8         | Root only   | Can request   |

Cosine accuracy loss from int8 quantization is <2% (pre-tested on all-MiniLM-L6-v2 at 384 dims).

### Tier Detection

```javascript
async function detectDeviceTier() {
  const cores = navigator.hardwareConcurrency ?? 2;
  const mem = navigator.deviceMemory ?? 1;
  const conn = navigator.connection?.effectiveType ?? '4g';

  if (cores >= 4 && mem >= 4 && conn !== '2g') return 'High';
  if (cores >= 2 && mem >= 2) return 'Mid';
  if (conn === '2g' || mem < 1) return 'Minimal';
  return 'Low';
}
```

### Device Tier Protocol Parameters

| Device Tier | numHashes | candidateCap | refreshInterval |
| ----------- | --------- | ------------ | --------------- |
| High        | 32        | 100          | 5 min           |
| Mid         | 24        | 50           | 8 min           |
| Low         | 16        | 20           | 15 min          |
| Minimal     | 8         | 10           | 20 min          |

---

## 4. Transport & Connectivity

### Primary & Fallback Transports

- **Primary (2026+)**: WebTransport (QUIC) via `/isc/transport/webtransport/1.0` when supported
  (Chrome/Edge/Firefox). Provides 50–70% lower latency and lower battery usage than WebRTC.
- **Fallback**: WebRTC DataChannel (Noise + Yamux) + libp2p **Circuit Relay V2** (aggressive mode) +
  AutoNAT + DCUtR hole-punching.
- **Tier 0 note**: Tier 0 networks may disable WebTransport fallback checks for pure LAN throughput
  — direct TCP/UDP is sufficient when all peers are pre-trusted and local.

**NAT success target**: ≥95% via Circuit Relay V2 + DCUtR.

### Libp2p Configuration

```javascript
import { webTransport } from '@libp2p/webtransport';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { kadDHT } from '@libp2p/kad-dht';
import { bootstrap } from '@libp2p/bootstrap';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';

const node = await createLibp2p({
  transports: [
    webTransport(), // primary
    webRTC(), // fallback
    webSockets(), // fallback
    circuitRelayTransport(), // relay fallback (V2)
  ],
  connectionEncryption: [noise()], // omit in Tier 0
  streamMuxers: [yamux()],
  peerDiscovery: [
    bootstrap({
      list: [
        '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SznbYGzPwpkqDrqEf',
        '/ip4/104.131.131.82/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT5887gRqQofnZ6Gqiq5KhCvv6ip',
      ],
    }),
  ],
  services: { dht: kadDHT({ kBucketSize: 20 }) },
});
await node.start();
```

### Connection Handling

- **Inbound**: Accepted from any tier-matching peer; capped at `MAX_CONNECTIONS[deviceTier]`.
- **Outbound**: Dialed on match; max 50 concurrent dials.
- **Keepalive**: Heartbeat ping every 30s; drop after 90s silence.
- **Reconnect**: On stream drop, wait 5s then attempt one reconnect dial.

---

## 5. DHT Protocol

### Channel Schema

```typescript
interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number; // 0.0–1.0, distribution fuzziness
  relations: Relation[]; // max 5
  createdAt: number;
  updatedAt: number;
}

interface Relation {
  tag: string; // From ontology in SEMANTIC.md
  object: string; // Free-form or structured
  weight?: number; // Default 1.0
}
```

### Relation Ontology

See [SEMANTIC.md](SEMANTIC.md#relation-ontology) for the complete relation ontology with examples
and rules.

**Tags:** `in_location`, `during_time`, `with_mood`, `under_domain`, `causes_effect`, `part_of`,
`similar_to`, `opposed_to`, `requires`, `boosted_by`

### DHT Key Schema

All DHT keys use slash-separated paths for namespace isolation. This is the single source of truth
for network data structures and their lifespans.

| Data Type          | DHT Key Pattern                        | TTL                         | Tier     |
| ------------------ | -------------------------------------- | --------------------------- | -------- |
| **Announcements**  | `/isc/announce/<modelHash>/<lsh_hash>` | Tier-dependent (5–20 min)   | All      |
| **Delegation**     | `/isc/delegate/<peerID>`               | 5 min                       | All      |
| **Mutes**          | `/isc/mute/<peerID>`                   | No expiry (manual unmute)   | All      |
| **Blocklist**      | `/isc/blocklist/<peerID>`              | No expiry (manual unblock)  | Tier 1/2 |
| **Model Registry** | `/isc/model_registry`                  | 14 days (signed manifest)   | All      |
| **Posts**          | `/isc/post/<modelHash>/<lsh_hash>`     | 86400 (1 day)               | All      |
| **Likes**          | `/isc/likes/<postID>`                  | 604800 (7 days)             | All      |
| **Reposts**        | `/isc/reposts/<postID>`                | 604800 (7 days)             | All      |
| **Replies**        | `/isc/replies/<postID>`                | 604800 (7 days)             | All      |
| **Profiles**       | `/isc/profile/channels/<peerID>`       | 2592000 (30 days)           | All      |
| **Follows**        | `/isc/follow/<peerID>`                 | No expiry (manual unfollow) | All      |
| **Trending**       | `/isc/trending/<modelHash>`            | 3600 (1 hour)               | All      |
| **Group rooms**    | `/isc/group/<roomID>`                  | 86400 (1 day)               | All      |

> **Routing uses `modelHash`** (e.g., `abc123def456` for `all-MiniLM-L6-v2`) rather than `channelID`
> so that identical thoughts across different channels naturally map to the same DHT neighborhood,
> enabling cross-topic serendipity.

### LSH (Locality-Sensitive Hashing)

Vectors are mapped to DHT keys via seeded random-projection LSH. The RNG is seeded by the model's
SHA256 hash, ensuring all peers using the same model produce identical bucket assignments.

```javascript
function seededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let state = Math.abs(hash);
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function lshHash(
  vec: number[],
  seed: string,
  numHashes: number = 32,
  hashLen: number = 32,   // LSH_BUCKET_BITS
): string[] {
  const rng = seededRng(seed);
  const hashes: string[] = [];

  for (let i = 0; i < numHashes; i++) {
    let hashBits = '';
    for (let h = 0; h < hashLen; h++) {
      const proj = Array.from({ length: vec.length }, () => rng() * 2 - 1);
      let dot = 0;
      for (let j = 0; j < vec.length; j++) dot += vec[j] * proj[j];
      hashBits += dot > 0 ? '1' : '0';
    }
    hashes.push(hashBits);
  }
  return hashes;
}
```

The `numHashes` value is taken from the device tier table (High=32, Mid=24, Low=16, Minimal=8).
`hashLen` is always 32 bits (`LSH_BUCKET_BITS`).

### Hierarchical Sub-DHTs (Tier 1/2)

High-tier supernodes own ranges of the LSH space or semantic centroids. Regular peers announce to
their nearest supernode first; the supernode propagates to the global DHT. This reduces global DHT
fan-out by approximately 80% in dense networks.

- Peers discover their supernode by querying `/isc/delegate/<peerID>` for nearby High-tier peers.
- Supernodes self-identify by advertising `/isc/delegate/1.0` in their identify protocols list.
- Tier 0 networks use a flat DHT with no supernode hierarchy.

### Hot-Cluster Gossipsub Routing (Tier 1/2)

When a DHT query for a given LSH bucket returns more than `HOT_CLUSTER_THRESHOLD` (8) distinct peer
IDs, that bucket is considered a **hot cluster**. Peers in a hot cluster switch from DHT put/get to
Gossipsub pubsub on the topic `/isc/gossip/1.0` using the LSH bucket key as the topic string. This
dramatically reduces DHT write amplification in dense semantic regions.

- Each peer subscribes to the Gossipsub topic for any LSH bucket it occupies.
- Hot-cluster announcements use a shorter TTL (`HOT_CLUSTER_TTL = 60s`) since Gossipsub delivers
  them immediately.
- Peers revert to DHT if their local peer count for the bucket drops below 4.

### Announcement Payload

```typescript
interface SignedAnnouncement {
  v: 2; // protocol version
  tier: 0 | 1 | 2; // security tier
  peerID: string; // libp2p peer ID (base58btc)
  channelID: string; // channel identifier
  model: string; // "Xenova/all-MiniLM-L6-v2@sha256:abc123..."
  vec: number[]; // 384-dim embedding (quantized per device tier)
  lshKeys: string[]; // LSH bucket keys used for DHT routing
  relTag?: string; // optional relation tag for fused distributions
  ttl: number; // seconds until expiry (default 300)
  ts: number; // Unix timestamp ms (replaces updatedAt)
  signature?: Uint8Array; // ed25519; omitted in Tier 0
  rlnProof?: string; // zk proof hex; Tier 2 only
}
```

### Announcement Loop

```javascript
async function announceChannel(channel: Channel, dists: Distribution[], modelHash: string) {
  const hashes = lshHash(dists[0].mu, modelHash, DEVICE_TIER.numHashes);

  for (let i = 0; i < Math.min(hashes.length, dists.length); i++) {
    const payload: SignedAnnouncement = {
      v: 2,
      tier: SECURITY_TIER,
      peerID: node.peerId.toString(),
      channelID: channel.id,
      model: LOCAL_MODEL,
      vec: dists[i].mu,
      lshKeys: hashes,
      relTag: dists[i].tag,
      ttl: DEVICE_TIER.refreshInterval * 2,
      ts: Date.now(),
    };

    // Tier 1/2: sign the payload
    if (SECURITY_TIER >= 1) {
      payload.signature = await sign(encode(payload), keypair.privateKey);
    }
    // Tier 2: attach RLN proof
    if (SECURITY_TIER === 2) {
      payload.rlnProof = await generateRLNProof(epoch, rateLimit);
    }

    const key = `/isc/announce/${modelHash}/${hashes[i]}`;
    await node.contentRouting.put(key, encode(payload), { ttl: payload.ttl });
  }
}
```

### Query Protocol

```javascript
async function queryProximals(sample: number[], modelHash: string): Promise<PeerInfo[]> {
  const seen = new Set<string>();
  const candidates: PeerInfo[] = [];
  const hashes = lshHash(sample, modelHash, DEVICE_TIER.numHashes);

  for (const key of hashes) {
    const values = await node.contentRouting.getMany(
      `/isc/announce/${modelHash}/${key}`,
      { count: DEVICE_TIER.candidateCap },
    );

    for (const v of values) {
      const peer: SignedAnnouncement = decode(v);
      if (peer.peerID === node.peerId.toString()) continue;
      if (peer.model !== LOCAL_MODEL) continue;
      if (peer.tier !== SECURITY_TIER) continue;
      // Tier 1/2: verify signature
      if (SECURITY_TIER >= 1 && !await verify(peer)) continue;
      if (seen.has(peer.peerID)) continue;

      seen.add(peer.peerID);
      candidates.push(peer);
    }
  }
  return candidates;
}
```

### TTL & Expiry

- **Default TTL**: 300 seconds (5 minutes).
- **Hot-cluster TTL**: 60 seconds (Gossipsub delivers immediately; short TTL keeps DHT clean).
- **Refresh interval**: Device-tier-dependent (High: 5 min, Mid: 8 min, Low: 15 min, Minimal: 20
  min).
- **Expiry handling**: Clients discard entries where `ts + ttl*1000 < Date.now()`.
- **Grace period**: Entries within 60s of expiry are returned but marked stale.

---

## 6. Common Message Header

All protocol messages use **CBOR** (preferred) with JSON fallback for debugging. Every message
carries a common header:

```cbor
{
  "v":      2,                      // protocol version (integer)
  "tier":   0 | 1 | 2,             // security tier of sending peer
  "peerID": "12D3KooW...",          // libp2p peer ID
  "ts":     1742480000000,          // Unix ms timestamp
  "sig":    <bytes>                 // ed25519 signature over all other fields; omitted in Tier 0
}
```

TypeScript representation shared across all message types:

```typescript
interface MessageHeader {
  v: 2;
  tier: 0 | 1 | 2;
  peerID: string;
  ts: number;
  sig?: Uint8Array; // omitted in Tier 0
}
```

---

## 7. Core Protocols

### 7.1 `/isc/announce/1.0` (DHT put)

See `SignedAnnouncement` interface in §5. Delivered via DHT or Gossipsub (hot clusters).

### 7.2 `/isc/chat/1.0` (WebRTC / WebTransport stream)

Direct dial after DHT match. Greeting message:

```typescript
interface ChatMessage extends MessageHeader {
  channelID: string;
  msg: string;
}
```

Subsequent messages are raw encrypted payload (WebTransport QUIC stream or WebRTC DTLS).

#### Stream Handler

```typescript
async function handleChatStream(stream: Stream) {
  for await (const chunk of stream.source) {
    const msg: ChatMessage = decode(chunk);
    if (SECURITY_TIER >= 1 && !(await verify(msg))) continue;
    displayMessage(msg);
    stream.sink(encode({ ack: msg.ts }));
  }
}
```

#### Dial Protocol

```javascript
async function initiateChat(peerID: string, channel: Channel): Promise<Stream> {
  const stream = await node.dialProtocol(peerID, PROTOCOL_CHAT);

  const greeting: ChatMessage = {
    v: 2, tier: SECURITY_TIER,
    peerID: node.peerId.toString(),
    ts: Date.now(),
    channelID: channel.id,
    msg: 'Hey, our thoughts are proximal!',
  };
  if (SECURITY_TIER >= 1) greeting.sig = await sign(encode(greeting), keypair.privateKey);

  await stream.sink(encode(greeting));
  return stream;
}
```

#### Group Chat Formation

**Density threshold**: 3+ peers all pairwise similarity > 0.85. **Max group size**: 8 peers.

**Protocol**:

1. Only the peer with the lexicographically **highest** `peerID` in the cluster initiates (prevents
   race conditions).
2. Initiator generates `roomID` (`uuid_v4()`), dials all members via `/isc/chat/1.0` with a
   `GroupInvite`.
3. Members announce membership at `/isc/group/<roomID>` and dial each other to form a full mesh.
4. Heartbeat every 30s. Members below 0.55 pairwise similarity receive a graceful exit prompt.
5. On initiator departure, next highest `peerID` becomes state coordinator.

```typescript
interface GroupInvite extends MessageHeader {
  type: 'group_invite';
  roomID: string;
  members: string[]; // peerIDs of all invited participants
}

interface GroupRoom {
  roomID: string;
  members: string[];
  createdAt: number;
}
```

### 7.3 `/isc/delegate/1.0` (Supernode delegation)

Low-device-tier peers offload embedding and matching computation to High-tier supernodes. Request
payload includes the channel description; response is a signed vector. Tier 0 supernodes skip
signing. See [DELEGATION.md](DELEGATION.md) for the complete specification including request
encryption, verification, and trust mechanisms.

### 7.4 `/isc/vouch/1.0` (Tier 1/2 cold-start)

New peers in Tier 1/2 networks have no reputation and cannot meaningfully participate until vouched.
A new peer requests 2–3 signed vouches from high-reputation peers to bootstrap.

```typescript
interface VouchRequest extends MessageHeader {
  type: 'vouch_request';
  requesterID: string;
  requesterPublicKey: Uint8Array;
}

interface VouchResponse extends MessageHeader {
  type: 'vouch_response';
  voucherID: string;
  voucheeID: string;
  granted: boolean;
  voucherSig: Uint8Array; // signed by voucher's private key
}
```

Peers accumulate vouches in their local reputation record. Vouch chains are published to the DHT at
`/isc/profile/channels/<peerID>`. Rate limits apply (see §10).

### 7.5 `/isc/score/1.0` (Tier 1/2 reputation broadcast)

Lightweight signed reputation deltas broadcast over Gossipsub. Local reputation score formula:
`uptime + mutual_overlaps - abuse_reports`. See
[SECURITY.md](SECURITY.md#reputation-score-calculation) for the full decay formula.

```typescript
interface ScoreDelta extends MessageHeader {
  type: 'score_delta';
  subjectID: string; // peer being scored
  delta: number; // positive or negative
  reason: 'interaction' | 'mute' | 'report' | 'vouch';
}
```

Minimum reputation for full quota access: `MIN_REP_FOR_FULL_QUOTA = 100` (see §12 rate limits).

### 7.6 `/isc/post/1.0` (Social layer)

Same structure as announce but with higher TTL and optional media hash for persistent social
content. See [SOCIAL.md](SOCIAL.md) for the complete social layer protocol.

---

## 8. Chat Protocol — Matching & Group Details

### Matching Thresholds

| Range     | Label      | Protocol Behavior    |
| --------- | ---------- | -------------------- |
| 0.85+     | Very Close | Auto-dial enabled    |
| 0.70–0.85 | Nearby     | Standard candidate   |
| 0.55–0.70 | Orbiting   | Manual dial required |
| <0.55     | Distant    | Filtered out         |

---

## 9. Delegation Protocol

See [DELEGATION.md](DELEGATION.md) for the complete specification.

**Protocol**: `/isc/delegate/1.0`

---

## 10. Social Layer Protocol

See [SOCIAL.md](SOCIAL.md) for the complete social layer protocol specification.

---

## 11. Moderation Protocol

### Mute Events

```typescript
interface MuteEvent extends MessageHeader {
  type: 'mute';
  muter: string;
  muted: string;
  reason?: string;
}

// Stored at: /isc/mute/<peerID>
// Clients fetch and cache muted peers locally
```

### Blocklist (Tier 1/2)

Network-wide blocklist entries, distinct from personal mutes. Signed by at least one high-rep peer
and published at `/isc/blocklist/<peerID>`. Clients fetch and filter at query time.

### Report Events (Phase 2+)

```typescript
interface ReportEvent extends MessageHeader {
  type: 'report';
  reporter: string;
  reported: string;
  targetPostID?: string;
  reason: 'spam' | 'harassment' | 'impersonation' | 'other';
  description: string;
}
```

---

## 12. Rate Limits

Enforced locally and (for Tier 1/2) via network mechanisms. Tier 2 uses RLN (halo2/snarkjs WASM,
~150 ms proof on Mid device tier) to prove quota compliance without revealing identity.

| Operation           | Tier 0    | Tier 1 | Tier 2                |
| ------------------- | --------- | ------ | --------------------- |
| DHT Announce (put)  | Unlimited | 20/min | RLN slot (base 5/min) |
| DHT Query (getMany) | Unlimited | 60/min | 30/min                |
| Chat Dial           | Unlimited | 50/hr  | 20/hr                 |
| Delegation Request  | Unlimited | 30/min | 10/min                |
| Vouch Request       | N/A       | 5/hr   | 2/hr                  |

Tier 2 quota scales with reputation: peers above `MIN_REP_FOR_FULL_QUOTA` receive up to 2× the base
limits. Peers below 50 reputation are restricted to 0.5×.

---

## 13. Model Registry Protocol

DHT key `/isc/model_registry` holds the canonical model manifest. In Tier 1/2 this manifest is a
**Merkle root** over the set of approved model entries, signed by maintainers (multisig). Any
announce with an unknown model hash is dropped.

```typescript
interface ModelRegistry {
  type: 'model_registry';
  merkleRoot: string; // Tier 1/2: Merkle root of all approved model entries
  canonical: string; // "Xenova/all-MiniLM-L6-v2@sha256:abc123..."
  deprecated: string[];
  migrationDeadline: number; // Unix timestamp
  signature: Uint8Array; // maintainer multisig (Tier 1/2); omitted in Tier 0
}
```

### Compatibility Shards

Each model version uses a unique LSH key prefix so old and new shards coexist during migrations:

```
/isc/announce/abc123/<hash>   // Model version A shard
/isc/announce/def456/<hash>   // Model version B shard
```

Clients only query shards matching their loaded model hash.

---

## 14. Data Management & Synchronization

### Conflict-Free Replicated Data Types (CRDTs)

**Channel edits (LWW-Map):**

- Each field carries `(value, timestamp, peerID)`.
- On conflict: highest timestamp wins; `peerID` as tiebreaker.
- Merge: element-wise max of `(timestamp, peerID)`.

**Follow relationships (OR-Set):**

- Add: `{follower, followee, timestamp}`.
- Remove: `{follower, followee, timestamp, tombstone: true}`.
- Query: exists if add present without matching remove.

**Reputation scores (LWW-Register):**

- Single `(value, timestamp)` tuple. Highest timestamp wins.
- Updated only by mutual interaction confirmation.

**Conflict detection:**

- Vector clock per peer: `{peerID: sequenceNumber}`.
- Included in all announcements.
- Concurrent operations: neither clock dominates.

### Pagination Protocol

**Cursor format:**

```typescript
interface QueryCursor {
  lastKey: string;
  lastValue: string; // last value hash (for consistency)
  timestamp: number;
  signature?: Uint8Array; // signed by requesting peer; omitted in Tier 0
}
```

**Page size limits:**

| Device Tier | Max Page Size | Default |
| ----------- | ------------- | ------- |
| High        | 100           | 50      |
| Mid         | 50            | 20      |
| Low         | 20            | 10      |
| Minimal     | 10            | 5       |

**Query flow:**

1. `getMany(key, { count: pageSize })`
2. If more results available, return cursor.
3. Subsequent: `getMany(key, { count: pageSize, cursor })`
4. Cursor expires after 5 minutes.

```typescript
interface PaginatedResponse<T> {
  items: T[];
  cursor?: QueryCursor;
  hasMore: boolean;
}
```

### Caching Strategy

**Cache layers:**

1. **L1 (In-Memory)**: Hot data (active channels, recent matches).
2. **L2 (IndexedDB)**: Warm data (all channels, match history).
3. **L3 (DHT)**: Cold data (network-wide announcements).

**TTL by data type:**

| Data Type                    | L1 TTL | L2 TTL | Source of Truth |
| ---------------------------- | ------ | ------ | --------------- |
| Active channel distributions | 30s    | 5 min  | Local compute   |
| Match results                | 60s    | 10 min | DHT query       |
| Peer profiles                | 5 min  | 1 hr   | DHT query       |
| Mute / blocklists            | 1 min  | 10 min | DHT query       |
| Model registry               | 1 hr   | 24 hr  | DHT query       |

**Memory budget:**

| Device Tier | L1 Budget | L2 Budget |
| ----------- | --------- | --------- |
| High        | 500 MB    | 2 GB      |
| Mid         | 200 MB    | 1 GB      |
| Low         | 100 MB    | 500 MB    |
| Minimal     | 50 MB     | 200 MB    |

**Invalidation:** L1: time-based + LRU. L2: time-based + quota. DHT: TTL-enforced.

**Cache warming** on reconnect after >5 min offline:

1. Re-announce own channels.
2. Re-query active channel matches.
3. Refresh mute/blocklists.
4. Update model registry if >1 hr old.

---

## 15. Error Handling

### Circuit Relay V2

**Relay discovery:**

1. Query DHT for peers advertising `/isc/relay/1.0`.
2. Maintain list of 10 known relays with latency measurements.
3. Refresh every 5 minutes.

**Relay selection:** Rank by latency (60%), uptime (30%), geographic diversity (10%). Select top 3.

**Connection flow:**

```
Peer A (behind NAT)       Relay V2         Peer B (behind NAT)
      │                     │                     │
      │── Reserve Slot ────▶│                     │
      │◀─ Slot ID: abc ────│                     │
      │                     │── Reserve Slot ────▶│
      │                     │◀─ Slot ID: xyz ────│
      │── Connect abc ─────▶│                     │
      │                     │── Connect xyz ─────▶│
      │◀════════════════════│═════════════════════▶│
      │                 Direct P2P (DCUtR)          │
```

**Fallback chain:**

1. Direct WebTransport / WebRTC.
2. Circuit relay via relay #1, #2, #3.
3. Display error: "Cannot connect to peer (NAT traversal failed)."

### Stream Errors

```typescript
enum StreamError {
  TIMEOUT = 'TIMEOUT',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  MODEL_MISMATCH = 'MODEL_MISMATCH',
  RATE_LIMITED = 'RATE_LIMITED',
  RLN_QUOTA_EXCEEDED = 'RLN_QUOTA_EXCEEDED', // Tier 2
  NAT_UNREACHABLE = 'NAT_UNREACHABLE',
  TIER_MISMATCH = 'TIER_MISMATCH',
  REPUTATION_TOO_LOW = 'REPUTATION_TOO_LOW', // Tier 1/2
}

async function handleStreamError(err: StreamError, peerID: string) {
  switch (err) {
    case StreamError.INVALID_SIGNATURE:
    case StreamError.MODEL_MISMATCH:
      await blockPeer(peerID);
      break;
    case StreamError.TIER_MISMATCH:
      await blockPeer(peerID);
      log.warn(`Rejected peer ${peerID}: tier mismatch`);
      break;
    case StreamError.RATE_LIMITED:
    case StreamError.RLN_QUOTA_EXCEEDED:
      await backoff(60000);
      break;
    case StreamError.NAT_UNREACHABLE:
      await tryCircuitRelay(peerID);
      break;
    case StreamError.REPUTATION_TOO_LOW:
      log.info(`Peer ${peerID} below reputation threshold`);
      break;
  }
}
```

### DHT Errors

| Error               | Handling                                        |
| ------------------- | ----------------------------------------------- |
| `KEY_NOT_FOUND`     | Retry with exponential backoff (max 3 attempts) |
| `QUOTA_EXCEEDED`    | Reduce announcement frequency; notify user      |
| `CONNECTION_CLOSED` | Reconnect to bootstrap; resume announcements    |
| `INVALID_VALUE`     | Discard; log for analytics                      |
| `TIER_MISMATCH`     | Reject; log; do not retry                       |

---

## 16. Constants

```typescript
// LSH
const LSH_NUM_HASHES = { High: 32, Mid: 24, Low: 16, Minimal: 8 } as const;
const LSH_BUCKET_BITS = 32;

// TTL (seconds)
const DEFAULT_TTL = 300;
const HOT_CLUSTER_TTL = 60;

// Hot-cluster routing
const HOT_CLUSTER_THRESHOLD = 8; // peers in LSH bucket before switching to Gossipsub

// Connection limits
const MAX_CONNECTIONS = { High: 100, Mid: 50, Low: 20, Minimal: 10 } as const;

// Reputation
const REP_DECAY_PER_DAY = 0.1; // simplified daily decay for quota scaling
const MIN_REP_FOR_FULL_QUOTA = 100; // reputation score for 1× quota multiplier

// Protocol version
const PROTOCOL_VERSION = 2;
```

> The full reputation decay formula (exponential, 30-day half-life) is in
> [SECURITY.md](SECURITY.md#reputation-score-calculation). `REP_DECAY_PER_DAY` is a simplified
> linear approximation used only for quota multiplier calculations.

---

## 17. Threat Model

Security properties are tiered:

| Tier  | Trust Model                       | Primary Defenses                                                                        |
| ----- | --------------------------------- | --------------------------------------------------------------------------------------- |
| **0** | Physical / social pre-trust       | Network isolation; no crypto overhead                                                   |
| **1** | Reputation + vouch chains         | ed25519 signing; peer scoring; gossipsub mesh; signed announces                         |
| **2** | Adversarial (Sybil/spam possible) | RLN zk proofs; vouch chains; signed blocklists; Merkle model registry; reputation decay |

See [SECURITY.md](SECURITY.md) for the full threat model, mitigation details, privacy guarantees,
and incident response procedures.

---

## 18. Message Encoding

All messages use **CBOR** for compact binary encoding:

```javascript
import * as cbor from 'cbor-x';

function encode(obj: any): Uint8Array { return cbor.encode(obj); }
function decode(data: Uint8Array): any { return cbor.decode(data); }
```

JSON fallback for debugging only. CBOR field names are abbreviated in the wire format (e.g., `"sig"`
not `"signature"`) — TypeScript interfaces use the full names for clarity.

---

## 19. Bootstrap Peers

Default public libp2p relays:

```
/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SznbYGzPwpkqDrqEf
/ip4/104.131.131.82/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT5887gRqQofnZ6Gqiq5KhCvv6ip
```

### Selection Criteria

- Uptime: >95% over 30 days.
- Bandwidth: >100 Mbps up.
- Geographic diversity: at least 3 continents, 3 independent operators.

### Rotation

- Quarterly review. Add 1 new peer, remove lowest-performing.
- Announce changes 30 days in advance.

### Health Monitoring

- Heartbeat every 60 seconds.
- Alert threshold: >5% failure rate over 1 hour.

### Cold Start Protocol

1. If DHT query returns 0 results after 3 attempts → cold start.
2. Display: "No peers online. Waiting for connections…"
3. Continue announcing own presence every 30 seconds.

**Bootstrap discovery order:**

1. Hardcoded peers (above).
2. DNS: `_isc._tcp.bootstrap.isc.network`.
3. Community HTTPS endpoint.

**Direct connection mechanisms:**

- QR code containing peer ID + signaling URL.
- Invite link: `https://isc.network/?peer=<peerID>&relay=<relayURL>`.
- Manual peer ID entry with "Dial" button.
- Seed tab: acts as local bootstrap for other tabs via in-browser WebRTC relay.

### TURN Server Infrastructure

- Software: coturn. Ports: 3478 (STUN/TURN), 5349 (TLS), 49152–65535 (relay).
- Minimum: 3 regions (US-East, EU-West, Asia-Pacific).
- Credentials: short-term (RFC 8656), 6-hour validity, generated by any bootstrap peer.

### Community Relay Registry

The bootstrap peer list is maintained via a DHT-resident community registry, not just hardcoded
peers. This prevents single-entity control and enables permissionless relay operation.

**Registry key:** `/isc/bootstrap_registry`

**Registry entry format:**

```typescript
interface RelayRegistryEntry {
  peerID: string; // libp2p peer ID of the relay
  multiaddrs: string[]; // advertised listen addresses
  operator: string; // operator identifier (e.g., DNS name or pgp fingerprint)
  tier: 0 | 1 | 2; // security tier
  region: string; // geographic region (e.g., "us-east", "eu-west", "ap-south")
  uptime: number; // self-reported uptime percentage (30-day rolling)
  bandwidth: string; // self-reported (e.g., "1Gbps")
  announcedAt: number; // Unix ms
  sig: Uint8Array; // ed25519 signature over all fields (operator's key)
}
```

**Registry rules:**

- Entries expire after 7 days unless re-announced
- Entries with uptime < 95% over the past 30 days are filtered from discovery
- Any Tier 1/2 relay operator can submit a signed entry
- Entries are fetched and cached locally (1-hour TTL)
- Clients query the registry on startup and append results to the hardcoded bootstrap list

**Opt-in process:**

1. Operator runs a relay node (Tier 1 or 2)
2. Node signs a `RelayRegistryEntry` with the operator's ed25519 key
3. Entry is published to `/isc/bootstrap_registry/<peerID>`
4. Clients automatically discover and use the relay

**Discovery order on startup:**

1. Hardcoded bootstrap peers (default ISC relays — highest trust)
2. DNS TXT record: `_isc._tcp.bootstrap.isc.network` (if available)
3. Community relay registry (DHT query for `/isc/bootstrap_registry/*`)
4. Manual peer ID / invite link

**Governance:**

- No approval required to submit an entry (permissionless)
- Maintainer multisig can sign a revocation entry: `/isc/bootstrap_registry/revoke/<peerID>`
- Revocation supersedes any community entry; clients must honor it

---

## 20. Testing

### Local Supernode Testing

```bash
# Terminal 1: Supernode (High device tier)
npx serve . --port 8080
# Open http://localhost:8080?tier=high&supernode=true

# Terminal 2: Low-tier client
npx serve . --port 8081
# Open http://localhost:8081?tier=low&delegate=true
```

Verify in DevTools:

- Console: `peer.delegation.stats`
- Network: encrypted messages on `/isc/delegate/1.0`
- Match forms within 30 seconds

### Debug Logging

```
Settings → Developer → Enable Debug Logging
```

Outputs: DHT announcements, match queries, delegation, WebRTC/WebTransport events, tier negotiation.

---

## 21. Version Negotiation

Protocol versions are negotiated via libp2p multistream-select. The tier extension is sent in
identify before any other protocol negotiation.

**Identify extension:**

```
/isc/tier/1.0   → payload: { tier: 0|1|2, networkID: "<genesis-hash>" }
```

**Protocol list (multistream):**

```
/isc/announce/1.0
/isc/chat/1.0
/isc/delegate/1.0
/isc/post/1.0
/isc/follow/1.0
/isc/dm/1.0
/isc/vouch/1.0    (Tier 1/2 only)
/isc/score/1.0    (Tier 1/2 only)
/isc/gossip/1.0   (Tier 1/2, hot clusters only)
```

Future versions: `/isc/chat/2.0`, etc. Clients support backward compatibility within major versions.
A v1 client connecting to a v2 peer will negotiate down to the common subset; tier mismatch causes
rejection before any protocol negotiation.
