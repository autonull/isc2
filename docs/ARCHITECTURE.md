# ISC Architecture Documentation

**Version**: 0.1.0  
**Last Updated**: March 12, 2026

---

## Overview

ISC (Internet Semantic Chat) is a decentralized, peer-to-peer social platform built on libp2p with semantic AI matching.

### Core Principles

1. **No servers** - Pure P2P via libp2p DHT
2. **No accounts** - Cryptographic identity (Ed25519 keypairs)
3. **Semantic matching** - Real AI embeddings (transformers.js)
4. **Privacy-first** - Local storage, ephemeral by default
5. **Progressive Enhancement** - Works on low-end devices

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Preact)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Now     │  │ Discover │  │  Chats   │  │ Settings │   │
│  │  Screen  │  │  Screen  │  │  Screen  │  │  Screen  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │           │
│  ┌────┴─────────────┴─────────────┴─────────────┴─────┐   │
│  │              Application Layer                      │   │
│  │  - Router  - State Mgmt  - Notifications           │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────┴───────────────────────────────┐   │
│  │               Domain Layer                           │   │
│  │  Channels  Chat  Video  Social  Crypto  Network     │   │
│  └─────────────────────┬───────────────────────────────┘   │
│                        │                                    │
│  ┌─────────────────────┴───────────────────────────────┐   │
│  │              Adapter Layer                           │   │
│  │  Storage (IDB)  Model (Transformers)  Network (libp2p)│  │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐
    │  Peer 1 │         │  Peer 2 │         │  Peer 3 │
    │ libp2p  │◄───────►│ libp2p  │◄───────►│ libp2p  │
    │  DHT    │         │  DHT    │         │  DHT    │
    └─────────┘  WebRTC └─────────┘  WebRTC └─────────┘
```

---

## Package Structure

```
isc2/
├── apps/
│   ├── browser/          # Preact web app (main client)
│   ├── cli/              # Node.js CLI tool
│   └── node/             # Node.js server (optional relay)
├── packages/
│   ├── core/             # Shared types, crypto, utilities
│   ├── protocol/         # Protocol definitions, constants
│   └── adapters/         # Storage, network, model adapters
└── docs/                 # Documentation
```

---

## Key Components

### 1. Identity System (`apps/browser/src/identity/`)

**Purpose**: Cryptographic identity management

```typescript
interface IdentityManager {
  keypair: CryptoKeyPair | null;
  publicKeyFingerprint: string | null;
  isInitialized: boolean;
}
```

**Features**:
- Ed25519 keypair generation
- Encrypted private key storage
- Passphrase-based encryption (PBKDF2)
- Peer ID derivation from public key

**Storage**: IndexedDB (`isc-identity`)

---

### 2. Channel System (`apps/browser/src/channels/`)

**Purpose**: Represent and manage thought channels

```typescript
interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number;        // Distribution spread (0.0-0.3)
  relations: Relation[]; // Contextual relations
  active: boolean;       // Currently announced to DHT
}
```

**Features**:
- Local persistence (IndexedDB)
- DHT announcement/withdrawal
- Activation/deactivation
- Forking and archiving

---

### 3. Embedding Service (`apps/browser/src/channels/embedding.ts`)

**Purpose**: Generate semantic embeddings for matching

```typescript
class EmbeddingService {
  async load(modelId: string): Promise<void>;
  async embed(text: string): Promise<number[]>;  // 384-dim vector
}
```

**Implementation**:
- Model: `Xenova/all-MiniLM-L6-v2` (via transformers.js)
- Quantized for browser (~22MB download, ~200MB runtime)
- Lazy loading with caching (5min TTL)
- Fallback to SHA-256 stub if model fails

**Usage**:
```typescript
const vector = await embeddingService.embed("AI ethics");
// Returns: [0.023, -0.145, 0.892, ...] (384 floats)
```

---

### 4. DHT Client (`apps/browser/src/network/dht.ts`)

**Purpose**: Distributed Hash Table for peer discovery

```typescript
class RealDHTClient {
  announce(key: string, value: Uint8Array, ttl: number): Promise<void>;
  query(key: string, count: number): Promise<Uint8Array[]>;
}
```

**Protocol**:
```
/isc/announce/{modelHash}/{lshHash}
```

**Features**:
- libp2p Kademlia DHT
- LSH (Locality Sensitive Hashing) for proximity
- Rate limiting (5 announces/min, 30 queries/min)
- Signature verification on receive

---

### 5. Chat Handler (`apps/browser/src/chat/webrtc.ts`)

**Purpose**: Peer-to-peer messaging via WebRTC

```typescript
interface ChatMessage {
  channelID: string;
  msg: string;
  timestamp: number;
  sender: string;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  signature?: Uint8Array;
}
```

**Flow**:
1. Dial peer via libp2p (`/isc/chat/1.0`)
2. Send message over stream
3. Peer receives and verifies signature
4. Peer sends acknowledgment
5. Update status to "delivered"

**Features**:
- Delivery confirmations
- Typing indicators (debounced, 2s cooldown)
- Signature verification
- Rate limiting (20 messages/hour)

---

### 6. Video Call Handler (`apps/browser/src/video/handler.ts`)

**Purpose**: WebRTC video calls

```typescript
interface VideoCall {
  callID: string;
  type: 'direct' | 'group';
  participants: VideoParticipant[];
  maxParticipants: number;
}
```

**Features**:
- Direct peer-to-peer WebRTC
- Group calls via mesh topology
- Screen sharing
- Mute/video/screen controls
- Permission error handling

---

## Data Flow

### Creating a Channel

```
User Input → Compose Screen → ChannelManager → IndexedDB
                                      ↓
                              EmbeddingService
                                      ↓
                              DHTClient.announce()
                                      ↓
                              libp2p DHT (multiple LSH buckets)
