# ISC API Reference

> **Internal API reference for ISC developers**

## Core Package (`@isc/core`)

### Crypto

#### `generateKeypair()`

Generate an Ed25519 keypair using Web Crypto API.

```typescript
async function generateKeypair(): Promise<CryptoKeyPair>
```

**Returns**: `CryptoKeyPair` with `publicKey` and `privateKey`

**Example**:
```typescript
const keypair = await generateKeypair();
```

---

#### `exportKeypair(keypair)`

Export keypair to Uint8Array format.

```typescript
async function exportKeypair(
  keypair: CryptoKeyPair
): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>
```

---

#### `importKeypair(publicKey, privateKey)`

Import keypair from Uint8Array format.

```typescript
async function importKeypair(
  publicKey: Uint8Array,
  privateKey: Uint8Array
): Promise<CryptoKeyPair>
```

---

#### `sign(message, privateKey)`

Sign a message with Ed25519.

```typescript
async function sign(
  message: Uint8Array,
  privateKey: CryptoKey
): Promise<Signature>
```

**Returns**: `Signature` with `data: Uint8Array` and `algorithm: 'Ed25519'`

---

#### `verify(message, signature, publicKey)`

Verify a signature.

```typescript
async function verify(
  message: Uint8Array,
  signature: Signature,
  publicKey: CryptoKey
): Promise<boolean>
```

---

#### `encryptPrivateKey(privateKey, passphrase)`

Encrypt private key with passphrase.

```typescript
async function encryptPrivateKey(
  privateKey: Uint8Array,
  passphrase: string
): Promise<EncryptedKeypair>
```

**Returns**: `EncryptedKeypair` with `encryptedPrivateKey`, `salt`, `iterations`

---

#### `decryptPrivateKey(encrypted, passphrase)`

Decrypt private key.

```typescript
async function decryptPrivateKey(
  encrypted: EncryptedKeypair,
  passphrase: string
): Promise<Uint8Array>
```

---

### Math

#### `cosineSimilarity(vec1, vec2)`

Compute cosine similarity between two vectors.

```typescript
function cosineSimilarity(vec1: number[], vec2: number[]): number
```

**Returns**: Similarity score in range [-1, 1]

---

#### `lshHash(vec, seed, numHashes, hashLen)`

Generate locality-sensitive hashes.

```typescript
function lshHash(
  vec: number[],
  seed: string,
  numHashes: number = 20,
  hashLen: number = 32
): string[]
```

**Returns**: Array of binary hash strings

---

#### `sampleFromDistribution(mean, sigma, numSamples)`

Sample from Gaussian distribution.

```typescript
function sampleFromDistribution(
  mean: number[],
  sigma: number,
  numSamples: number
): number[][]
```

**Returns**: Array of sampled vectors

---

### Semantic

#### `computeRelationalDistributions(channel)`

Compute distributions for a channel.

```typescript
async function computeRelationalDistributions(
  channel: Channel
): Promise<Distribution[]>
```

**Returns**: Array of distributions (root + fused)

---

#### `matchDistributions(dists1, dists2)`

Match two sets of distributions.

```typescript
async function matchDistributions(
  dists1: Distribution[],
  dists2: Distribution[]
): Promise<MatchResult>
```

**Returns**: `MatchResult` with `overallSimilarity` and `alignments`

---

### Encoding

#### `encode(obj)`

Encode object to binary.

```typescript
function encode(obj: any): Uint8Array
```

---

#### `decode(data)`

Decode binary to object.

```typescript
function decode(data: Uint8Array): any
```

---

### Validators

#### `Validators.keypair(keypair)`

Validate keypair structure.

```typescript
Validators.keypair(keypair: any): void
```

**Throws**: `AppError` if invalid

---

#### `isDefined(value)`

Check if value is defined (not undefined).

```typescript
function isDefined<T>(value: T | undefined): value is T
```

---

#### `isValidNumber(value)`

Check if value is a valid number (not NaN/Infinity).

```typescript
function isValidNumber(value: any): value is number
```

---

