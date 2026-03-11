# Social Module Implementation Plan

## Current Status

The social module (`apps/browser/src/social/`) contains 13 files with ~147 TypeScript errors from incomplete implementation. The module was started but not finished, with several architectural issues:

### Files Requiring Work

1. **posts.ts** - Post creation, signing, DHT announcement
2. **feeds.ts** - For You, Following, Explore feeds
3. **graph.ts** - Follows, suggested follows, reputation
4. **interactions.ts** - Likes, reposts, replies, quotes
5. **moderation.ts** - Semantic moderation, reports, mute/block
6. **communities.ts** - Shared channels, co-editing
7. **audioSpaces.ts** - WebRTC audio mesh
8. **directMessages.ts** - E2E encrypted DMs
9. **trending.ts** - Engagement-weighted ranking
10. **semanticMap.ts** - 2D visualization
11. **thoughtBridge.ts** - Conversation starters
12. **types.ts** - Social layer type definitions
13. **index.ts** - Module exports

## Key Issues to Fix

### 1. Missing Core Exports
- `@isc/core/crypto` - Need to verify exports work with vite alias
- `@isc/core/math` - Need to verify exports work with vite alias
- `@isc/core/math/lsh` - Specific LSH functions

### 2. Identity Module Gaps
- `getPeerID()` - ✅ Added
- `getKeypair()` - ✅ Added
- `loadEmbeddingModel()` - ✅ Added (embedding.ts)

### 3. Channel Manager Gaps
- `getChannel()` - ✅ Added
- `updateChannel()` - ✅ Added
- `Channel.distributions` - ✅ Added to core types

### 4. DelegationClient Gaps
- `announce()` method - ✅ Added (stub)
- `query()` method - ✅ Added (stub)
- `getInstance()` - ✅ Added

### 5. IndexedDB Async Patterns (Major Refactor Needed)

Current broken pattern:
```typescript
const result = db.transaction('store').objectStore('store').getAll();
return result.filter(...); // ❌ result is IDBRequest, not array
```

Correct pattern:
```typescript
const result = await new Promise((resolve, reject) => {
  const request = db.transaction('store').objectStore('store').getAll();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
return (result as Array<T>).filter(...); // ✅ Properly awaited
```

**Files affected**: communities.ts, directMessages.ts, graph.ts, moderation.ts

### 6. Null Safety

Many places assume `keypair` and `client` are non-null:
```typescript
const keypair = getKeypair(); // Can be null
const signature = await sign(payload, keypair.privateKey); // ❌ Crashes if null
```

Need proper null checks or throw errors.

## Recommended Approach

### Phase 1: Core Infrastructure (Done ✅)
- [x] Channel types with distributions
- [x] Identity exports (getPeerID, getKeypair)
- [x] Channel manager exports
- [x] DelegationClient stub methods

### Phase 2: Fix IndexedDB Helpers (Priority)
Create reusable async helpers:
```typescript
// src/db/helpers.ts
export async function dbGet<T>(store: string, key: string): Promise<T | null>
export async function dbGetAll<T>(store: string): Promise<T[]>
export async function dbPut<T>(store: string, value: T): Promise<void>
export async function dbDelete(store: string, key: string): Promise<void>
export async function dbFilter<T>(store: string, predicate: (item: T) => boolean): Promise<T[]>
```

### Phase 3: Fix Type Definitions
Create proper social types in `src/social/types.ts`:
- Post, SignedPost
- FollowSubscription, Profile
- LikeEvent, RepostEvent, ReplyEvent, QuoteEvent
- CommunityChannel, GroupDM, DMThread
- CommunityReport, Vote, CommunityCouncil

### Phase 4: Implement Core Features (Priority Order)
1. **posts.ts** - Basic post creation and display
2. **feeds.ts** - Simple chronological feed
3. **graph.ts** - Follow/unfollow
4. **interactions.ts** - Like/repost

### Phase 5: Advanced Features
5. **moderation.ts** - Mute/block
6. **communities.ts** - Shared channels
7. **trending.ts** - Trending posts
8. **directMessages.ts** - DMs
9. **audioSpaces.ts** - Audio rooms
10. **semanticMap.ts** - Visualization
11. **thoughtBridge.ts** - Bridging

## Estimated Effort

- Phase 2 (IndexedDB helpers): 2-3 hours
- Phase 3 (Type definitions): 2-3 hours
- Phase 4 (Core features): 8-12 hours
- Phase 5 (Advanced features): 16-24 hours

**Total**: ~30-40 hours for complete implementation

## Alternative: Minimal Social Module

If time is constrained, implement a minimal version:
1. Posts with DHT storage
2. Simple feed (no ranking)
3. Basic follows
4. Skip: communities, audio, DMs, visualization

**Minimal effort**: ~10-15 hours