```

### Discovering Matches

```
Discover Screen → ChannelManager (get active channel)
                        ↓
              EmbeddingService.embed(description)
                        ↓
              LSH Hash (20 buckets)
                        ↓
              DHTClient.query() × 5 (parallel)
                        ↓
              Cosine Similarity Filter (≥0.55)
                        ↓
              Sorted Results → UI
```

### Sending a Chat Message

```
User Input → ChatsScreen → ChatHandler.sendMessage()
                                ↓
                        Rate Limit Check
                                ↓
                        Sign Message (Ed25519)
                                ↓
                        libp2p.dialProtocol()
                                ↓
                        WebRTC Stream → Peer
                                ↓
                        Peer Verifies Signature
                                ↓
                        Peer Sends Ack
                                ↓
                        Update Status → "delivered"
```

---

## Security Architecture

### 1. Cryptographic Identity

```
┌─────────────────┐
│  Ed25519 Keypair│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
Private     Public
Key         Key
│           │
│      ┌────┴────┐
│      │  Peer   │
│      │   ID    │
│      └─────────┘
│
│  Encrypted with
│  PBKDF2 + Passphrase
│
▼
IndexedDB
```

### 2. Message Signing

```typescript
// Sign
const payload = encode(message);
const signature = await sign(payload, privateKey);

// Verify
const isValid = await verify(payload, signature, publicKey);
```

### 3. Rate Limiting

| Action | Limit | Window | Consequence |
|--------|-------|--------|-------------|
| Announce | 5 | 1 min | Block after 3 violations |
| Query | 30 | 1 min | Block after 3 violations |
| Chat | 20 | 1 hour | Block after 3 violations |

### 4. Content Sanitization

```typescript
// All user content sanitized before render
const safe = sanitizeHTML(userContent);
// Blocks: <script>, onclick, javascript:, etc.
```

---

## Performance Optimizations

### 1. Embedding Cache

```typescript
// 5-minute TTL cache
const cache = new Map<string, { vector: number[], timestamp: number }>();
```

### 2. LSH Bucket Parallelization

```typescript
// Query 5 buckets in parallel
const results = await Promise.all(
  hashes.slice(0, 5).map(hash => dht.query(key))
);
```

### 3. Lazy Loading

```typescript
// Transformers.js loaded only when needed
const { pipeline } = await import('@xenova/transformers');
```

---

## State Management

### Local Storage Keys

| Key | Purpose | Format |
|-----|---------|--------|
| `isc-identity` | Keypair storage | IndexedDB |
| `isc-channels` | Channel data | IndexedDB |
| `isc-conversations` | Chat list | localStorage |
| `isc-messages-{peerId}` | Messages | localStorage |
| `isc-settings` | User preferences | localStorage |

### Cross-Tab Synchronization

```typescript
window.addEventListener('storage', (e) => {
  if (e.key === 'isc-conversations') {
    // Reload conversations
  }
});
```

---

## Network Topology

```
        ┌─────────┐
        │  Relay  │ (Bootstrap peer)
        └────┬────┘
             │
    ┌────────┼────────┐
    │        │        │
┌───┴───┐ ┌──┴──┐ ┌──┴──┐
│Peer A │ │Peer B│ │Peer C│
└───┬───┘ └──┬──┘ └──┬──┘
    │        │       │
    └────────┼───────┘
         Direct P2P
        (WebRTC)
```

**Bootstrap Peers**: Public libp2p relays for initial discovery

**After Discovery**: Direct peer-to-peer communication

---

## Error Handling

### Graceful Degradation

```typescript
try {
  vector = await embeddingService.embed(text);
} catch {
  // Fallback to stub embedding
  vector = stubEmbed(text);
}
```

### Retry Logic

```typescript
// Messages retry on failure
if (status === 'failed') {
  // Show retry button
}
```

### Timeout Handling

```typescript
// 10-second delivery timeout
const timeoutId = setTimeout(() => {
  updateStatus('failed');
}, MESSAGE_TIMEOUT);
```

---

## Testing Strategy

### Unit Tests (`tests/unit/`)
- Crypto functions
- Embedding service
- Rate limiting

### Integration Tests (`tests/integration/`)
- DHT announce/query
- Chat message flow
- Channel lifecycle

### E2E Tests (`tests/e2e/`)
- Complete user flows
- Video call functionality
- Cross-tab synchronization

---

## Deployment

### PWA Configuration

```typescript
// vite-plugin-pwa
{
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [...]
  }
}
```

### Build Output

```
dist/
├── index.html           # Entry point
├── manifest.webmanifest # PWA manifest
├── sw.js                # Service worker
└── assets/
    ├── main-*.js        # App bundle (~660KB)
    └── transformers-*.js # AI model (~823KB)
```

---

## Future Enhancements

### Planned
- [ ] Onboarding flow for first-time users
- [ ] Bundle size optimization (code splitting)
- [ ] DHT query caching
- [ ] Signature verification UI
- [ ] Performance benchmarks

### Under Consideration
- [ ] Shamir's Secret Sharing for key backup
- [ ] Ephemeral identities for sensitive conversations
- [ ] IP protection via circuit relay
- [ ] AT Protocol interop

---

## Contributing

See `docs/CONTRIBUTING.md` for guidelines.

### Key Files to Know
- `apps/browser/src/App.tsx` - Main app component
- `apps/browser/src/router.ts` - Client-side routing
- `packages/core/src/` - Shared utilities
- `packages/adapters/src/browser/` - Browser-specific adapters

### Development Setup
```bash
pnpm install
pnpm dev:browser
```

---

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: `docs/` folder