### Errors

#### `AppError`

Custom error class with error codes.

```typescript
class AppError extends Error {
  code: ErrorCodes;
  cause?: Error;
}
```

---

#### `safeAsync(promise)`

Wrap promise in try-catch.

```typescript
async function safeAsync<T>(
  promise: Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: Error }>
```

---

## Adapters Package (`@isc/adapters`)

### Browser Network

#### `createBrowserLibp2p(config)`

Create libp2p node for browser.

```typescript
async function createBrowserLibp2p(
  config?: Libp2pConfig
): Promise<Libp2p>
```

---

### Browser Storage

#### `openDB(name, version, onUpgrade)`

Open IndexedDB database.

```typescript
function openDB(
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase) => void
): Promise<IDBDatabase>
```

---

#### `dbGet(db, store, key)`

Get value from IndexedDB.

```typescript
function dbGet<T>(
  db: IDBDatabase,
  store: string,
  key: string
): Promise<T | null>
```

---

#### `dbPut(db, store, value)`

Put value to IndexedDB.

```typescript
function dbPut<T>(
  db: IDBDatabase,
  store: string,
  value: T
): Promise<void>
```

---

## Protocol Package (`@isc/protocol`)

### Constants

```typescript
const PROTOCOL_CHAT = '/isc/chat/1.0';
const PROTOCOL_DELEGATE = '/isc/delegate/1.0';
const PROTOCOL_ANNOUNCE = '/isc/announce/1.0';
const PROTOCOL_POST = '/isc/post/1.0';
```

---

### DHT Keys

```typescript
const DHT_KEYS = {
  ANNOUNCE: '/isc/announce',
  DELEGATE: '/isc/delegate',
  MUTE: '/isc/mute',
  POST: '/isc/post',
  IDENTITY: '/isc/identity',
};
```

---

### Rate Limits

```typescript
const RATE_LIMITS = {
  ANNOUNCE: { limit: 5, windowMs: 60000 },    // 5/min
  QUERY: { limit: 30, windowMs: 60000 },      // 30/min
  CHAT: { limit: 20, windowMs: 3600000 },     // 20/hr
};
```

---

### Messages

#### `SignedAnnouncement`

```typescript
interface SignedAnnouncement {
  peerID: string;
  channelID: string;
  model: string;
  vec: number[];
  relTag?: string;
  ttl: number;
  updatedAt: number;
  signature: Uint8Array;
}
```

---

#### `ChatMessage`

```typescript
interface ChatMessage {
  channelID: string;
  msg: string;
  timestamp: number;
  sender: string;
  signature?: Uint8Array;
}
```

---

#### `DelegateRequest`

```typescript
interface DelegateRequest {
  requestID: string;
  service: 'embed' | 'ann_query' | 'sig_verify';
  payload: Uint8Array;
  requesterPubKey: Uint8Array;
  timestamp: number;
  signature: Uint8Array;
}
```

---

## Browser App Services

### Channel Manager

```typescript
import { channelManager } from './channels/manager.js';

// Create channel
const channel = await channelManager.createChannel(
  'AI Ethics',
  'Ethical implications of ML',
  0.1,
  []
);

// Get all channels
const channels = await channelManager.getAllChannels();

// Activate channel
await channelManager.activateChannel(channelId, []);

// Update channel
await channelManager.updateChannel(channelId, {
  description: 'Updated description'
});

// Delete channel
await channelManager.deleteChannel(channelId);
```

---

### Chat Handler

```typescript
import { getChatHandler } from './chat/webrtc.js';

const chatHandler = getChatHandler();

// Set message callback
chatHandler.setOnMessage((msg) => {
  console.log('New message:', msg);
});

// Set status callback
chatHandler.setOnStatusUpdate((messageId, status) => {
  console.log('Message status:', status);
});

// Send message
await chatHandler.sendMessage(peerId, message, node);

// Register with node
chatHandler.registerWithNode(node);
```

---

### DHT Client

