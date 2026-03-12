# ISC Architecture Documentation

> **System architecture and design decisions for ISC developers**

## Overview

ISC is a decentralized social platform built as a TypeScript monorepo. The architecture prioritizes:
- **Browser-native**: All computation runs in the browser
- **P2P networking**: libp2p for discovery and communication
- **Semantic matching**: LLM embeddings for thought proximity
- **Offline-first**: Works without network, syncs on reconnect

## Monorepo Structure

```
isc2/
├── packages/
│   ├── core/           # Environment-agnostic primitives
│   ├── adapters/       # Browser/Node/CLI adapters
│   └── protocol/       # P2P protocol handlers
├── apps/
│   ├── browser/        # PWA browser application
│   ├── cli/            # Command-line interface
│   └── node/           # Node.js application
├── tests/
│   ├── unit/           # Unit tests
│   ├── e2e/            # End-to-end tests
│   ├── integration/    # Integration tests
│   └── benchmarks/     # Performance benchmarks
└── docs/               # Documentation
```

## Package Dependencies

```
@isc/core (no dependencies)
    ↓
@isc/adapters (depends on @isc/core)
    ↓
@isc/protocol (depends on @isc/core, @isc/adapters)
    ↓
apps/* (depend on all packages)
```

## Core Architecture

### @isc/core

Environment-agnostic primitives used across all platforms:

```
src/
├── crypto/           # Keypair, signing, encryption
├── math/             # Cosine similarity, LSH, sampling
├── semantic/         # Distribution computation, matching
├── interop/          # AT Protocol, data portability
├── config.ts         # Configuration management
├── encoding.ts       # CBOR-like binary encoding
├── errors.ts         # Error handling utilities
├── types.ts          # TypeScript type definitions
└── validators.ts     # Runtime validation
```

**Key exports**:
- `generateKeypair()`: Ed25519 keypair generation
- `sign()`, `verify()`: Digital signatures
- `cosineSimilarity()`: Vector similarity
- `lshHash()`: Locality-sensitive hashing
- `computeRelationalDistributions()`: Channel embeddings
- `matchDistributions()`: Semantic matching

### @isc/adapters

Platform-specific implementations:

```
src/
├── browser/
│   ├── network.ts    # libp2p browser configuration
│   ├── model.ts      # Embedding model adapter
│   └── storage.ts    # IndexedDB helpers
├── node/
│   ├── network.ts    # libp2p node configuration
│   └── storage.ts    # Filesystem storage
└── shared/
    └── utils.ts      # Cross-platform utilities
```

**Key abstractions**:
- `DHTClient`: Unified DHT interface
- `EmbeddingModelAdapter`: Model loading interface
- `StorageAdapter`: Persistent storage interface

### @isc/protocol

P2P protocol handlers:

```
src/
├── handlers/
│   ├── chat.ts       # /isc/chat/1.0
│   ├── announce.ts   # /isc/announce/1.0
│   └── delegate.ts   # /isc/delegate/1.0
├── constants.ts      # Protocol constants
├── keys.ts           # DHT key schemas
├── messages.ts       # Message type definitions
└── rateLimit.ts      # Rate limiting
```

## Browser Application Architecture

### Layered Architecture

```
┌─────────────────────────────────────────┐
│           Screens (UI Layer)            │
│  Now, Discover, Chats, Settings, etc.   │
├─────────────────────────────────────────┤
│         Components (Reusable UI)        │
│  Feed, Post, MatchCard, VideoCallUI     │
├─────────────────────────────────────────┤
│         Domain Services (Logic)         │
│  channels/, chat/, social/, video/      │
├─────────────────────────────────────────┤
│         Infrastructure (I/O)            │
│  network/, db/, delegation/, crypto/    │
├─────────────────────────────────────────┤
│           Core Packages                 │
│  @isc/core, @isc/adapters, @isc/protocol│
└─────────────────────────────────────────┘
```

### Data Flow

```
User Action → Screen → Service → Infrastructure → Core → P2P Network
                    ↓
              localStorage/IndexedDB
                    ↓
              Cross-tab sync
```

### Key Services

#### Channel Manager (`channels/manager.ts`)

Manages channel CRUD operations:
- Create, read, update, delete channels
- Activate/deactivate channels
- Announce to DHT on changes
- Cross-tab synchronization

#### Chat Handler (`chat/webrtc.ts`)

Handles real-time messaging:
- WebRTC connection management
- Message signing and verification
- Delivery acknowledgments
- Typing indicators
- Message notifications

#### DHT Client (`network/dht.ts`)

Manages P2P networking:
- libp2p node initialization
- DHT announcements and queries
- Peer discovery
- Rate limiting
- Connection monitoring

#### Delegation Client (`delegation/fallback.ts`)

Handles supernode delegation:
- Supernode discovery
- Request encryption
- Response verification
- Fallback to local computation
- Reputation tracking

### State Management

ISC uses a **lightweight state management** approach:

1. **Component state**: `useState`, `useEffect` for local UI state
2. **Service state**: Singleton services manage domain state
3. **Persistent state**: localStorage/IndexedDB for durability
4. **Cross-tab sync**: `storage` events for multi-tab consistency

**No Redux/Zustand** — the app is small enough for direct state management.

## Data Models

### Channel

```typescript
interface Channel {
  id: string;              // UUID
  name: string;            // Display name
  description: string;     // Semantic description
  spread: number;          // Distribution fuzziness (0-0.3)
  relations: Relation[];   // Contextual bindings (max 5)
  active: boolean;         // Currently selected
  createdAt: number;       // Unix timestamp
  updatedAt: number;       // Unix timestamp
}
```

