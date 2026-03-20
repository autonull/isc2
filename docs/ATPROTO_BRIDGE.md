# AT Protocol / Bluesky Bridge Design

> **Design document for bridging ISC semantic discovery with Bluesky's AT Protocol social graph**

**Version:** 1.0  
**Status:** Design draft — implement only after Phase A–D complete  
**Effort estimate:** ~1 week for v1

---

## 1. Motivation

ISC's core value proposition is semantic proximity-based discovery. Bluesky's core value proposition
is an open, portable social graph. These are complementary, not competing.

**The bridge enables:**

- Bluesky users discover ISC peers with semantically similar interests
- ISC users discover Bluesky users in the same semantic neighborhoods
- Cross-posting ISC announcements to Bluesky as public posts
- Bluesky social proof (follows, likes) informing ISC reputation

**Why it's a growth vector, not a threat:** ISC users who want social graph features (followers,
likes, threads) already exist on Bluesky. Rather than competing with Bluesky, ISC becomes the
discovery layer that Bluesky lacks. The AT Protocol's portability ensures ISC doesn't create a new
lock-in.

---

## 2. Identity Mapping

### 2.1 The Core Problem

Bluesky identities are `did:plc` or `did:web` identifiers (a DID document containing a signing key).
ISC identities are Ed25519 keypairs derived from libp2p peer IDs. These are incompatible by
construction.

### 2.2 Proposed Mapping

```
Bluesky did:plc → ISC peer ID (semantic neighborhood)

ISC peer ID → Bluesky did:plc (social link)

No shared secret required. Mapping is public and verifiable.
```

**Approach:** Use a **namespace prefix** in the ISC DHT keyspace. Bluesky-linked ISC peers announce
in the `/isc/bluesky/<did:plc>` namespace. Standard ISC peers announce in
`/isc/announce/<modelHash>/<lshBucketKey>`.

### 2.3 Identity Proof

A Bluesky user proves ownership of an ISC peer ID by:

1. Posting a signed challenge from their Bluesky DID key to ISC
2. Posting a signed ISC peer ID announcement to their Bluesky feed

Both signatures must match. This is a two-way bridge, not a unilateral claim.

**Bluesky → ISC proof (Bluesky post):**

```json
{
  "$type": "app.bsky.feed.post",
  "text": "Verifying my ISC identity: isc://12D3KooW... #isc",
  "Uri": "at://did:plc:abc123/app.bsky.feed.post/xyz",
  "cid": "bafyreiabc..."
}
```

**ISC → Bluesky proof (ISC announcement extension):**

```typescript
interface BlueskyLinkedAnnouncement extends SignedAnnouncement {
  blueskyDid: string; // "did:plc:abc123"
  blueskyPostUri: string; // "at://did:plc:abc123/app.bsky.feed.post/xyz"
  blueskyPostCid: string; // CID of the verification post
  blueskySig: string; // BLS signature over announcement from Bluesky DID key
}
```

### 2.4 Resolution

Any client can verify the link:

1. Fetch the Bluesky post from AT Protocol PDS
2. Verify the DID signature on the post
3. Check that the ISC peer ID in the post text matches the Bluesky DID in the ISC announcement

---

## 3. Post Translation

### 3.1 Bluesky Post → ISC Announcement

A Bluesky post can be announced to the ISC DHT, making it discoverable by semantic proximity.

**Process:**