```typescript
import { getDHTClient, initializeDHT } from './network/dht.js';

// Initialize DHT
const dht = await initializeDHT();

// Get client
const client = getDHTClient();

// Announce to DHT
await client.announce(key, value, ttl);

// Query DHT
const results = await client.query(key, count);

// Get peer ID
const peerId = client.getPeerId();

// Check connection
const isConnected = client.isConnected();
```

---

### Embedding Service

```typescript
import { embeddingService } from './channels/embedding.js';

// Load model
await embeddingService.load();

// Generate embedding
const vector = await embeddingService.embed('Your text here');

// Check if loaded
const isLoaded = embeddingService.isLoaded();

// Unload model
await embeddingService.unload();
```

---

### Delegation Client

```typescript
import { DelegationClient } from './delegation/fallback.js';

const client = DelegationClient.getInstance();

// Announce to DHT
await client.announce(key, value, ttl);

// Query DHT
const results = await client.query(key, limit);

// Get health stats
const health = client.getHealth();
```

---

### Notification Service

```typescript
import { notificationService } from './chat/notifications.js';

// Request permission
await notificationService.requestPermission();

// Check permission
const hasPermission = notificationService.hasPermission();

// Show notification
notificationService.showMessage(peerId, message);

// Set badge count
notificationService.setBadgeCount(5);

// Clear badge
notificationService.clearBadge();
```

---

### Identity

```typescript
import { 
  initializeIdentity, 
  getPeerID, 
  getKeypair 
} from './identity/index.js';

// Initialize identity
const identity = await initializeIdentity('optional-passphrase');

// Get peer ID
const peerId = await getPeerID();

// Get keypair
const keypair = getKeypair();

// Announce public key
await announcePublicKey();
```

---

### Rate Limiting

```typescript
import {
  checkAnnounceRate,
  checkQueryRate,
  checkChatRate,
  getRateLimitStatus
} from './rateLimit.js';

// Check announce rate
const announceResult = checkAnnounceRate(peerId);
if (!announceResult.allowed) {
  console.log('Retry after:', announceResult.retryAfter);
}

// Get rate limit status
const status = getRateLimitStatus(peerId);
console.log('Announces remaining:', status.announcesRemaining);
```

---

### Offline Sync

```typescript
import {
  initSyncManager,
  registerProcessor,
  syncPendingActions
} from './offline/sync.js';

// Initialize sync manager
initSyncManager();

// Register action processor
registerProcessor('post', async (action) => {
  // Process post action
  return true;
});

// Sync pending actions
const result = await syncPendingActions();
console.log('Synced:', result.success, 'Failed:', result.failed);
```

---

## Type Definitions

### Channel

```typescript
interface Channel {
  id: string;
  name: string;
  description: string;
  spread: number;
  relations: Relation[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
}
```

---

### Relation

```typescript
interface Relation {
  tag: string;  // in_location, during_time, with_mood, etc.
  object: string;
  weight?: number;
}
```

---

### Distribution

```typescript
interface Distribution {
  type: 'root' | 'fused';
  mu: number[];
  sigma: number;
  tag?: string;
  weight?: number;
}
```

---

### MessageStatus

```typescript
type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';
```

---

## Error Codes

```typescript
enum ErrorCodes {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CRYPTO_ERROR = 'CRYPTO_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
}
```

---

## Protocol Constants

```typescript
// Device tiers
enum DeviceTier {
  HIGH = 'high',
  MID = 'mid',
  LOW = 'low',
  MINIMAL = 'minimal',
}

// Tier-specific parameters
const TIER_PARAMS = {
  high: { numHashes: 20, candidateCap: 100, refreshInterval: 300 },
  mid: { numHashes: 12, candidateCap: 50, refreshInterval: 480 },
  low: { numHashes: 8, candidateCap: 20, refreshInterval: 900 },
  minimal: { numHashes: 6, candidateCap: 10, refreshInterval: 1200 },
};
```

---

**For more details, see:**
- [PROTOCOL.md](../PROTOCOL.md) - Complete protocol specification
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [SEMANTIC.md](../SEMANTIC.md) - Semantic model specification