### Distribution

```typescript
interface Distribution {
  type: 'root' | 'fused';
  mu: number[];            // Mean vector (384-dim)
  sigma: number;           // Standard deviation
  tag?: string;            // Relation tag (for fused)
  weight?: number;         // Relation weight (for fused)
}
```

### Chat Message

```typescript
interface ChatMessage {
  channelID: string;       // Associated channel
  msg: string;             // Message content
  timestamp: number;       // Unix timestamp
  sender: 'me' | string;   // Sender identifier
  id?: string;             // Local message ID
  status?: MessageStatus;  // pending | sent | delivered | failed
}
```

## Security Architecture

### Cryptographic Primitives

All cryptography uses Web Crypto API:

```typescript
// Keypair generation
const keypair = await crypto.subtle.generateKey(
  { name: 'Ed25519', namedCurve: 'Ed25519' },
  true,
  ['sign', 'verify']
);

// Signing
const signature = await crypto.subtle.sign(
  'Ed25519',
  privateKey,
  encodedMessage
);

// Verification
const valid = await crypto.subtle.verify(
  'Ed25519',
  publicKey,
  signature,
  encodedMessage
);
```

### Trust Model

ISC operates in **Trusted Network Mode** (Phase 1):

| Threat | Mitigation |
|--------|------------|
| Malicious peers | Signature verification, block/mute |
| Spam | Rate limiting (5 announces/min) |
| Sybil attacks | Social trust barrier |
| NAT traversal | Circuit relay fallback |

### Privacy Guarantees

1. **No central data collection**: All data stored locally
2. **Ephemeral announcements**: 5-minute TTL
3. **E2E encryption**: WebRTC DTLS + Noise protocol
4. **Minimal disclosure**: Only vectors announced, not raw text

## Performance Optimizations

### Bundle Size

- **Lazy loading**: Transformers.js loaded on demand
- **Code splitting**: Routes split into separate chunks
- **Tree shaking**: Unused code eliminated
- **Quantized models**: 22MB → 8MB with quantization

### Caching Strategy

| Layer | Data | TTL |
|-------|------|-----|
| L1 (Memory) | Active channels, recent matches | 30s |
| L2 (IndexedDB) | All channels, conversations | Persistent |
| L3 (DHT) | Network announcements | 5min |

### Query Optimization

```typescript
// Parallel LSH bucket queries
const hashes = lshHash(vec, modelHash, 20, 32);
const results = await Promise.all(
  hashes.slice(0, 5).map(hash => dht.query(key(hash), 20))
);
```

## Testing Strategy

### Test Pyramid

```
        ╱╲
       ╱  ╲      E2E Tests (Playwright)
      ╱────╲
     ╱      ╲    Integration Tests
    ╱────────╲
   ╱          ╲  Unit Tests (Vitest)
  ╱────────────╲
```

### Unit Tests

- **Location**: `packages/*/tests/`, `apps/*/tests/`
- **Framework**: Vitest
- **Coverage**: Core logic, utilities, validators

### E2E Tests

- **Location**: `tests/e2e/`
- **Framework**: Playwright
- **Coverage**: Critical user flows

### Integration Tests

- **Location**: `tests/integration/`
- **Focus**: P2P networking, DHT, delegation

## Deployment

### Browser PWA

Built with Vite, deployed as static files:

```bash
pnpm build
# Output: apps/browser/dist/
# Deploy to: GitHub Pages, Netlify, Vercel, IPFS
```

### PWA Features

- **Service worker**: Offline caching
- **Manifest**: Installable on all platforms
- **Push notifications**: Browser-native notifications

### Bootstrap Peers

ISC requires bootstrap peers for initial discovery:

```typescript
const BOOTSTRAP_PEERS = [
  '/dns4/relay.libp2p.io/tcp/443/wss/p2p/Qm...',
  // Community-run relays
];
```

## Development Workflow

### Local Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Run E2E tests
pnpm test:e2e
```

### Code Style

- **Linting**: ESLint with TypeScript
- **Formatting**: Prettier
- **Type checking**: TypeScript strict mode
- **Git hooks**: Husky + lint-staged

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `fix/*`: Bug fixes

## Monitoring & Observability

### Debug Logging

Enable debug logging in Settings → Developer:

```typescript
console.log('[DHT] Announced:', key);
console.log('[Chat] Received:', msg);
console.log('[Embedding] Model loaded:', modelId);
```

### Metrics

Track these metrics for performance monitoring:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time-to-first-match | <15s | Discover tab load |
| Message delivery latency | <2s | Send to ack |
| Bundle size | <300KB | Build output |
| Memory usage | <200MB | DevTools |

## Future Architecture

### Phase 2: Scale & Safety

- **Reputation system**: Signed interaction history
- **Relational embeddings**: Full compositional semantics
- **Offline sync**: CRDT-based conflict resolution

### Phase 3: Social Layer

- **Posts & feeds**: DHT-stored social content
- **Communities**: Shared channel distributions
- **Audio spaces**: WebRTC mesh broadcasting

### Phase 4: Ecosystem

- **Mobile apps**: React Native / Flutter
- **Protocol bridges**: AT Protocol, Nostr interop
- **DAO governance**: Community-led upgrades

---

**For more details, see:**
- [PROTOCOL.md](../PROTOCOL.md) - P2P protocol specification
- [SEMANTIC.md](../SEMANTIC.md) - Embedding model specification
- [SECURITY.md](../SECURITY.md) - Threat model and security