1. User links their Bluesky account (see §2)
2. Bluesky posts are fetched via AT Protocol ( user's repo at PDS)
3. Post text is embedded using the ISC embedding model
4. A Bluesky-linked ISC announcement is published to `/isc/bluesky/<did:plc>/<lshBucketKey>`
5. The Bluesky post URI is embedded in the announcement payload

**Announcement payload:**

```typescript
interface BlueskyPostAnnouncement {
  v: 2;
  peerID: string; // ISC peer ID (linked to Bluesky)
  blueskyDid: string; // Bluesky DID
  blueskyPostUri: string; // AT Protocol URI
  blueskyPostCid: string; // Content ID (immutable)
  postText: string; // Original post text
  model: string; // ISC embedding model
  lshKeys: string[]; // ISC LSH bucket keys
  ts: number; // Unix ms
  sig: Uint8Array; // ISC ed25519 signature
}
```

**Limitation:** Bluesky posts are not ISC-native content — they cannot be replied to, liked, or DMed
via ISC. ISC provides semantic discovery of Bluesky posts; Bluesky provides social context around
ISC peers.

### 3.2 ISC Announcement → Bluesky Post

An ISC user can cross-post their channel description or a conversation summary to Bluesky.

**Process:**

1. User clicks "Share to Bluesky" in ISC UI
2. ISC generates a Bluesky-formatted post: "I'm exploring [channel description] on ISC — semantic
   space for curious thinkers. Join me: [invite link]"
3. User authenticates with Bluesky OAuth 2.0
4. Post is published to the user's Bluesky repo via AT Protocol

**Security note:** The invite link exposes the user's ISC peer ID publicly. Users should be warned
when enabling cross-posting.

---

## 4. Discovery Integration

### 4.1 Bluesky-First Discovery

When a Bluesky user links their account, ISC can show them:

- Bluesky users they already follow who are in nearby semantic neighborhoods
- Bluesky posts with high similarity to their channel description
- Bluesky users followed by their ISC match set

### 4.2 AT Protocol Data Fetched

| Data                           | Source                         | Used For               |
| ------------------------------ | ------------------------------ | ---------------------- |
| Profile (display name, avatar) | `com.atproto.repo.getRecord`   | Peer display in ISC UI |
| Followers                      | `com.atproto.repo.listRecords` | Social proof           |
| Posts                          | `com.atproto.repo.listRecords` | Cross-post to ISC      |
| Likes                          | `app.bsky.feed.getLikes`       | Reputation signal      |

### 4.3 Privacy Considerations

- Bluesky data is only fetched when the user explicitly links their account
- Bluesky followers/following are never published to the ISC DHT
- Bluesky post fetching happens client-side only (no server proxy)
- If a Bluesky user unlinks or deletes their account, ISC announcements remain but are marked stale
  after 30 days

---

## 5. Architecture

### 5.1 Module Structure

```
apps/browser/src/bridge/
├── atproto/
│   ├── client.ts        # AT Protocol HTTP client (PDS API)
│   ├── auth.ts          # OAuth 2.0 DID Auth
│   ├── repo.ts          # Repo operations (create record, list records)
│   └── resolver.ts       # DID resolution (did:plc, did:web)
├── bluesky/
│   ├── linker.ts        # Two-way identity linking
│   ├── postSync.ts      # Bluesky post → ISC announcement
│   ├── crossPost.ts     # ISC channel → Bluesky post
│   └── profileCache.ts  # Bluesky profile data cache
└── index.ts             # BridgeService
```

### 5.2 AT Protocol Client

Bluesky's AT Protocol is HTTP-based. The v1 API is well-documented.

```
PDS endpoints (public):
GET  /xrpc/app.bsky.feed.getAuthorFeed?actor=<did>
GET  /xrpc/app.bsky.feed.getPostThread?uri=<at://uri>
GET  /xrpc/com.atproto.repo.getRecord?repo=<did>&collection=app.bsky.feed.post&rkey=<rkey>
POST /xrpc/com.atproto.repo.createRecord
```

Authentication: OAuth 2.0 with DID Auth (`did:plc` signing). The Bluesky app password system
(`app.bsky.actor.getSession`) is the simplest initial path.

### 5.3 Rate Limiting

- PDS rate limits: typically 100 req/min per token
- Cache Bluesky profiles for 5 minutes
- Cache feed results for 2 minutes
- Never fan-out to multiple PDS instances simultaneously

---

## 6. UX Flow

### 6.1 Linking a Bluesky Account

1. User opens Settings → Linked Accounts → "Connect Bluesky"
2. Bluesky OAuth 2.0 flow (user approves in Bluesky app)
3. ISC client fetches the user's Bluesky profile
4. User posts the verification challenge to Bluesky (step 1 of §2.3)
5. ISC verifies the post was published
6. Linked state stored in IndexedDB

### 6.2 Discovering Bluesky Users

1. User links Bluesky account (above)
2. ISC fetches user's Bluesky following list
3. For each followed user, ISC fetches their recent posts
4. Posts are embedded; LSH bucket keys computed
5. Bluesky users in nearby semantic neighborhoods are surfaced as matches
6. Match card shows: Bluesky display name, avatar, ISC similarity score, "Follow on Bluesky" button

### 6.3 Cross-Posting to Bluesky

1. User opens channel mixer → "Share to Bluesky"
2. ISC generates a draft post with channel description + invite link
3. User edits the post text
4. "Post to Bluesky" → AT Protocol `createRecord`
5. Confirmation: "Posted to Bluesky as [link]"

---

## 7. Security Considerations

| Risk                                          | Mitigation                                               |
| --------------------------------------------- | -------------------------------------------------------- |
| Bluesky account takeover → ISC identity theft | Two-way proof required; ISC keypair never transmitted    |
| Bluesky DMs exposed via ISC                   | No DM bridge; only public posts are synced               |
| Cross-posting reveals peer ID publicly        | Explicit user consent required; warning shown            |
| Bluesky PDS downtime                          | Graceful degradation; bridge goes offline, ISC continues |
| Fake Bluesky profiles claiming ISC links      | Both proofs required; client verifies before surfacing   |

---

## 8. Future Directions

- **Bluesky list import**: Import a Bluesky list as an ISC channel seed
- **Relay follows**: See which of your Bluesky followers are nearby in semantic space
- **AT Protocol federation**: ISC peers as Bluesky relays for low-bandwidth regions
- **Bluesky Graphverse client**: A Bluesky-first ISC client using this bridge

---

## 9. Implementation Phases

**Phase 1 (v1 — "Read-only bridge"):**

- Link Bluesky account
- Display Bluesky profiles of nearby ISC peers
- Surfacing Bluesky follows as social proof in ISC matches
- No cross-posting

**Phase 2 (v2 — "Write bridge"):**

- Cross-post ISC channel to Bluesky
- Bluesky post → ISC announcement sync
- Verification post flow

**Phase 3 (v3 — "Social proof"):**

- Bluesky follower/following graph informs reputation
- Bluesky lists as ISC channel seeds
- Full AT Protocol repo sync
